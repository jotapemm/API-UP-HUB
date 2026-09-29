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

New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Anotar($texto) {
    "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] $texto" |
        Add-Content -Encoding utf8 $historico
}

# Faxina: logs com mais de 14 dias não ajudam ninguém e enchem o disco
# do servidor (que já encheu uma vez).
Get-ChildItem -Path $logs -Filter 'hub-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

# Quantas quedas rápidas seguidas. Queda rápida = o hub nem chegou a
# ficar de pé, então insistir na mesma velocidade só enche o disco.
$quedasRapidas = 0
$esperas = @(5, 10, 30, 60, 120)

while ($true) {
    # Um par de arquivos por subida: cada queda fica isolada no seu
    # próprio log, e o mais recente é sempre o que interessa.
    $carimbo = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    $saida   = Join-Path $logs "hub-$carimbo.log"
    $erro    = Join-Path $logs "hub-$carimbo.erro.log"

    Anotar "subindo ($carimbo)"
    $inicio = Get-Date

    # O -u desliga o buffer da saída do Python. Sem ele, o texto fica
    # acumulado na memória até encher alguns KB, e um travamento leva o
    # buffer junto: o log fica vazio justamente na hora que importa.
    $processo = Start-Process -FilePath $python -ArgumentList '-u', 'main.py' `
        -WorkingDirectory $raiz -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $saida -RedirectStandardError $erro

    $codigo  = $processo.ExitCode
    $segundos = [int]((Get-Date) - $inicio).TotalSeconds
    Anotar "encerrou com codigo $codigo depois de ${segundos}s ($carimbo)"

    if ($segundos -lt 30) { $quedasRapidas++ } else { $quedasRapidas = 0 }

    # Cinco quedas seguidas sem nem conseguir ficar de pé não é
    # instabilidade, é defeito. Insistir esconde o problema; parar
    # deixa o último .erro.log como a resposta.
    if ($quedasRapidas -ge 5) {
        Anotar "DESISTINDO: 5 quedas em menos de 30s seguidas. Leia hub-$carimbo.erro.log"
        exit 1
    }

    $espera = $esperas[[Math]::Min($quedasRapidas, $esperas.Count - 1)]
    Anotar "religando em ${espera}s"
    Start-Sleep -Seconds $espera
}
