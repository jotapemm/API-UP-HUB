/* ════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO CENTRAL DO HUB
   ────────────────────────────────────────────────────────────────
   Endereço da API-UP — usado pelo "Saiba mais", pelo login e pelo
   cadastro. Troque AQUI (um lugar só) conforme onde tudo está rodando:

   • Mesma máquina:        "https://localhost:8000"
   • Rede local (LAN):     "https://192.168.0.117:8000"
   • Internet (tunnel):    "https://upapi.suaempresa.com.br"

   IMPORTANTE: como o login reaproveita o backend da API-UP (sessão por
   cookie), o ideal é que o HUB e a API-UP estejam no MESMO domínio/origem
   (ex.: ambos atrás do mesmo Cloudflare Tunnel, ou ambos na LAN). Em
   origens diferentes o navegador não compartilha o cookie de sessão.
   ════════════════════════════════════════════════════════════════ */
window.API_UP_URL = "https://192.168.0.117:8000";

/* ────────────────────────────────────────────────────────────────
   Endereço da API-UP-CONF (conferência fiscal) — usado pelo card
   "API CONF" (botão "Saiba mais" + status online/offline).
   A CONF roda LOCAL (precisa dos arquivos no drive da UP) e é
   exposta via Cloudflare Tunnel — NÃO vai pro Vercel.

   • Rede local (LAN):     "http://192.168.0.117:8010"
   • Internet (tunnel):    "https://conf.suaempresa.com.br"

   Obs.: o "status online" pinga essa URL. Se o HUB estiver em HTTPS
   (Vercel) e a CONF em http:// (LAN), o navegador bloqueia o ping
   (mixed content) e mostra "desligado" — mas o link "Saiba mais"
   (nova aba) funciona mesmo assim. Em produção, use a URL https do
   tunnel dos dois lados e o status volta a funcionar.
   ──────────────────────────────────────────────────────────────── */
window.API_CONF_URL = "http://192.168.0.117:8010";

/* ────────────────────────────────────────────────────────────────
   Endereço da API-UP-CTRL-CRED (controle de crédito do SPED) — usado
   pelo card "API CTRL CRED". Roda LOCAL (porta 8100) e é exposta via
   Cloudflare Tunnel — NÃO vai pro Vercel. Mesmo detalhe de mixed-content
   do status que a CONF (ver acima).

   • Rede local (LAN):     "http://192.168.0.117:8100"
   • Internet (tunnel):    "https://ctrl.suaempresa.com.br"
   ──────────────────────────────────────────────────────────────── */
window.API_CTRL_URL = "http://192.168.0.117:8100";

/* ────────────────────────────────────────────────────────────────
   Outras automações com interface web (LAN por ora — trocar pelos
   subdomínios do tunnel em produção). Os servidores ainda podem não
   estar no ar: o status mostra "desligado" e o "Saiba mais" só abre
   quando o servidor correspondente estiver rodando.
     • API FISCAL  (Correção ICMS Monofásico) ...... porta 8030
     • API-ICMS    (Recuperação ICMS-ST) ........... porta 8040
     • API STATUS  (painel de status) .............. porta 8010 (⚠ mesma da CONF)
     • API EVENTOS (Importação DP → QUESTOR) ....... sem servidor ainda
   ──────────────────────────────────────────────────────────────── */
window.API_FISCAL_URL = "http://192.168.0.117:8030";
window.API_ICMS_URL = "http://192.168.0.117:8040";
window.API_STATUS_URL = "http://192.168.0.117:8010";
// API EVENTOS: frontend já publicado no Vercel (o backend é que ainda depende
// do tunnel pra funcionar 100%, mas o "Saiba mais" já abre a interface).
window.API_EVENTOS_URL = "https://apieventos-gules.vercel.app/";

// API BANCÁRIO (Extrato → QUESTOR): leitura de XLSX bancário. Só frontend
// estático por ora — preencher com a URL (Vercel/tunnel) quando existir.
window.API_BANCARIO_URL = "";
