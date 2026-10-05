from fastapi import APIRouter, Depends, HTTPException

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["favoritas"])


def existe_favorita(con, automacao_id: int) -> bool:
    return con.execute(
        "SELECT 1 FROM automacoes WHERE id = %s AND ativa", (automacao_id,)
    ).fetchone() is not None
    
    
@router.put("/automacoes/{automacao_id}/favorito")
def favoritar(automacao_id: int, usuario=Depends(usuario_atual)):
    """PUT, não POST, porque isto é IDEMPOTENTE.
    
    POST diria "crie mais um". Clicar duas vezes na estrela não
    cria dois favoritos - deixa o mesmo estado. PUT é o verbo que
    promete isso, e o ON CONFLICT abaixo é quem cumpre a promessa no banco.
    """
    with conexao() as con:
        if not existe_favorita(con, automacao_id):
            # o id veio no CAMINHO, então ele nomeia um recurso: 404, não 422
            raise HTTPException(404, "Automação não encontrada.")
        
        con.execute(
            """INSERT INTO favoritos (usuario_id, automacao_id)
               VALUES (%s, %s)
               ON CONFLICT DO NOTHING""",
            (usuario["id"], automacao_id),
        )
        
    return {"favorita": True}


@router.delete("/automacoes/{automacao_id}/favorito")
def desfavoritar(automacao_id: int, usuario=Depends(usuario_atual)):
    """Também idempotente: apagar o que já não existe não é erro."""
    with conexao() as con:
        con.execute(
            "DELETE FROM favoritos WHERE usuario_id = %s AND automacao_id = %s",
            (usuario["id"], automacao_id),
        )
        
    return {"favorita": False}