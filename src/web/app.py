from pathlib import Path

from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────
# DAQUI PARA BAIXO a ordem importa. `import` EXECUTA o módulo na hora, e
# src/db.py lê os.environ["DATABASE_URL"] no topo dele. Qualquer import
# que alcance src.db antes do load_dotenv() acima derruba o servidor com
# um KeyError que não parece ter nada a ver.
# ─────────────────────────────────────────────────────────────────────
from src.db import conexao
from src.web.rotas import foto
from src.web.rotas import favoritos
from src.web.rotas import uso
from src.web.rotas.catalogo import router as rotas_catalogo
from src.web.rotas.chamados import router as rotas_chamados
from src.web.rotas.triagem import router as rotas_triagem

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.web.rotas.auth import router as rotas_auth

STATIC = Path(__file__).parent / "static"
app = FastAPI(title="UP API HUB")

@app.get("/")
def raiz():
    return RedirectResponse("/app/")


@app.get("/api/saude")
def saude():
    with conexao() as con:
        n = con.execute("SELECT count(*) AS n FROM setores").fetchone()["n"]
    return {"ok": True, "setores": n}

app.include_router(rotas_auth)
app.include_router(rotas_catalogo)
app.include_router(rotas_chamados)
app.include_router(rotas_triagem)
app.include_router(foto.router)
app.include_router(favoritos.router)
app.include_router(uso.router)

# o mount em "/" tem que ser SEMPRE a ÚLTIMA coisa do arquivo
app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")