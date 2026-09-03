from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

_ph = PasswordHasher()


def gerar_hash(senha: str) -> str:
    return _ph.hash(senha)


def conferir(hash_guardado: str, senha: str) -> bool:
    try:
        _ph.verify(hash_guardado, senha)
        return True
    except (VerificationError, VerifyMismatchError):
        return False