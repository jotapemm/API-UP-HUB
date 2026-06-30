# UP API HUB — Acesso externo (mesmo Cloudflare Tunnel da API-UP)

Objetivo: hub e API-UP **sob o mesmo domínio** → o navegador compartilha o
cookie de sessão → o usuário **loga uma vez** (pelo hub) e o "Saiba mais"
entra direto na API-UP, **sem ver o login de novo**.

## Por que precisa ser o mesmo domínio

O cookie de sessão da API-UP é `SameSite=Strict`. O navegador só o **envia**
entre origens que são o **"mesmo site"** (mesmo domínio registrável). Dois
**subdomínios do mesmo domínio** contam como o mesmo site:

```
https://hub.suaempresa.com.br     ─┐                      ┌─> http://localhost:8090   (start_hub.bat)
                                    ├─ Cloudflare (1 tunnel)─┤
https://upapi.suaempresa.com.br   ─┘                      └─> https://localhost:8000  (run_web.bat)
```

> Importante: o que vale é a URL **pública** que o navegador vê (ambas em
> `suaempresa.com.br`). O `http://localhost:8090` local é invisível — quem faz
> o HTTPS válido é a borda do Cloudflare.

## Pré-requisito

O tunnel da API-UP já criado e funcionando — ver `API-UP/cloudflare/DEPLOY.md`.
Aqui a gente só **adiciona o hub como 2º hostname no MESMO tunnel**.

## Passo a passo

1. **Suba os dois servidores locais:**
   - `API-UP\bat\run_web.bat`  → API-UP em `https://localhost:8000`
   - `API-UP-HUB\start_hub.bat` → hub em `http://localhost:8090`

2. **Edite o `config.yml` do tunnel** (o mesmo da API-UP) para ter os dois
   ingress — use `cloudflare\config.example.yml` (ao lado) como base.

3. **Crie o DNS dos dois subdomínios** (aponte ambos para o mesmo tunnel):
   ```powershell
   cloudflared tunnel route dns upapi upapi.suaempresa.com.br
   cloudflared tunnel route dns upapi hub.suaempresa.com.br
   ```

4. **Aponte o hub para a API-UP** — em `config.js`:
   ```js
   window.API_UP_URL = "https://upapi.suaempresa.com.br";
   ```

5. **Suba o tunnel** (`API-UP\bat\run_tunnel.bat`) e teste:
   `https://hub.suaempresa.com.br` → "Entrar" → "Saiba mais" deve abrir a
   API-UP **já logado**.

## O que já funciona só com isso (zero mudança na API-UP)

- ✅ **Login único:** logar pelo hub grava a sessão; "Saiba mais" entra na
  API-UP sem novo login.
- ✅ **Gate:** deslogado, "Saiba mais" leva pra tela de login do hub.

## Opcional — experiência 100% (2 ajustes pequenos na API-UP)

Estes dependem de o navegador deixar o **JavaScript do hub** (origem
`hub.suaempresa.com.br`) ler respostas da API-UP (`upapi...`) — o que exige
CORS com credenciais. Tudo abaixo é mexer na **API-UP**, não no hub.

### a) Status "ao vivo" + botão "Sair" funcionando pelo hub

No `.env` da API-UP:
```
UPAPI_CORS_ORIGINS=https://hub.suaempresa.com.br
```
E em `API-UP/src/web/app.py`, no `CORSMiddleware`, permitir credenciais
**quando há origem específica** (não usar com `*`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=_CORS_ORIGINS != ["*"],   # ← adicionar
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### b) "Entrar/Cadastrar" do header voltar pro hub (em vez de cair na API-UP)

Hoje, após o login, a API-UP redireciona para `/` (a própria API-UP). Para
voltar ao hub, dá pra aceitar um `next` no `/login` (com allowlist, pra evitar
open-redirect). É uma mudança de ~5 linhas — peça que eu faço quando o domínio
estiver pronto.

> Sem esses dois ajustes, o essencial (login único + Saiba mais sem re-login)
> já funciona; o que fica no modo "dica local" é só o status ao vivo e o logout
> pelo botão do hub.
