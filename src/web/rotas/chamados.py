from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StringConstraints

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["chamados"])


class ChamadoEntrada(BaseModel):
    # strip antes de medir: cinco espaços não são uma descrição
    descricao: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=4000)]
    
    
@router.post("/chamados", status_code=201)
def abrir_chamado(dados: ChamadoEntrada, usuario=Depends(usuario_atual)):
    with conexao() as con:
        chamado = con.execute(
            """INSERT INTO chamados (usuario_id, descricao)
               VALUES (%s, %s)
               RETURNING id, descricao, status, criado_em""",
            (usuario["id"], dados.descricao),
        ).fetchone()
    
    return chamado