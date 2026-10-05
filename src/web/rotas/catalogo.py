from fastapi import APIRouter, Depends

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["catalogo"])


@router.get("/automacoes")
def listar_automacoes(usuario=Depends(usuario_atual)):
    with conexao() as con:
        linhas = con.execute("""
            SELECT s.id   AS setor_id, 
                   s.nome AS setor, a.id, 
                   a.slug, a.nome, a.descricao, 
                   a.url, a.palavras_chave,
                   (f.usuario_id IS NOT NULL) AS favorita
                   
            FROM setores s
            LEFT JOIN automacoes a ON a.setor_id = s.id AND a.ativa
            -- O segundo LEFT JOIN traz "esta automacao e favorita DESTE
            -- usuario". O usuario entra na CONDICAO do join, nunca no
            -- WHERE: no WHERE o LEFT vira INNER em silencio e sumiriam
            -- todas as automacoes que a pessoa ainda nao favoritou.
            LEFT JOIN favoritos f ON f.automacao_id = a.id
                                 AND f.usuario_id = %s
            ORDER BY s.ordem, s.nome, a.ordem, a.nome                  
            """, (usuario["id"],)).fetchall()
        
    setores = []
    for l in linhas:
        if not setores or setores[-1]["id"] != l["setor_id"]:
            setores.append({"id": l["setor_id"], "nome": l["setor"], "automacoes": []})
            
        if l["slug"] is not None:
            setores[-1]["automacoes"].append({
                "id": l["id"],
                "slug": l["slug"],
                "nome": l["nome"],
                "descricao": l["descricao"],
                "url": l["url"],
                "palavras_chave": l["palavras_chave"],
                "favorita": l["favorita"],
            })
            
    return setores