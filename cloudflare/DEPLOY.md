# UP API HUB — Acesso externo (um Cloudflare Tunnel para HUB + API-UP + CONF + CTRL-CRED)

Objetivo: os serviços **sob o mesmo domínio** → o navegador compartilha o
cookie de sessão → o usuário **loga uma vez** (pelo hub) e o "Saiba mais" das
automações entra direto, **sem ver o login de novo**. Cada automação (CONF,
CTRL-CRED, …) entra no mesmo tunnel como mais um subdomínio.

## Por que precisa ser o mesmo domínio

O cookie de sessão da API-UP é `SameSite=Strict`. O navegador só o **envia**
entre origens que são o **"mesmo site"** (mesmo domínio registrável). Dois
**subdomínios do mesmo domínio** contam como o mesmo site:

```
https://hub.suaempresa.com.br    ─┐                       ┌─> http://localhost:8090   (start_hub.bat · HUB)
https://upapi.suaempresa.com.br  ─┤                       ├─> https://localhost:8000  (run_web.bat · API-UP)
https://conf.suaempresa.com.br   ─┼─ Cloudflare (1 tunnel)─┼─> http://localhost:8010   (CONF)
https://ctrl.suaempresa.com.br   ─┘                       └─> http://localhost:8100   (CTRL-CRED)
```

> Importante: o que vale é a URL **pública** que o navegador vê (todas em
> `suaempresa.com.br`). Os `localhost:*` locais são invisíveis — quem faz o
> HTTPS válido é a borda do Cloudflare. Por isso o **IP local da máquina pode
> mudar à vontade** que nada quebra (o `cloudflared` faz conexão de saída).

## Pré-requisito

O tunnel da API-UP já criado e funcionando — ver `API-UP/cloudflare/DEPLOY.md`.
Aqui a gente só **adiciona o hub e a CONF como hostnames no MESMO tunnel**.

## Passo a passo

1. **Suba os servidores locais:**
   - `API-UP\bat\run_web.bat`      → API-UP em `https://localhost:8000`
   - CONF → `http://localhost:8010`
   - CTRL-CRED → `python servir_web.py` (`http://localhost:8100`)
   - `API-UP-HUB\start_hub.bat`    → hub em `http://localhost:8090`

2. **Edite o `config.yml` do tunnel** (o mesmo da API-UP) para ter todos os
   ingress — use `cloudflare\config.example.yml` (ao lado) como base.

3. **Crie o DNS dos subdomínios** (todos apontam para o mesmo tunnel):
   ```powershell
   cloudflared tunnel route dns upapi upapi.suaempresa.com.br
   cloudflared tunnel route dns upapi hub.suaempresa.com.br
   cloudflared tunnel route dns upapi conf.suaempresa.com.br
   cloudflared tunnel route dns upapi ctrl.suaempresa.com.br
   ```

4. **Aponte o hub para os backends** — em `config.js`:
   ```js
   window.API_UP_URL   = "https://upapi.suaempresa.com.br";
   window.API_CONF_URL = "https://conf.suaempresa.com.br";
   window.API_CTRL_URL = "https://ctrl.suaempresa.com.br";
   ```

5. **Suba o tunnel** (`API-UP\bat\run_tunnel.bat`) e teste:
   `https://hub.suaempresa.com.br` → "Entrar" → "Saiba mais" deve abrir a
   API-UP **já logado**; o card da CONF passa a mostrar "online".

## O que já funciona só com isso (zero mudança nos backends)

- ✅ **Login único:** logar pelo hub grava a sessão; "Saiba mais" entra na
  API-UP sem novo login.
- ✅ **Gate:** deslogado, "Saiba mais" leva pra tela de login do hub.
- ✅ **CONF acessível** pelo card (link "Saiba mais" → `conf.suaempresa.com.br`).

## Ajustes na API-UP para a experiência 100%

O `/login` já aceita `next` (voltar pro hub após logar). Falta só **autorizar
a origem do hub** — no `.env` da API-UP:
```
UPAPI_HUB_ORIGINS=https://hub.suaempresa.com.br
```

Para o **status "ao vivo"** e o **botão "Sair"** funcionarem cross-subdomínio
(JS do hub lendo a API-UP), habilite CORS com credenciais em
`API-UP/src/web/app.py`:
```python
UPAPI_CORS_ORIGINS=https://hub.suaempresa.com.br      # no .env

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=_CORS_ORIGINS != ["*"],   # ← adicionar
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> Sem esses ajustes, o essencial (login único + Saiba mais sem re-login) já
> funciona; o que fica no modo "dica local" é só o status ao vivo e o logout
> pelo botão do hub.

## Login único entre as automações (SSO)

Objetivo: **um usuário criado no hub vale em todas as automações**, e ele loga
**uma vez só** — ao abrir a API-UP ou a CONF, não precisa relogar.

O modelo é ter **uma única fonte de identidade** (a **API-UP** é o "dono" do
login: `usuarios.json` + `/login` + `/cadastro`) e fazer as outras apps
**confiarem na mesma sessão**. Não é preciso duplicar usuários — a CONF não
precisa do seu próprio `usuarios.json` no modo SSO; ela só valida o cookie.

Três peças (todas ativam quando tudo está no mesmo domínio, via tunnel):

1. **Mesmo domínio de cookie.** No `.env` da API-UP:
   ```
   UP_COOKIE_DOMAIN=.suaempresa.com.br
   ```
   Assim o cookie `upapi_session` é enviado para `hub.`, `upapi.` e `conf.`
   (já implementado no `app.py`; vazio = host-only, como hoje na LAN).

2. **Mesmo segredo de assinatura.** A sessão é um token assinado por HMAC. Para
   a CONF aceitar um token emitido pela API-UP, as duas precisam do MESMO
   `UP_API_SECRET`. Gere uma vez e cole nos dois `.env`:
   ```
   python -c "import secrets; print(secrets.token_hex(32))"
   UP_API_SECRET=<mesmo_valor_nas_duas>
   ```

3. **A CONF valida o cookie compartilhado.** No backend da CONF, o middleware de
   auth deve: ler o cookie `upapi_session`, validar com o mesmo `UP_API_SECRET`
   e o mesmo formato de token (`<emitido_em>.<nonce>.<hmac_sha256>`); se válido,
   libera; se ausente/inválido, manda pro login do hub. Ou seja, a CONF passa a
   **reaproveitar a sessão da API-UP** em vez de ter login próprio. (O login/
   `usuarios.json` locais da CONF viram só fallback para uso standalone na LAN.)

Com isso: cadastro pelo hub → grava na API-UP → login uma vez → cookie `.dominio`
→ hub, API-UP e CONF reconhecem a mesma sessão. Zero re-login.

## Observações sobre a CONF

- A CONF roda **local** porque precisa dos arquivos no drive da UP (`Z:`) —
  por isso entra via tunnel na máquina da UP, e **não** faz sentido movê-la
  para um VPS (a não ser migrando os dados junto).
- Hoje a porta é **8010** em HTTP (definida no `config.js`). Se a CONF passar
  a rodar HTTPS (mkcert), troque o ingress para `https://localhost:8010` com o
  bloco `originRequest` (noTLSVerify + httpHostHeader), igual à API-UP.
- Se no futuro a CONF reusar o login da API-UP (sessão única), ela precisa
  estar no mesmo domínio — o que este esquema de subdomínios já garante.
