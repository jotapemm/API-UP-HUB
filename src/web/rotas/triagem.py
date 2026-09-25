from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.db import conexao
from src.web.seguranca import usuario_suporte

router = APIRouter(prefix="/api/triagem", tags=["triagem"])


@router.get("/chamados")
def listar_todos(usuario=Depends(usuario_suporte)):
    with conexao() as con:
        return con.execute(
            """SELECT c.id, c.descricao, c.status, c.criado_em, c.atualizado_em,
                      a.nome         AS automacao,
                      quem.nome      AS aberto_por,
                      quem.email     AS email_de_quem_abriu,
                      atendente.nome AS atendido_por
               FROM chamados c
               JOIN usuarios quem ON quem.id = c.usuario_id
               LEFT JOIN automacoes a ON a.id = c.automacao_id
               LEFT JOIN usuarios atendente ON atendente.id = c.atendido_por
               ORDER BY (c.status IN ('resolvido', 'cancelado')),
                        c.criado_em DESC, c.id DESC 
               LIMIT 100"""
        ).fetchall()
        
        
class MudancaStatus(BaseModel):
    status: Literal["aberto", "em_andamento", "resolvido", "cancelado"]
    
    
@router.patch("/chamados/{chamado_id}")
def mudar_status(chamado_id: int, dados: MudancaStatus, usuario=Depends(usuario_suporte)):
    with conexao() as con:
        linha = con.execute(
            """UPDATE chamados
               SET status = %s, atualizado_em = now(), atendido_por = %s
               WHERE id = %s
               RETURNING id, status, atualizado_em""",
            (dados.status, usuario["id"], chamado_id),
        ).fetchone()
        
    if linha is None:
        raise HTTPException(404, "Chamado não encontrado.")
    
    return linha