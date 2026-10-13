"""Avisa o hub que alguém usou esta automação.

Este arquivo é copiado como está para dentro de cada automação. Ele NÃO
é cliente do hub: avisa e segue. Se o hub estiver fora, o processamento
continua exatamente igual e o aviso se perde — um quadradinho a menos no
calendário, nada mais.

Não imprime nada, nunca, e não levanta nada, nunca.
"""

import json
import os
import time
import atexit
import threading
import urllib.request

_ESPERA = 3  # segundos, conectar e ler


def _config():
    """Lê a configuração NA HORA DA CHAMADA, não na importação.

    Se fosse lida no topo do módulo, a ordem dos imports de cada projeto
    passaria a importar: importar este arquivo antes do load_dotenv() do
    projeto deixaria a chave em None e o reporte viraria um no-op
    SILENCIOSO para sempre. Medido dentro da API-UP em 13/10/2026 — e
    silêncio é justamente o que este arquivo não pode ter, porque ele
    engole todos os erros de propósito.

    Um arquivo que se propõe a ser copiado como está para dentro de oito
    projetos não pode depender da ordem de import de nenhum deles.

    Sobre o endereço: 127.0.0.1 e NÃO um nome, de propósito. Medido em
    09/10/2026:
        127.0.0.1        conectar     1,5 ms
        DESKTOP-JFN7ELS  conectar   2015 ms
    Nome que resolve para IPv6 E IPv4 custa 2 segundos: o urllib tenta o
    IPv6 primeiro, o hub escuta só em 0.0.0.0 (IPv4), e ele espera a
    conexão falhar antes de cair pro IPv4. O curl tenta os dois em
    paralelo e por isso não sofre; o urllib tenta em fila.
    Automação em OUTRA máquina: ponha o IP da sua no UP_HUB_URL do .env
    dela (hoje 192.168.0.149) — IP, nunca nome.
    """
    return (
        os.environ.get("UP_HUB_CHAVE_USO"),
        os.environ.get("UP_HUB_AUTOMACAO"),
        os.environ.get("UP_HUB_URL", "http://127.0.0.1:8090") + "/api/uso",
    )

# Opener SEM proxy. Numa máquina com http_proxy configurado, o urlopen
# mandaria um pedido de rede local para o proxy e falharia SEMPRE. Como
# aqui todo erro é engolido, falharia em silêncio para sempre — que é
# muito pior do que perder um reporte de vez em quando.
_ABRIR = urllib.request.build_opener(urllib.request.ProxyHandler({})).open
_NOME_THREAD = "uphub-aviso"


@atexit.register
def _esperar_no_fim():
    """Dá um último instante aos avisos em voo, na saída do processo.

    Num servidor isto nunca roda — o processo não sai. Mas num script que
    termina logo depois de reportar, a thread daemon morre junto e o
    aviso se perde SEMPRE. Medido em 09/10/2026: o script que chamava
    reportar() e saía na linha seguinte não entregou nenhum reporte.

    `daemon=True` continua certo — ele é a garantia de que nada segura o
    processo para sempre (um getaddrinfo travado não respeita timeout de
    socket). Este join só pede o tempo do timeout e desiste.
    """
    fim = time.monotonic() + _ESPERA
    for t in threading.enumerate():
        if t.name == _NOME_THREAD:
            t.join(timeout=max(0.0, fim - time.monotonic()))



def reportar(email: str, evento_id: str, quantidade: int = 1) -> None:
    """Dispara e esquece.

    Chame UMA vez por ação da pessoa, com `quantidade` somando o lote —
    nunca uma vez por item dentro de um laço, senão viram 500 threads
    para contar uma coisa só.
    """
    chave, automacao, url = _config()

    # Sem segredo ou sem slug configurado, não faz nada. Em silêncio:
    # automação não é lugar de reclamar de configuração do hub.
    if not (chave and automacao and email and evento_id):
        return

    corpo = json.dumps({
        "automacao": automacao,
        "email": email,
        "evento_id": str(evento_id),
        "quantidade": quantidade,
    }).encode()

    pedido = urllib.request.Request(
        url,
        data=corpo,
        method="POST",
        headers={"Content-Type": "application/json", "X-UP-Chave": chave},
    )
    
    def _enviar():
        try:
            _ABRIR(pedido, timeout=_ESPERA).close()
        except Exception:
            pass    # hub fora, rede caída, 401, 404: nada disso é problema daqui
    
    # daemon=True é o que impede este aviso de segurar a automação. Sem
    # ele, uma thread presa num pedido pendurado mantém o processo vivo
    # depois do trabalho terminar.
    threading.Thread(target=_enviar, name=_NOME_THREAD, daemon=True).start()