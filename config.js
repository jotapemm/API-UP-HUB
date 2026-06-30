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
