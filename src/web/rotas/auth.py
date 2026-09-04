from fastapi import APIRouter, HTTPException, Cookie, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field

from src.auth import gerar_hash, conferir, criar_sessao, encerrar_sessao
from src.web.seguranca import NOME_COOKIE, usuario_atual
from src.db import conexao

router = APIRouter(prefix="/api", tags=["auth"])


class CadastroEntrada(BaseModel):
    nome: str = Field(min_length=3)
    apelido: str | None = None
    email: EmailStr
    senha: str = Field(min_length=8)
    
    
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


class LoginEntrada(BaseModel):
    email: EmailStr
    senha: str
    

@router.post("/login")
def entrar(dados: LoginEntrada, request: Request, response: Response):
    email= dados.email.lower().strip()
    
    with conexao() as con:
        usuario = con.execute(
            "SELECT id, senha_hash FROM usuarios WHERE email = %s AND ativo",(email,),
        ).fetchone()
        
        if not usuario or not conferir(usuario["senha_hash"], dados.senha):
            raise HTTPException(401, "Email ou senha incorretos")
        
        token = criar_sessao(
            con,
            usuario["id"],
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        
    response.set_cookie(
        NOME_COOKIE, token,
        httponly=True, samesite="lax", secure=False,
        max_age=7 * 24 * 3600,
    )
    return {"ok": True}


@router.post("/logout")
def sair(response: Response, sessao: str | None = Cookie(default=None, alias=NOME_COOKIE)):
    if sessao:
        with conexao() as con:
            encerrar_sessao(con, sessao)
    response.delete_cookie(NOME_COOKIE)
    return {"ok": True}


@router.get("/eu")
def eu(usuario=Depends(usuario_atual)):
    return usuario