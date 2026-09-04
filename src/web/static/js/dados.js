/* ═══════════════════════════════════════════════════════════════════
   Catálogo das automações — a ÚNICA fonte de verdade do protótipo.
   A sidebar, a busca e os recentes leem daqui. Nada de lista repetida
   em três lugares: quando entrar uma automação nova, muda só este
   arquivo.

   No hub definitivo isto deixa de ser um .js e vira uma resposta do
   backend (GET /api/automacoes). O formato de cada item já foi
   desenhado pensando nisso — é o JSON que a rota vai devolver.
   ═══════════════════════════════════════════════════════════════════ */

window.SETORES = [
  {
    nome: "Contabilidade",
    itens: []
  },
  {
    nome: "Departamento Pessoal",
    itens: [
      {
        id: "eventos",
        nome: "API EVENTOS",
        desc: "Importação de eventos do DP para o QUESTOR",
        urlVar: "API_EVENTOS_URL",
        busca: "eventos dp questor importacao folha"
      }
    ]
  },
  {
    nome: "Financeiro",
    itens: []
  },
  {
    nome: "Fiscal",
    itens: [
      {
        id: "fiscal",
        nome: "API FISCAL",
        desc: "Correção de ICMS monofásico nos itens da escrituração",
        urlVar: "API_FISCAL_URL",
        busca: "fiscal icms monofasico correcao escrituracao"
      },
      {
        id: "icms",
        nome: "API ICMS",
        desc: "Recuperação de ICMS-ST a partir dos registros de apuração",
        urlVar: "API_ICMS_URL",
        busca: "icms st substituicao tributaria recuperacao apuracao"
      },
      {
        id: "bancario",
        nome: "API BANCÁRIO",
        desc: "Lê o extrato bancário em XLSX e gera os lançamentos do QUESTOR",
        urlVar: "API_BANCARIO_URL",
        busca: "bancario extrato xlsx lancamentos questor banco"
      }
    ]
  },
  {
    nome: "Gerência",
    itens: [
      {
        id: "status",
        nome: "API STATUS",
        desc: "Painel de acompanhamento das entregas por cliente",
        urlVar: "API_STATUS_URL",
        busca: "status painel entregas clientes acompanhamento cnd"
      }
    ]
  },
  {
    nome: "Recuperação Tributária",
    itens: [
      {
        id: "apiup",
        nome: "API UP",
        desc: "Processa e transfere dados entre ECD, EFD Contribuições e EFD ICMS",
        urlVar: "API_UP_URL",
        busca: "up ecd efd contribuicoes icms transferencia automacao fiscal"
      },
      {
        id: "conf",
        nome: "API CONF",
        desc: "Confere o EFD: valida CNPJ x nome no F100 e sinaliza divergências",
        urlVar: "API_CONF_URL",
        busca: "conf conferencia efd cnpj f100 divergencia validacao"
      },
      {
        id: "ctrl",
        nome: "API CTRL CRED",
        desc: "Lê os PDFs do SPED e consolida o crédito apurado em planilha",
        urlVar: "API_CTRL_URL",
        busca: "ctrl credito sped pdf planilha consolidacao"
      }
    ]
  }
];

/* Os itens de AJUDA e USO também entram na busca — quem digita
   "chamado" tem que achar o chamado, não só automação. */
window.PAGINAS = [
  { id: "chamado", nome: "Chamado", grupo: "Ajuda", desc: "Abrir um chamado para o time da UP", busca: "chamado ticket suporte problema erro ajuda" },
  { id: "sobre", nome: "Sobre as API's", grupo: "Ajuda", desc: "O que cada automação faz", busca: "sobre apis o que faz documentacao" },
  { id: "solucoes", nome: "Soluções", grupo: "Ajuda", desc: "Respostas para os problemas mais comuns", busca: "solucoes faq problemas comuns duvidas" },
  { id: "requerir", nome: "Requerir automação", grupo: "Ajuda", desc: "Pedir uma automação nova para o seu setor", busca: "requerir pedir nova automacao solicitar desenvolvimento" },
  { id: "treinamento", nome: "Treinamento", grupo: "Uso", desc: "Como operar as automações do seu setor", busca: "treinamento aprender curso capacitacao" },
  { id: "como-chamado", nome: "Como solicitar um chamado?", grupo: "Uso", desc: "O passo a passo do chamado", busca: "como solicitar chamado passo a passo tutorial" },
  { id: "uso-automacoes", nome: "Uso das automações", grupo: "Uso", desc: "Manual de uso, automação por automação", busca: "uso manual instrucoes operar" }
];
