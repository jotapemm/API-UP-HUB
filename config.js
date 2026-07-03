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
