from fastapi import Cookie, HTTPException

from src.auth import usuario_da_sessao
from src.db import conexao

NOME_COOKIE = "up_hub_sessao"


def usuario_atual(sessao: str | None = Cookie(default=None, alias=NOME_COOKIE)):
    if not sessao:
        raise HTTPException(401, "Não autenticado.")
    
    with conexao() as con:
        usuario = usuario_da_sessao(con, sessao)
        
    if not usuario:
        raise HTTPException(401, "Sessão inválida ou expirada.")
    
    return usuario