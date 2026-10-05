from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from PIL import Image, UnidentifiedImageError

from src.db import conexao
from src.web.seguranca import usuario_atual

router = APIRouter(prefix="/api", tags=["foto"])

# Teto de ENTRADA. Foto de celular vem grande, mas 4 MB é limite, não convite.
LIMITE_BYTES = 4 * 1024 * 1024
PEDACO = 64 * 1024
MAX_PIXELS = 40_000_000         # ~40 megapixels. Se passar disso, é suspeito de ataque DoS
LADO = 256                      # o retrato que sai, sempre quadrado


async def ler_com_teto(arquivo: UploadFile) -> bytes:
    """Lê em pedaços e desiste assim que passa do teto.

    Ler tudo e medir depois chegaria tarde: os bytes já estariam na
    memória, que é justamente o que a gente queria evitar.
    """
    pedacos, total = [], 0
    while True:
        pedaco = await arquivo.read(PEDACO)
        if not pedaco:
            break
        total += len(pedaco)
        if total > LIMITE_BYTES:
            raise HTTPException(413, "A imagem passa de 4 MB.")
        pedacos.append(pedaco)
    return b"".join(pedacos)


def virar_retrato(bruto: bytes) -> bytes:
    """Abre, corta em quadrado, reduz e GRAVA DE NOVO.

    Gravar de novo é o que valida de verdade: se não for imagem, não abre.
    E o arquivo que sai não leva EXIF junto — EXIF de celular tem GPS.
    """
    try:
        img = Image.open(BytesIO(bruto))
        
        # Image.open só leu o CABEÇALHO. Dá para perguntar o tamanho antes
        # de decodificar — é aqui que a bomba de descompressão morre.
        if img.width * img.height > MAX_PIXELS:
            raise HTTPException(413, "A imagem tem mais de 40 megapixels.")
        
        img.load()                       # agora sim decodifica
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(422, "Não consegui ler este item como imagem")
    
    img = img.convert("RGB")          # descarta alfa, paleta e CMYK
    
    # corte central quadrado, para não achatar o rosto de ninguém
    lado = min(img.size)
    x = (img.width - lado) // 2
    y = (img.height - lado) // 2
    img = img.crop((x, y, x + lado, y + lado)).resize((LADO, LADO), Image.LANCZOS)
    
    saida = BytesIO()
    img.save(saida, format="WEBP", quality=80, method=6)
    return saida.getvalue()


@router.post("/eu/foto")
async def enviar_foto(arquivo: UploadFile = File(...), usuario=Depends(usuario_atual)):
    bruto = await ler_com_teto(arquivo)
    if not bruto:
        raise HTTPException(422, "Arquivo vazio")
    
    retrato = virar_retrato(bruto)
    
    with conexao() as con:
        linha = con.execute(
            """UPDATE usuarios SET foto = %s, foto_em = now()
               WHERE id = %s
               RETURNING foto_em""",
            (retrato, usuario["id"]),
        ).fetchone()
        
    # Devolve o carimbo novo. É ele que troca o ?v= lá na tela e faz o
    # navegador buscar a imagem nova em vez de servir a antiga.
    return {"foto_em": linha["foto_em"].isoformat()}


@router.delete("/eu/foto")
def remover_foto(usuario=Depends(usuario_atual)):
    with conexao() as con:
        con.execute(
            "UPDATE usuarios SET foto = NULL, foto_em = NULL WHERE id = %s",
            (usuario["id"],),
        )
    return {"foto_em": None}


@router.get("/usuarios/{usuario_id}/foto")
def ver_foto(usuario_id: int, _=Depends(usuario_atual)):
    """A foto é do hub, não da internet: sem sessão, 401.

    O tipo da resposta é ESCRITO aqui, nunca o que veio no upload. Se a
    gente ecoasse, quem envia escolheria como o navegador interpreta.
    """
    with conexao() as con:
        linha = con.execute(
            "SELECT foto FROM usuarios WHERE id = %s AND ativo",
            (usuario_id,),
        ).fetchone()
        
    if not linha or not linha["foto"]:
        raise HTTPException(404, "Sem foto.")
    
    return Response(
        # bytea volta como memoryview; o Response quer bytes
        content=bytes(linha["foto"]),
        media_type="image/webp",
        headers={
            # O endereço carrega ?v=<carimbo>, então ESTE endereço nunca
            # muda de conteúdo — pode cachear para sempre
            "Cache-Control": "public, max-age=31536000, immutable",
            # proíbe o navegador de adivinhar outro tipo
            "X-Content-Type-Options": "nosniff",
        },
    )