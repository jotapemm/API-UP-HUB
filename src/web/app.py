from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from src.db import conexao

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.web.rotas.auth import router as rotas_auth

STATIC = Path(__file__).parent / "static"
app = FastAPI(title="UP API HUB")


@app.get("/api/saude")
def saude():
    with conexao() as con:
        n = con.execute("SELECT count(*) AS n FROM setores").fetchone()["n"]
    return {"ok": True, "setores": n}

app.include_router(rotas_auth)

# o mount em "/" tem que ser SEMPRE a ÚLTIMA coisa do arquivo
app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")