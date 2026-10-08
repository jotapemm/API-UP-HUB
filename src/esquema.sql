-- =====================================================================
--  UP API HUB — esquema do banco `up_hub`
--
--  Este arquivo descreve o banco como ele existe hoje e serve para
--  recriá-lo do zero numa máquina nova:
--
--      createdb -U postgres up_hub
--      psql -U postgres -d up_hub -f src/esquema.sql
--
--  NÃO é um sistema de migração. Alterar tabela continua sendo ALTER
--  rodado à mão; depois este arquivo é atualizado para bater com o
--  banco. A verificação é objetiva e vale a pena rodar depois de mexer:
--  criar um banco vazio com este arquivo e comparar o
--  `pg_dump --schema-only` dos dois tem que dar diferença zero.
--
--  Dados não estão aqui — para dados existe o backup (backup-banco.ps1).
--
--  Convenções em vigor (ver CLAUDE.md):
--    · id       → GENERATED ALWAYS AS IDENTITY
--    · texto    → TEXT, nunca VARCHAR(n)
--    · instante → TIMESTAMPTZ, nunca TIMESTAMP
--    · status   → TEXT + CHECK, não enum (remover valor de enum dói)
--    · apagar   → booleano `ativo` em tabela de COISA; nada em tabela de
--                 FATO, porque fato não se desfaz
-- =====================================================================

-- O psql do Windows assume WIN1252 e estragaria os acentos daqui.
SET client_encoding = 'UTF8';


-- ---------------------------------------------------------------------
--  setores — fiscal, DP, contabilidade, Recuperação Tributária…
--  Agrupa gente e automações. É a unidade que a tela de suporte vai
--  usar para responder "qual setor está menos capacitado".
-- ---------------------------------------------------------------------
CREATE TABLE setores (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome       TEXT        NOT NULL UNIQUE,
    ordem      SMALLINT    NOT NULL DEFAULT 0,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------
--  usuarios — os ~30 operadores do escritório.
--
--  `papel` decide quem vê a triagem de chamados; 'suporte' é o JP.
--  `senha_hash` é Argon2 (src/auth.py) — a senha em claro nunca chega
--  ao banco. O `email` é guardado em minúsculas e sem espaços nas
--  pontas, normalizado no cadastro; quem for comparar com e-mail vindo
--  de fora tem que normalizar igual antes.
--  `foto` guarda o WEBP 256x256 já tratado (ver src/web/rotas/foto.py);
--  `foto_em` é o carimbo que a URL usa para furar o cache do navegador.
--  `setor_id` aceita nulo: dá para existir antes de ser alocado.
--
--  A ordem das colunas aqui está esquisita de propósito: `ativo` e
--  `criado_em` vêm antes de `papel`, `bio`, `foto` e `foto_em` porque
--  esses quatro entraram depois, por ALTER, e ALTER só sabe acrescentar
--  no fim. A ordem física não muda nada em SQL, mas está reproduzida
--  fielmente para que a conferência com o banco real dê zero.
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome        TEXT        NOT NULL,
    apelido     TEXT,
    email       TEXT        NOT NULL UNIQUE,
    senha_hash  TEXT        NOT NULL,
    setor_id    INTEGER     REFERENCES setores (id),
    ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    papel       TEXT        NOT NULL DEFAULT 'operador'
                            CHECK (papel IN ('operador', 'suporte')),
    bio         TEXT,
    foto        BYTEA,
    foto_em     TIMESTAMPTZ
);


-- ---------------------------------------------------------------------
--  sessoes — login vivo. O token É a identidade, então ele é a chave.
--
--  Nenhuma rota do hub aceita usuario_id no corpo: quem você é sai
--  daqui, pelo cookie up_hub_sessao. O que não tem campo não dá para
--  forjar.
--
--  ON DELETE CASCADE: conta apagada derruba os logins dela na hora.
--  Linha vencida não se apaga sozinha — ver backup-banco.ps1, que faz
--  a faxina antes do dump.
-- ---------------------------------------------------------------------
CREATE TABLE sessoes (
    token       TEXT        PRIMARY KEY,
    usuario_id  INTEGER     NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    criada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em   TIMESTAMPTZ NOT NULL,
    ip          INET,
    user_agent  TEXT
);

CREATE INDEX idx_sessoes_usuario ON sessoes (usuario_id);


-- ---------------------------------------------------------------------
--  automacoes — o catálogo: API UP, CONF, ICMS, FISCAL, STATUS,
--  EVENTOS, BANCÁRIO, CTRL CRED.
--
--  `slug` é o nome estável que o frontend usa em URL e em localStorage
--  (recentes) — por isso é UNIQUE, e por isso não se renomeia de graça.
--  `url` aceita nulo de propósito: automação catalogada que ainda não
--  tem porta aberta aparece sem botão, em vez de prometer uma porta que
--  não abre.
--  `ativa` é o soft delete: tirar do ar sem perder o histórico de
--  chamados e de uso que aponta para ela.
-- ---------------------------------------------------------------------
CREATE TABLE automacoes (
    id              INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug            TEXT        NOT NULL UNIQUE,
    nome            TEXT        NOT NULL,
    descricao       TEXT        NOT NULL,
    url             TEXT,
    palavras_chave  TEXT,
    setor_id        INTEGER     NOT NULL REFERENCES setores (id),
    ativa           BOOLEAN     NOT NULL DEFAULT TRUE,
    ordem           SMALLINT    NOT NULL DEFAULT 0,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automacoes_setor ON automacoes (setor_id);


-- ---------------------------------------------------------------------
--  chamados — suporte. Tabela de FATO: sem soft delete.
--
--  Os valores de `status` vão sem acento porque a máquina os compara;
--  quem traduz para "Em andamento" é a tela.
--  `automacao_id` aceita nulo: dá para abrir chamado sobre o hub em si.
--  As FKs para usuarios NÃO têm CASCADE, ao contrário das outras três
--  tabelas: chamado é histórico de atendimento e não some com a conta.
--  Apagar um usuário que abriu chamado falha — e falhar é o certo aqui.
--
--  `atendido_por` está no fim porque entrou depois, por ALTER, junto com
--  a triagem (mesma história da ordem em `usuarios`).
-- ---------------------------------------------------------------------
CREATE TABLE chamados (
    id             INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     INTEGER     NOT NULL REFERENCES usuarios (id),
    automacao_id   INTEGER     REFERENCES automacoes (id),
    descricao      TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'aberto'
                               CHECK (status IN ('aberto', 'em_andamento',
                                                 'resolvido', 'cancelado')),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    atendido_por   INTEGER     REFERENCES usuarios (id)
);

CREATE INDEX idx_chamados_usuario ON chamados (usuario_id);


-- ---------------------------------------------------------------------
--  favoritos — a estrela do catálogo.
--
--  Não tem id próprio: a chave é a própria pergunta que a tela faz,
--  "esta pessoa favoritou esta automação". E a ordem das colunas na
--  chave é a ordem da pergunta — usuario_id primeiro porque toda
--  consulta começa por "os favoritos DESTA pessoa".
--  `criado_em` é o que ordena a lista no perfil (mais recente primeiro).
-- ---------------------------------------------------------------------
CREATE TABLE favoritos (
    usuario_id    INTEGER     NOT NULL REFERENCES usuarios (id)   ON DELETE CASCADE,
    automacao_id  INTEGER     NOT NULL REFERENCES automacoes (id) ON DELETE CASCADE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, automacao_id)
);


-- ---------------------------------------------------------------------
--  uso — quantas execuções por pessoa, por automação, por DIA.
--
--  DATE e não TIMESTAMPTZ de propósito: a tabela sabe QUE você rodou na
--  terça, não a que horas. Não é economia de espaço, é o que torna a
--  conversa com o time possível.
--
--  O `dia` faz parte da chave. Sem ele caberia uma linha por
--  pessoa/automação na vida: o registro de amanhã colidiria com o de
--  hoje e o calendário seria impossível. (Foi exatamente o erro da
--  tabela `acessos`, que nasceu com PK (usuario_id, automacao_id) e foi
--  derrubada vazia em 06/10/2026.)
--
--  São duas perguntas, e as duas estão certas desde já:
--    · "o que ESTA PESSOA rodou"     -> o calendário do perfil, servido
--                                       pela chave primária
--    · "quanto ESTA AUTOMAÇÃO rodou" -> a tela de suporte, que não
--                                       aproveita um índice que começa
--                                       em usuario_id; daí o índice extra
--
--  Quem grava: nada ainda. A rota POST que registra uso espera a
--  conversa com o time. Tabela vazia não mede ninguém.
-- ---------------------------------------------------------------------
CREATE TABLE uso (
    usuario_id    INTEGER NOT NULL REFERENCES usuarios (id)   ON DELETE CASCADE,
    automacao_id  INTEGER NOT NULL REFERENCES automacoes (id) ON DELETE CASCADE,
    dia           DATE    NOT NULL DEFAULT current_date,
    execucoes     INTEGER NOT NULL DEFAULT 0 CHECK (execucoes >= 0),
    PRIMARY KEY (usuario_id, automacao_id, dia)
);

CREATE INDEX uso_por_automacao ON uso (automacao_id, dia);


-- ---------------------------------------------------------------------
--  uso_eventos — a memória que faz o reporte de uso ser idempotente.
--
--  A automação reporta "dispara e esquece", com timeout curto. E timeout
--  NÃO significa "não chegou": o pedido pode ter sido gravado e só a
--  resposta ter se perdido. Qualquer reenvio, então, somaria de novo.
--
--  Por isso o reporte carrega um `evento_id` — o identificador que a
--  própria automação já usa para aquilo que ela processou. O hub guarda
--  o que já viu, e o segundo reporte do mesmo evento não soma nada.
--
--  A chave é (automacao_id, evento_id) e não evento_id sozinho: duas
--  automações diferentes podem gerar o mesmo identificador sem saber uma
--  da outra, e uma não pode calar a outra.
--
--  Sem índice em `visto_em` de propósito. A limpeza (no backup-banco.ps1,
--  eventos com mais de 7 dias) roda duas vezes por dia e pode varrer a
--  tabela à vontade; índice aqui só encareceria todo INSERT, que é a
--  operação que realmente acontece a toda hora.
-- ---------------------------------------------------------------------
CREATE TABLE uso_eventos (
    automacao_id  INTEGER     NOT NULL REFERENCES automacoes (id) ON DELETE CASCADE,
    evento_id     TEXT        NOT NULL,
    visto_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (automacao_id, evento_id)
);
