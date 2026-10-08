import hmac
import os
from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["uso"])


@router.get("/eu/uso")
def meu_uso(
    ano: int = Query(default=None, ge=2020, le=2100),
    usuario=Depends(usuario_atual),
):
    """Quantas execuções por dia, no ano pedido.

    Devolve só os dias QUE TÊM uso. O ano inteiro tem 365 buracos e 2 ou 3
    dias cheios — mandar os 365 seria mandar quase só zero. Quem monta a
    grade é a tela, que é quem sabe o formato dela; o servidor manda fato.
    """
    ano = ano or date.today().year

    with conexao() as con:
        linhas = con.execute(
            """SELECT dia, sum(execucoes)::int AS execucoes
               FROM uso
               WHERE usuario_id = %s
                 AND dia >= make_date(%s, 1, 1)
                 AND dia <  make_date(%s + 1, 1, 1)
               GROUP BY dia
               ORDER BY dia""",
            (usuario["id"], ano, ano),
        ).fetchall()

    return {
        "ano": ano,
        "dias": [
            {"dia": l["dia"].isoformat(), "execucoes": l["execucoes"]}
            for l in linhas
        ],
    }
    

class Reporte(BaseModel):
    """O que uma automação manda quando termina um processamento.

    Nada de `usuario_id` aqui, e nada de data: o hub descobre quem é
    pelo e-mail e usa o próprio relógio para o dia.
    """
    
    automacao: str
    email: EmailStr
    evento_id: str = Field(min_length=1, max_length=200)
    quantidade: int = Field(default=1, ge=1, le = 1000)
    

@router.post("/uso")
def registrar_uso(
    dados: Reporte,
    chave: str | None = Header(default=None, alias="X-UP-Chave"),
):
    """Uma automação avisando que alguém usou ela.

    Única rota do hub sem `Depends(usuario_atual)`: quem chama é um
    programa, não um navegador. A credencial é o segredo compartilhado
    do .env, no cabeçalho X-UP-Chave.
    """
    segredo = os.environ.get("UP_HUB_CHAVE_USO")
    if not segredo:
        # Falha FECHADA. Hub sem segredo configurado recusa todo mundo,
        # em vez de aceitar todo mundo.
        raise HTTPException(503, "Reporte de uso não está configurado.")
    
    # .encode() nos dois lados porque compare_digest com str só aceita
    # ASCII: um acento no cabeçalho viraria TypeError, ou seja, 500.
    #
    # E compare_digest em vez de ==, porque == para no primeiro
    # caractere diferente e o TEMPO que ele gasta conta quantos você
    # acertou. Este gasta o mesmo tempo sempre.
    if not chave or not hmac.compare_digest(chave.encode(), segredo.encode()):
        raise HTTPException(401, "Chave inválida.")
    
    email = dados.email.lower().strip()
    # Um `with` só, porque isto é UMA transação. Se o registro do evento
    # e a soma ficassem em transações separadas, uma queda no meio
    # deixaria o evento queimado sem a soma (perde execução) ou a soma
    # sem o evento (conta dobrado no reenvio).
    with conexao() as con:
        automacao = con.execute(
            "SELECT id FROM automacoes WHERE slug = %s AND ativa",
            (dados.automacao.strip().lower(),),
        ).fetchone()
        
        if not automacao:
            # Slug errado é erro de configuração de quem chama, e tem
            # que doer: devolver "false" esconderia o typo pra sempre.
            raise HTTPException(404, "Automação não encontrada.")
        
        pessoa = con.execute(
            "SELECT id FROM usuarios WHERE email = %s AND ativo",
            (email,),
        ).fetchone()
        
        if not pessoa:
            # NÃO é erro: é alguém que usa a automação e não tem conta
            # no hub. Nada a registrar, e nada que a automação possa
            # fazer a respeito.
            return {"registrado": False, "motivo": "sem conta no hub"}
        
        # O RETURNING é o que responde "era novo?". Com DO NOTHING, uma
        # linha que já existia não volta nada.
        novo = con.execute(
            """INSERT INTO uso_eventos (automacao_id, evento_id)
               VALUES (%s, %s)
               ON CONFLICT DO NOTHING
               RETURNING 1""",
            (automacao["id"], dados.evento_id),
        ).fetchone()
        
        if not novo:
            return {"registrado": False, "motivo": "evento já contado"}
        
        # uso.execucoes = a linha que JÁ ESTÁ lá
        # EXCLUDED.execucoes = a que tentou entrar e foi barrada
        # Poder nomear as duas é o que faz "incrementa" caber aqui.
        con.execute(
            """INSERT INTO uso (usuario_id, automacao_id, dia, execucoes)
               VALUES (%s, %s, current_date, %s)
               ON CONFLICT (usuario_id, automacao_id, dia)
               DO UPDATE SET execucoes = uso.execucoes + EXCLUDED.execucoes""",
            (pessoa["id"], automacao["id"], dados.quantidade),
        )

    return {"registrado": True}


    
