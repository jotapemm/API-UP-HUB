import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from datetime import datetime, timedelta, timezone

_ph = PasswordHasher()
DURACAO_SESSAO = timedelta(days=7)


def gerar_hash(senha: str) -> str:
    return _ph.hash(senha)


def conferir(hash_guardado: str, senha: str) -> bool:
    try:
        _ph.verify(hash_guardado, senha)
        return True
    except (VerificationError, VerifyMismatchError):
        return False
    

def criar_sessao(con, usuario_id: int, ip: str | None, user_agent: str | None) -> str:
    token = secrets.token_urlsafe(32)
    expira_em = datetime.now(timezone.utc) + DURACAO_SESSAO 
    con.execute(
        """INSERT INTO sessoes (token, usuario_id, expira_em, ip, user_agent)
           VALUES (%s, %s, %s, %s, %s)""",(token, usuario_id, expira_em, ip, user_agent),   
    )
    return token


def usuario_da_sessao(con, token: str) -> dict | None:
    return con.execute(
        """SELECT u.id, u.nome, u.apelido, u.email, u.setor_id
           FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
           WHERE s.token = %s AND s.expira_em > now() AND u.ativo""",
           (token,),
    ).fetchone()
    
    
def encerrar_sessao(con, token: str) -> None:
    con.execute("DELETE FROM sessoes WHERE token = %s", (token,))