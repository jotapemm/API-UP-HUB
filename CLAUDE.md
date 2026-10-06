# UP API HUB — como trabalhar neste projeto

Este arquivo existe para que uma sessão nova chegue com o mesmo jeito de
trabalhar que construímos aqui. Leia antes de mexer em qualquer coisa.

---

## Quem está do outro lado

João Pedro (JP) — está aprendendo enquanto constrói. Já sabe mais do que
pensa: escreveu sozinho o backend de autenticação, o canvas de pontos do
login, a gaveta em React e a triagem de chamados. Trava às vezes e já teve
um episódio de desânimo forte ("eu estudo estudo e no final não sei de
nada"). Quando isso acontecer, **não responda com perguntas socráticas** —
dê um apoio concreto: liste a evidência do que ele já fez, entregue o
código corrigido mostrando que a diferença era pequena, e quebre o próximo
passo em pedaços menores.

Fala português do Brasil, informal. Responda no mesmo registro.

## O modo de trabalho

**A divisão combinada em 01/10/2026:**

- **Assunto novo → juntos.** Você explica, passa o código, ele digita, e
  então você **mede o resultado**.
- **Repetição do que ele já domina → você faz.** Rota com guarda de sessão,
  vista por estado, formulário com três avisos, classe que o CSS anima.
  Refazer à mão o que já foi aprendido só gasta tempo dele.

Na dúvida sobre em qual lado algo cai, pergunte. E mesmo no que você fizer
sozinho, explique o que for novo antes de entregar.

O backlog atual, com essa marcação item a item, está em `SPRINT.md`.

**Ações mecânicas são suas:** git, consultas ao banco, subir/derrubar
servidor de teste, medições, builds quando pedido.

**Medir, nunca supor.** Esta é a regra que mais rendeu na sessão inteira.
Antes de afirmar que algo está quebrado, prove: `getComputedStyle`,
`getBoundingClientRect`, consultas diretas ao Postgres, `performance.now()`,
contagem de listeners, `netstat`. Mostre o número. Quando o teste der um
resultado estranho, **desconfie primeiro do teste** — isso aconteceu várias
vezes e sempre foi o teste. A causa mais frequente, medida em
01 e 02/10/2026: **painel do navegador escondido não gera quadro**, e sem
quadro `requestAnimationFrame` congela, transição de CSS não avança e o
canvas não repinta — o número fica parado e parece bug no código. Tirar um
screenshot força um quadro e destrava a medição.

**Prova exige antes e depois.** Uma medição só vale se existe comparação.

**Erre em voz alta.** Quando você estiver errado, diga diretamente, corrija,
e siga. Aconteceu várias vezes nesta sessão (o reinício automático do
Agendador, o cabeçalho do log que o redirecionamento apagava, a mensagem
apontando um arquivo que não existia). Registrar o erro no documento onde
ele mora é melhor que explicar de novo depois.

**Teste o caminho ruim.** Senha curta, campo vazio, servidor fora, duplo
Enter, sessão de outro usuário, SQL injection no parâmetro de ordenação.
Metade dos bugs encontrados aqui só apareceram assim.

**Limpe o que sujar.** Sessões e usuários criados para teste são apagados
no fim; dados do JP são restaurados ao estado original. Sempre.

---

## O que é o projeto

Hub interno da UP Recuperação Tributária: uma porta única para as
automações fiscais da empresa (API UP, CONF, ICMS, FISCAL, STATUS, EVENTOS,
BANCÁRIO, CTRL CRED), com login, busca, chamados e triagem.
Usuários: ~30 operadores de escritório (fiscal, DP, contabilidade).

### Stack e lugares

| peça | onde |
|---|---|
| backend | FastAPI, `src/web/app.py` + `src/web/rotas/*.py` |
| banco | PostgreSQL `up_hub`, acesso via `psycopg` em `src/db.py` |
| login/cadastro | `src/web/static/entrar.html` — **vanilla, não migra** |
| app shell | React + TS + Vite em `frontend/`, build em `src/web/static/app/` |
| serviço | tarefa agendada chamando `iniciar-hub.ps1` (ver `INSTALAR-SERVICO.md`) |
| porta | 8090 (dev do Vite: 5173, com proxy no `vite.config.ts`) |

### Tabelas

`setores`, `usuarios`, `sessoes`, `automacoes`, `chamados`.
A sexta — `acessos` — **foi adiada por decisão do JP**, até que o time saiba
que o uso seria registrado. Não crie sem retomar essa conversa.

---

## Armadilhas desta máquina (todas custaram tempo real)

**"Mudei e não refletiu" tem três causas. Cheque nesta ordem:**

1. **O build falhou em silêncio.** `npm run build` roda `tsc -b` antes do
   `vite build`. Se o TS falha, o Vite nunca roda e a pasta de saída fica
   intacta — o site continua servindo a versão antiga, sem erro algum.
2. **Cache do navegador nos arquivos vanilla.** `entrar.js`, `app.js`,
   `base.css` têm nome fixo. Sintoma: stack trace apontando uma linha que
   já não existe. Ctrl+Shift+R.
3. **Cache do `app/index.html`.** O hash protege os bundles, mas o HTML que
   aponta para eles tem nome fixo e também cacheia.


**O `base.css` é LINKADO, nunca importado.** Ele já foi `import` dentro do
`main.tsx`, e isso criava duas cópias: o arquivo servido em `/css/base.css`
e outra assada dentro do bundle — mudar o arquivo não refletia no hub sem
build. Pior: o minificador do Vite (Lightning CSS) **reescrevia**
`light-dark()` num polyfill de `var()` cujo gatilho é
`@media (prefers-color-scheme)`, ou seja, a preferência do **sistema**. O
seletor de tema mexe em `color-scheme`, que o polyfill ignora — o login
funcionava e o hub não. As duas telas agora linkam o mesmo arquivo cru.
Medido em 01/10/2026.

**Caminho absoluto no `index.html` não se comporta igual nas duas pontas.**
Em DEV o Vite prefixa o `base` neles: `/js/tema.js` vira `/app/js/tema.js` e
dá 404. No build ele deixa como está. O `vite.config.ts` tem duas regras de
proxy (`/app/js` e `/app/css`) só para desfazer esse prefixo em dev.

**O hub não pode morrer por causa de script fora do bundle.** O `tema.js`
não é módulo e não entra no bundle; um 404 nele derrubava a aplicação
inteira em tela branca, porque `window.UPTema.ler()` estourava dentro de um
`useState`. Por isso `UPTema` é declarado **opcional** no `Window` e todo
uso leva `?.` — com o arquivo ausente o hub sobe sem seletor de tema, em vez
de não subir. Testado removendo o arquivo.

**`light-dark()` só funciona no `base.css`.** O `App.css` passa pelo
minificador do Vite, que converte `light-dark(a, b)` num polyfill
`var(--lightningcss-light, a) var(--lightningcss-dark, b)`. Essas variáveis
seriam definidas num `:root` gerado junto — mas o `base.css`, que as traria,
saiu do bundle. Resultado: declaração inválida e a propriedade cai no valor
inicial, **sem erro nenhum** (um `background` vira `transparent`). Dentro do
`App.css` o caminho é o `[data-tema]`. Medido em 06/10/2026, no calendário.

**`color-scheme` só resolve COR.** `light-dark()` serve `<color>` e mais
nada. Filtro, troca de imagem, estilo de borda — nada disso enxerga o tema.
Para esses casos o `tema.js` escreve um `data-tema` no `<html>`, e o CSS
se pendura nele. Esse atributo é a única razão de o `tema.js` precisar de
um listener de `matchMedia` — as cores não precisam.

**O projeto mora num disco de rede** (`\\192.168.0.50\dados`, mapeado em
`Z:`). Consequências medidas: build de 15s virou 2min, o hub leva ~2min
para subir (imports pela rede), travas órfãs do git aparecem, e o disco
já encheu uma vez e derrubou tudo. **Mover para `C:` é a pendência de maior
retorno** — está anotada e ainda não foi feita.

**Rota nova exige reiniciar o servidor.** O uvicorn lê o Python na subida.
Sintoma característico: **405 Method Not Allowed** (não 404), porque o
`mount("/")` apanha tudo e só aceita GET.

**Com a tarefa agendada ativa, não suba o hub à mão** — os dois brigam pela
porta 8090. Use `schtasks /end` + `/run`.

---

## Convenções que já estão de pé

**Banco:** `GENERATED ALWAYS AS IDENTITY`, `TEXT` (nunca `VARCHAR(n)`),
`TIMESTAMPTZ` (nunca `TIMESTAMP`), status como `TEXT` + `CHECK` (não enum,
porque remover valor de enum é doloroso), soft delete com booleano em tabelas
de *coisas* e nada disso em tabelas de *fatos*.
Valores que a máquina compara vão sem acento (`em_andamento`); a tela
traduz.

**`LEFT JOIN` é o padrão sempre que a coluna do join aceita nulo.** E o
filtro vai na condição do JOIN, não no `WHERE` — no `WHERE` ele transforma
o LEFT em INNER silenciosamente e some com linhas inteiras.

**Identidade vem da sessão, nunca do corpo.** Nenhuma rota aceita
`usuario_id`; o que não tem campo não tem como ser forjado.

**Códigos HTTP com significado único:**
- `401` = não sei quem você é → a tela manda pro login
- `403` = sei quem você é e você não pode
- `422` = o corpo que você mandou não serve (inclui "senha atual incorreta")

**`PUT` quando o formulário manda tudo; `PATCH` só com `model_fields_set`.**
Em JSON, "mandei null" e "não mandei" chegam iguais como `None`.

**Parâmetro que vira estrutura de SQL** (coluna, direção) nunca é
interpolado: vira chave de um dicionário fechado escrito no código. `%s`
só serve para valores.

**Frontend:** estado troca classe, o CSS anima. Nomes de classe sem acento.
Tudo que esconde visualmente (`opacity`, `transform`, `grid-template-rows:
0fr`) continua no Tab — use `inert` junto, sempre. O `base.css` é
compartilhado (hub + entrar.html); o `App.css` é só do React.

**Não prometa porta que não abre.** Item de menu que leva a `#`, mensagem
que anuncia tela inexistente, dica que descreve função que não existe —
tudo isso foi cortado de propósito ao longo da sessão.

---

## Linguagem visual

Tokens no `:root` do `base.css`. Fundo preto, verde `--brand: #00C48C`.
A logo PNG é **prateada** — o verde da marca é só CSS.

Regras assumidas:
- **Um elemento verde em movimento por tela.** O wordmark fica parado; quem
  brilha é o nome do usuário (classe `.brilho`, 6,5s linear).
- Vermelho = "você fez algo que não deu certo". Âmbar = "algo está errado e
  não foi você". Verde = marca e sucesso.
- Animação de abrir tem floreio; a de fechar sai da frente (mais rápida).
- `prefers-reduced-motion` desliga de verdade — e timer de JavaScript não
  obedece CSS, precisa checar `matchMedia` por conta.

---

## Pendências anotadas

- Mover o repositório para `C:` (maior retorno, ver acima)
- `acessos` — só depois da conversa com o time
- Faxina de sessões vencidas (`DELETE FROM sessoes WHERE expira_em < now()`)
- `secure=True` no cookie quando entrar o túnel Cloudflare
- Teste do serviço sobrevivendo a um reinício real da máquina
- `config.js` da raiz (site da Vercel) ainda tem a porta errada da API STATUS
