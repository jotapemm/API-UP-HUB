from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from src.auth import gerar_hash
from src.db import conexao

router = APIRouter(prefix="/api", tags=["auth"])


class CadastroEntrada(BaseModel):
    nome: str = Field(min_lenght=3)
    apelido: str | None = None
    email: EmailStr
    senha: str = Field(min_lenght=8)
    
    
@router.post("/cadastro", status_code=201)
def cadastrar(dados: CadastroEntrada):
    email = dados.email.lower().strip()
    apelido = (dados.apelido or "").strip() or None
    
    with conexao() as con:
        ja_existe = con.execute(
            "SELECT 1 FROM usuarios WHERE email = %s", (email,)
        ).fetchone()
        if ja_existe:
            raise HTTPException(409, "Esse email já está cadastrado.")
        
        con.execute(
            """INSERT INTO usuarios (nome, apelido, email, senha_hash) VALUES (%s, %s, %s, %s)""",
            (dados.nome.strip(), apelido, email, gerar_hash(dados.senha)),
        )
        
    return {"ok": True}