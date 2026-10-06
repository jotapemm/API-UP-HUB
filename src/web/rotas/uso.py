from datetime import date

from fastapi import APIRouter, Depends, Query

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
