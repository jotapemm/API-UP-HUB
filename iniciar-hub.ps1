# ═══════════════════════════════════════════════════════════════════
#  Sobe o UP API HUB, grava tudo em arquivo e o mantém de pé.
#
#  Existe por dois motivos:
#
#  1. Quando o hub roda numa janela de terminal e o processo morre, o
#     traceback morre junto com a janela. Aqui ele fica no disco.
#
#  2. O "reiniciar se a tarefa falhar" do Agendador de Tarefas cobre
#     falha ao INICIAR a tarefa, não o programa terminando com erro
#     depois de rodar. Testado em 29/09/2026: matando o processo, a
#     tarefa registrou codigo -1 e não reiniciou. Então quem vigia o
#     Python é este laço aqui, não o Agendador.
#
#  Rodar na mão:  powershell -ExecutionPolicy Bypass -File iniciar-hub.ps1
#  Em serviço:    ver INSTALAR-SERVICO.md
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

# $PSScriptRoot é a pasta deste arquivo. Usar ele (em vez de um caminho
# escrito à mão) faz o script funcionar tanto pelo Z: quanto pelo UNC.
$raiz      = $PSScriptRoot
$logs      = Join-Path $raiz 'logs'
$historico = Join-Path $logs 'historico.log'
$python    = 'C:\Python314\python.exe'

# Escada de espera entre uma queda e a próxima tentativa. O último
# degrau é onde ele fica: 5 minutos pra sempre, sem desistir.
#
# Não desistir é deliberado. As quedas que este hub já teve foram o
# disco do servidor encher e a máquina reiniciar — as duas se resolvem
# sozinhas. Um supervisor que desiste deixaria o hub no chão DEPOIS da
# causa ter passado, esperando alguém perceber.
$esperas = @(5, 10, 30, 60, 120, 300)

# Quantas quedas nos últimos JANELA minutos definem em que degrau da
# escada estamos. Contar por janela, e não por quedas seguidas, evita
# o furo de uma tentativa demorada zerar o contador: uma subida que
# falha em 37s (disco de rede lento) não significa que o hub ficou de pé.
$JANELA_MIN = 10

New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Anotar($texto) {
    "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] $texto" |
        Add-Content -Encoding utf8 $historico
}

$quedas = @()

while ($true) {
    # Faxina a cada volta, não só na primeira: num laço que nunca
    # termina, limpar só na entrada é limpar uma vez na vida.
    Get-ChildItem -Path $logs -Filter 'hub-*' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
        Remove-Item -Force -ErrorAction SilentlyContinue

    # Em operação normal, um par de arquivos por subida: cada queda
    # fica isolada no seu próprio log. Mas numa falha que se repete,
    # isso viraria centenas de arquivos — então, a partir do momento
    # em que a escada chega no último degrau, passa a reusar um par
    # fixo, sempre com a falha mais recente.
    $sustentada = $quedas.Count -ge $esperas.Count
    if ($sustentada) {
        $etiqueta = 'falha-continua'
    } else {
        $etiqueta = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    }
    $saida = Join-Path $logs "hub-$etiqueta.log"
    $erro  = Join-Path $logs "hub-$etiqueta.erro.log"

    Anotar "subindo ($etiqueta)"
    $inicio = Get-Date

    # O -u desliga o buffer da saída do Python. Sem ele, o texto fica
    # acumulado na memória até encher alguns KB, e um travamento leva o
    # buffer junto: o log fica vazio justamente na hora que importa.
    $processo = Start-Process -FilePath $python -ArgumentList '-u', 'main.py' `
        -WorkingDirectory $raiz -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $saida -RedirectStandardError $erro

    $codigo   = $processo.ExitCode
    $segundos = [int]((Get-Date) - $inicio).TotalSeconds
    Anotar "encerrou com codigo $codigo depois de ${segundos}s ($etiqueta)"

    # Descarta as quedas que já saíram da janela e registra esta.
    $quedas = @($quedas | Where-Object { $_ -ge (Get-Date).AddMinutes(-$JANELA_MIN) }) + (Get-Date)

    $degrau = [Math]::Min($quedas.Count - 1, $esperas.Count - 1)
    $espera = $esperas[$degrau]

    if ($quedas.Count -ge $esperas.Count) {
        Anotar "$($quedas.Count) quedas em $JANELA_MIN min - religando em ${espera}s (leia hub-$etiqueta.erro.log)"
    } else {
        Anotar "religando em ${espera}s"
    }

    Start-Sleep -Seconds $espera
}
