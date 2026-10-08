# ═══════════════════════════════════════════════════════════════════
#  Copia o banco up_hub para fora, e confere que a cópia presta.
#
#  Por que existe: o código tem GitHub e o esquema tem src/esquema.sql,
#  mas os DADOS — usuários, chamados, favoritos, uso — existem num lugar
#  só. Medido em 06/10/2026: 8,5 MB insubstituíveis e sem nenhuma cópia.
#
#  Duas pastas de destino, de propósito:
#
#    · C:\Backups\up_hub  é o destino principal. Cobre o estrago que de
#      fato acontece: DROP errado, ALTER que estraga coluna, tabela
#      corrompida, "eu limpei a tabela achando que era a de teste".
#
#    · Z:\UP-API\backups-up-hub é a cópia de fora do disco. Ela é a
#      única que sobrevive ao C: morrer — o banco mora no C:
#      (C:/Program Files/PostgreSQL/17/data), então backup só no C: é
#      backup no mesmo disco do original. Se o Z: estiver fora, o script
#      anota e segue: a falta da segunda cópia não cancela a primeira.
#
#  A faxina de sessões vencidas vai aqui dentro, antes do dump, para a
#  cópia não carregar login morto. Era uma pendência solta do CLAUDE.md.
#
#  Rodar na mão:  powershell -ExecutionPolicy Bypass -File backup-banco.ps1
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

$raiz      = $PSScriptRoot
$logs      = Join-Path $raiz 'logs'
$registro  = Join-Path $logs 'backup.log'
$principal = 'C:\Backups\up_hub'
$MANTER    = 30          # dias de histórico em cada destino

# Caminho UNC, não 'Z:\...'. Letra de unidade é mapeamento de SESSÃO: a
# tarefa agendada pode rodar num contexto onde o Z: simplesmente não
# existe, e aí a cópia externa falharia sem motivo real. O UNC não
# depende de mapeamento nenhum.
#
# E é o servidor cravado, de propósito — não derivado da pasta do
# projeto. O sentido desta cópia é estar num disco FÍSICO diferente do
# banco, que mora no C:. Se um dia o projeto mudar para o C:, derivar o
# caminho colocaria as duas cópias no mesmo disco e o backup perderia a
# razão de existir. Mudar de servidor é editar esta linha.
$copia = '\\192.168.0.50\dados\UP-API\backups-up-hub'

New-Item -ItemType Directory -Force -Path $logs, $principal | Out-Null

function Anotar($texto) {
    $linha = "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] $texto"
    $linha | Add-Content -Encoding utf8 $registro
    Write-Host $linha
}

# ── Onde estão as ferramentas ──────────────────────────────────────
# Glob em vez de caminho cravado: no dia que o Postgres virar 18, o
# script acha o bin novo em vez de falhar apontando uma pasta que saiu.
$bin = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name) } -Descending |
    Select-Object -First 1 -ExpandProperty DirectoryName

if (-not $bin) {
    Anotar 'ERRO: nao achei pg_dump.exe em C:\Program Files\PostgreSQL\*\bin'
    exit 1
}

# ── Credenciais ────────────────────────────────────────────────────
# Saem do .env, o mesmo lugar de onde a aplicação as lê. A senha não
# fica escrita neste arquivo justamente porque este arquivo vai pro git.
$url = (Get-Content (Join-Path $raiz '.env') | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' }) -replace '^[^=]+=\s*', ''
if (-not $url) {
    Anotar 'ERRO: DATABASE_URL nao encontrada no .env'
    exit 1
}

$u     = [uri]$url
$banco = $u.AbsolutePath.TrimStart('/')
$porta = if ($u.Port -gt 0) { $u.Port } else { 5432 }
$dono  = [uri]::UnescapeDataString($u.UserInfo.Split(':')[0])

# PGPASSWORD é lida pelo pg_dump/psql do ambiente. Fica só nesta sessão
# do PowerShell e morre com ela.
$env:PGPASSWORD = [uri]::UnescapeDataString($u.UserInfo.Split(':', 2)[1])

$comum = @('-h', $u.Host, '-p', $porta, '-U', $dono, '-d', $banco)

# ── Faxina de sessões vencidas ─────────────────────────────────────
# ON DELETE CASCADE cuida de conta apagada, mas sessão que simplesmente
# venceu ninguém recolhe. Medido em 06/10/2026: 12 vencidas de 14.
#
# E eventos de uso velhos. A tabela uso_eventos existe só para reconhecer
# reenvio, e reenvio acontece em segundos — guardar 7 dias é folga de
# sobra. Sem isso ela cresceria para sempre sem nunca ser consultada.
$faxina = & "$bin\psql.exe" @comum -t -A `
    -c 'DELETE FROM sessoes WHERE expira_em < now()' `
    -c "DELETE FROM uso_eventos WHERE visto_em < now() - interval '7 days'" 2>&1

if ($LASTEXITCODE -eq 0) {
    Anotar "faxina: $($faxina -join ' / ')"
} else {
    # Não aborta: deixar de limpar é chato, deixar de ter backup é grave.
    Anotar "AVISO: faxina falhou ($faxina) - seguindo para o dump"
}

# ── O dump ─────────────────────────────────────────────────────────
# -Fc (custom) e não .sql de texto: já vem comprimido, e o pg_restore
# consegue listar o conteúdo e restaurar uma tabela só. A coluna `foto`
# é bytea; em texto ela viraria hexadecimal e inflaria o arquivo.
$arquivo = Join-Path $principal ("up_hub-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HH-mm'))

& "$bin\pg_dump.exe" @comum -Fc --no-owner --no-privileges -f $arquivo 2>&1 | ForEach-Object { Anotar "pg_dump: $_" }

if ($LASTEXITCODE -ne 0) {
    Anotar "ERRO: pg_dump saiu com codigo $LASTEXITCODE - nenhuma copia foi feita"
    exit 1
}

# ── Conferir a cópia ───────────────────────────────────────────────
# Backup que ninguém abriu é suposição, não backup. pg_dump pode sair
# com zero e deixar arquivo truncado se o disco encher no meio — foi
# exatamente o disco encher que já derrubou este projeto uma vez.
# Então: o arquivo tem que existir, ter tamanho, e o pg_restore tem que
# conseguir ler o índice dele e achar TODAS as tabelas.
#
# Quantas são "todas" sai do próprio banco, não de um número escrito
# aqui. Número cravado envelhece calado: com '7' escrito à mão, a tabela
# uso_eventos entrou e a conferência continuou passando sem conferir
# nada de novo — e no dia que uma tabela DESAPARECESSE do dump ela
# passaria também.
$esperadas = [int](& "$bin\psql.exe" @comum -t -A -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")

$tamanho = (Get-Item $arquivo).Length
$indice  = & "$bin\pg_restore.exe" -l $arquivo 2>&1
$tabelas = @($indice | Where-Object { $_ -match 'TABLE DATA public' }).Count

if ($LASTEXITCODE -ne 0 -or $esperadas -lt 1 -or $tabelas -ne $esperadas) {
    Anotar "ERRO: copia nao confere (tamanho $tamanho B, $tabelas tabelas no dump contra $esperadas no banco) - apagando $arquivo"
    Remove-Item $arquivo -Force -ErrorAction SilentlyContinue
    exit 1
}

Anotar ("ok: {0} ({1:N0} KB, {2} tabelas)" -f (Split-Path $arquivo -Leaf), ($tamanho / 1KB), $tabelas)

# ── Cópia para fora do disco ───────────────────────────────────────
try {
    New-Item -ItemType Directory -Force -Path $copia -ErrorAction Stop | Out-Null
    Copy-Item $arquivo $copia -Force -ErrorAction Stop
    Anotar "copia externa: $copia"
} catch {
    Anotar "AVISO: copia externa falhou ($($_.Exception.Message)) - a do C: esta feita"
}

# ── Histórico ──────────────────────────────────────────────────────
# Apaga por idade, não por contagem: se o agendador ficar uma semana sem
# rodar, contagem apagaria backup bom para caber um novo que não veio.
foreach ($pasta in @($principal, $copia)) {
    Get-ChildItem -Path $pasta -Filter 'up_hub-*.dump' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$MANTER) } |
        ForEach-Object {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            Anotar "removido por idade: $($_.Name)"
        }
}
