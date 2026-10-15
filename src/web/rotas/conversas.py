"""Chat: conversas diretas e grupos.

Tudo aqui é pergunta e resposta comum. O empurrão ao vivo (SSE) NÃO está
neste arquivo — sem ele o chat funciona, só exige recarregar para ver o
que chegou. É um marco de propósito: a peça nova vem depois, em cima de
algo que já roda.

Regra de acesso, em toda rota: quem pede tem que ser PARTICIPANTE. Sem
isso, bastaria chutar um id para ler conversa dos outros.
"""

import json
import queue
import threading

from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["conversas"])

LIMITE_MENSAGENS = 50


# ── Quem está ouvindo ──────────────────────────────────────────────
# {usuario_id: {fila, fila, ...}} — um CONJUNTO por pessoa, porque a
# mesma pessoa pode estar com duas abas abertas, e cada aba tem a sua.
#
# Isto mora na MEMÓRIA do processo, e é o motivo de o hub precisar
# continuar rodando num processo só. Com `uvicorn --workers 2` cada
# worker teria o seu dicionário, e metade das pessoas não receberia
# nada. No dia que isso for preciso, a saída é LISTEN/NOTIFY do
# Postgres, que já está instalado.
_ouvintes: dict[int, set[queue.Queue]] = {}
_tranca = threading.Lock()

ESPERA = 20       # segundos parado antes de mandar um batimento
FILA_MAX = 100    # eventos empilhados por aba antes de começar a descartar


def _entrar(usuario_id: int) -> queue.Queue:
    fila = queue.Queue(maxsize=FILA_MAX)
    with _tranca:
        _ouvintes.setdefault(usuario_id, set()).add(fila)
    return fila


def _sair(usuario_id: int, fila:queue.Queue) -> None:
    """Tirar do registro é obrigatório, não educado.

    Fila que fica para trás nunca mais é lida, e todo POST seguinte
    continua escrevendo nela. É vazamento de memória puro.
    """
    with _tranca:
        filas = _ouvintes.get(usuario_id)
        if filas:
            filas.discard(fila)
            if not filas:
                del _ouvintes[usuario_id]
                
                
def _avisar(usuarios: list[int], evento: dict) -> None:
    """Empurra um evento para todas as abas das pessoas citadas.

    A FOTO das filas é tirada DENTRO da tranca; o `put` acontece FORA.
    Dois motivos: nunca segurar tranca enquanto se faz trabalho, e
    percorrer um `set` enquanto outra thread insere nele levanta
    RuntimeError ("Set changed size during iteration").

    put_nowait, nunca put: o remetente não pode ficar preso porque a aba
    de outra pessoa parou de ler. Fila cheia significa aba travada, e aí
    descartar é o certo — ela recarrega e pega tudo pelo GET.
    """
    with _tranca:
        alvos = [f for u in usuarios for f in _ouvintes.get(u, ())]
        
    for fila in alvos:
        try:
            fila.put_nowait(evento)
        except queue.Full:
            pass


def _participa(con, conversa_id: int, usuario_id: int) -> bool:
    return con.execute(
        "SELECT 1 FROM participantes WHERE conversa_id = %s AND usuario_id = %s",
        (conversa_id, usuario_id),
    ).fetchone() is not None


def _exigir_participante(con, conversa_id: int, usuario_id: int) -> None:
    """404 para conversa que não existe E para conversa que não é sua.

    Desvio consciente da convenção do projeto, que manda 403 em "sei quem
    você é e você não pode". Aqui 403 confirmaria que a conversa 7 existe,
    e numa caixa de mensagens isso já é informação demais. As duas
    situações respondem igual.
    """
    if not _participa(con, conversa_id, usuario_id):
        raise HTTPException(404, "Conversa não encontrada.")


@router.get("/conversas")
def listar(usuario=Depends(usuario_atual)):
    """As conversas desta pessoa, com não lidas e a última mensagem.

    Os dois LATERAL são o coração daqui. LATERAL é a licença para uma
    subconsulta no FROM enxergar colunas da linha de fora (o c.id) e rodar
    uma vez por linha. Sem ela seria uma consulta por conversa, em laço no
    Python — com 30 pessoas e 20 conversas cada, 600 idas ao banco por
    abertura de tela.

    LEFT em vez de JOIN porque conversa recém-criada ainda não tem
    mensagem nenhuma; com INNER ela sumiria da lista.

    A contagem de não lidas sai do `lido_ate` do próprio participante — é
    por isso que não existe tabela de "fulano leu a mensagem X".
    """
    with conexao() as con:
        linhas = con.execute(
            """SELECT c.id, c.tipo, c.nome, p.lido_ate,
                      (SELECT count(*) FROM mensagens m
                        WHERE m.conversa_id = c.id AND m.id > p.lido_ate)::int
                          AS nao_lidas,
                      o.id      AS outro_id,
                      o.nome    AS outro_nome,
                      o.apelido AS outro_apelido,
                      o.foto_em AS outro_foto_em,
                      ult.id        AS ultima_id,
                      ult.corpo     AS ultima_corpo,
                      ult.criada_em AS ultima_em,
                      ult.autor_id  AS ultima_autor_id
                 FROM participantes p
                 JOIN conversas c ON c.id = p.conversa_id

                 LEFT JOIN LATERAL (
                      SELECT m.id, m.corpo, m.criada_em, m.autor_id
                        FROM mensagens m
                       WHERE m.conversa_id = c.id
                       ORDER BY m.id DESC
                       LIMIT 1
                 ) ult ON TRUE

                 -- o "outro" só existe em conversa direta; em grupo o
                 -- rótulo é o c.nome, e estas colunas vêm nulas
                 LEFT JOIN LATERAL (
                      SELECT u.id, u.nome, u.apelido, u.foto_em
                        FROM participantes p2
                        JOIN usuarios u ON u.id = p2.usuario_id
                       WHERE p2.conversa_id = c.id
                         AND p2.usuario_id <> p.usuario_id
                       ORDER BY u.nome
                       LIMIT 1
                 ) o ON c.tipo = 'direta'

                WHERE p.usuario_id = %s
                ORDER BY coalesce(ult.id, 0) DESC, c.id DESC""",
            (usuario["id"],),
        ).fetchall()

    return {
        "conversas": [
            {
                "id": l["id"],
                "tipo": l["tipo"],
                "nome": l["nome"],
                "nao_lidas": l["nao_lidas"],
                "lido_ate": l["lido_ate"],
                "outro": (
                    {
                        "id": l["outro_id"],
                        "nome": l["outro_nome"],
                        "apelido": l["outro_apelido"],
                        "foto_em": l["outro_foto_em"].isoformat()
                        if l["outro_foto_em"]
                        else None,
                    }
                    if l["outro_id"]
                    else None
                ),
                "ultima": (
                    {
                        "id": l["ultima_id"],
                        "corpo": l["ultima_corpo"],
                        "criada_em": l["ultima_em"].isoformat(),
                        "autor_id": l["ultima_autor_id"],
                    }
                    if l["ultima_id"]
                    else None
                ),
            }
            for l in linhas
        ]
    }


@router.get("/conversas/{conversa_id}/mensagens")
def mensagens(
    conversa_id: int,
    antes_de: int | None = None,
    usuario=Depends(usuario_atual),
):
    """As mensagens da conversa, da mais nova para a mais velha.

    A paginação é por CURSOR (`antes_de`), não por página numerada. Numa
    lista onde chega coisa nova no fim, "página 2" muda de conteúdo entre
    uma chamada e outra; um id de corte não muda.

    A ordem é pelo `id`, nunca pelo `criada_em`: duas mensagens no mesmo
    milissegundo empatam no relógio, o IDENTITY não empata.
    """
    with conexao() as con:
        _exigir_participante(con, conversa_id, usuario["id"])

        linhas = con.execute(
            """SELECT m.id, m.corpo, m.criada_em, m.autor_id,
                      u.nome AS autor_nome, u.apelido AS autor_apelido
                 FROM mensagens m
                 LEFT JOIN usuarios u ON u.id = m.autor_id
                WHERE m.conversa_id = %s
                  AND (%s::int IS NULL OR m.id < %s)
                ORDER BY m.id DESC
                LIMIT %s""",
            (conversa_id, antes_de, antes_de, LIMITE_MENSAGENS),
        ).fetchall()

    return {
        "mensagens": [
            {
                "id": l["id"],
                "corpo": l["corpo"],
                "criada_em": l["criada_em"].isoformat(),
                "autor_id": l["autor_id"],
                "autor_nome": l["autor_nome"],
                "autor_apelido": l["autor_apelido"],
            }
            # devolve em ordem de leitura; quem corta é o cursor acima
            for l in reversed(linhas)
        ],
        "tem_mais": len(linhas) == LIMITE_MENSAGENS,
    }


class Envio(BaseModel):
    corpo: str = Field(min_length=1, max_length=4000)


@router.post("/conversas/{conversa_id}/mensagens", status_code=201)
def enviar(conversa_id: int, dados: Envio, usuario=Depends(usuario_atual)):
    """201 porque isto CRIA um recurso — e não é idempotente de propósito.

    Mandar "ok" duas vezes são duas mensagens; a segunda não é um engano a
    ser engolido. É o oposto da estrela do catálogo, que é PUT.
    """
    corpo = dados.corpo.strip()
    if not corpo:
        raise HTTPException(422, "Mensagem vazia.")

    with conexao() as con:
        _exigir_participante(con, conversa_id, usuario["id"])

        linha = con.execute(
            """INSERT INTO mensagens (conversa_id, autor_id, corpo)
               VALUES (%s, %s, %s)
               RETURNING id, criada_em""",
            (conversa_id, usuario["id"], corpo),
        ).fetchone()

        # quem escreve já leu o que escreveu
        con.execute(
            """UPDATE participantes SET lido_ate = %s
                WHERE conversa_id = %s AND usuario_id = %s AND lido_ate < %s""",
            (linha["id"], conversa_id, usuario["id"], linha["id"]),
        )
        
        destinatarios = [
            l["usuario_id"]
            for l in con.execute(
                "SELECT usuario_id FROM participantes WHERE conversa_id = %s",
                (conversa_id,),
            ).fetchall()
        ]
        
    # FORA do with, ou seja: só depois do commit. Avisar de dentro da
    # transação e ela dar rollback depois deixaria os colegas com uma
    # mensagem que não existe no banco.
    _avisar(
        destinatarios,
        {
            "tipo": "mensagem",
            "conversa_id": conversa_id,
            "id": linha["id"],
            "corpo": corpo,
            "criada_em": linha["criada_em"].isoformat(),
            "autor_id": usuario["id"],
        },
    )    

    return {
        "id": linha["id"],
        "corpo": corpo,
        "criada_em": linha["criada_em"].isoformat(),
        "autor_id": usuario["id"],
    }


class Leitura(BaseModel):
    lido_ate: int = Field(ge=0)


@router.put("/conversas/{conversa_id}/lido")
def marcar_lido(conversa_id: int, dados: Leitura, usuario=Depends(usuario_atual)):
    """PUT porque é idempotente: mandar o mesmo número de novo não muda nada.

    O `lido_ate <` na condição impede que uma resposta atrasada ANDE PARA
    TRÁS a marca de leitura. Sem ele, duas abas abertas fariam o contador
    de não lidas piscar.
    """
    with conexao() as con:
        _exigir_participante(con, conversa_id, usuario["id"])

        con.execute(
            """UPDATE participantes SET lido_ate = %s
                WHERE conversa_id = %s AND usuario_id = %s AND lido_ate < %s""",
            (dados.lido_ate, conversa_id, usuario["id"], dados.lido_ate),
        )

        atual = con.execute(
            "SELECT lido_ate FROM participantes WHERE conversa_id = %s AND usuario_id = %s",
            (conversa_id, usuario["id"]),
        ).fetchone()

    return {"lido_ate": atual["lido_ate"]}


class NovaConversa(BaseModel):
    com: int | None = None          # conversa direta: o outro usuário
    nome: str | None = Field(default=None, max_length=80)   # grupo
    membros: list[int] = Field(default_factory=list)        # grupo


@router.post("/conversas", status_code=201)
def criar(dados: NovaConversa, usuario=Depends(usuario_atual)):
    """Abre uma conversa direta (resolvendo se já existir) ou cria um grupo."""
    eu = usuario["id"]

    # ── conversa direta ────────────────────────────────────────────
    if dados.com is not None:
        if dados.com == eu:
            raise HTTPException(422, "Não dá para conversar consigo mesmo.")

        with conexao() as con:
            if not con.execute(
                "SELECT 1 FROM usuarios WHERE id = %s AND ativo", (dados.com,)
            ).fetchone():
                raise HTTPException(404, "Usuário não encontrado.")

            # Trava consultiva pelo PAR ordenado. Sem ela, Pablo abrindo
            # com Saymon no mesmo instante em que Saymon abre com Pablo:
            # os dois procuram, nenhum acha, os dois criam — e nascem
            # duas conversas paralelas que nunca se encontram. A trava
            # morre junto com a transação, sozinha.
            a, b = min(eu, dados.com), max(eu, dados.com)
            con.execute("SELECT pg_advisory_xact_lock(%s, %s)", (a, b))

            achada = con.execute(
                """SELECT c.id
                     FROM conversas c
                     JOIN participantes pa ON pa.conversa_id = c.id AND pa.usuario_id = %s
                     JOIN participantes pb ON pb.conversa_id = c.id AND pb.usuario_id = %s
                    WHERE c.tipo = 'direta'
                      AND (SELECT count(*) FROM participantes p
                            WHERE p.conversa_id = c.id) = 2
                    LIMIT 1""",
                (eu, dados.com),
            ).fetchone()

            if achada:
                return {"id": achada["id"], "tipo": "direta", "ja_existia": True}

            nova = con.execute(
                """INSERT INTO conversas (tipo, criada_por)
                   VALUES ('direta', %s) RETURNING id""",
                (eu,),
            ).fetchone()
            # laço em vez de executemany: no psycopg3 executemany é do
            # CURSOR, não da conexão, e para duas linhas o laço é mais
            # claro do que abrir cursor só para isso
            for quem in (eu, dados.com):
                con.execute(
                    "INSERT INTO participantes (conversa_id, usuario_id) VALUES (%s, %s)",
                    (nova["id"], quem),
                )

        return {"id": nova["id"], "tipo": "direta", "ja_existia": False}

    # ── grupo ──────────────────────────────────────────────────────
    nome = (dados.nome or "").strip()
    if not nome:
        raise HTTPException(422, "Grupo precisa de nome.")

    # o criador entra sempre, e sem duplicar se ele se listou
    membros = {eu, *dados.membros}

    with conexao() as con:
        validos = con.execute(
            "SELECT id FROM usuarios WHERE id = ANY(%s) AND ativo",
            (list(membros),),
        ).fetchall()
        if len(validos) != len(membros):
            raise HTTPException(422, "Algum membro não existe ou está inativo.")

        nova = con.execute(
            """INSERT INTO conversas (tipo, nome, criada_por)
               VALUES ('grupo', %s, %s) RETURNING id""",
            (nome, eu),
        ).fetchone()
        for m in membros:
            con.execute(
                "INSERT INTO participantes (conversa_id, usuario_id) VALUES (%s, %s)",
                (nova["id"], m),
            )

    return {"id": nova["id"], "tipo": "grupo", "ja_existia": False}


@router.get("/conversas/stream")
def stream(usuario=Depends(usuario_atual)):
    """Uma conexão por pessoa logada, aberta, recebendo o que chegar.

    `def` e não `async def`, de propósito: o FastAPI roda função síncrona
    num pool de threads, e aí `fila.get(timeout=...)` pode bloquear à
    vontade sem travar o laço de eventos. Com `async def` seria preciso
    `asyncio.Queue` e `await` — e todo o resto do hub é síncrono.

    É o mesmo desenho do /api/logs/stream que você escreveu na API-UP.
    """
    eu = usuario["id"]
    
    def gerar():
        fila = _entrar(eu)
        try:
            # linha começando em ':' é comentário de SSE: o navegador
            # ignora, mas já confirma que a conexão abriu
            yield ": ligado\n\n"
            while True:
                try:
                    evento = fila.get(timeout=ESPERA)
                except queue.Empty:
                    yield ": ping\n\n"
                    continue
                yield f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"
        finally:
            # roda na saída normal E no GeneratorExit do quando a aba fecha
            _sair(eu, fila)
            
    return StreamingResponse(
        gerar(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # sem isso um proxy no meio segura a resposta em buffer e
            # nada chega até encher - já tinha descoberto isso na API-UP
            "X-Accel-Buffering": "no",
        },
    )
