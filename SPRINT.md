# Sprint — fechar Perfil e Configurações

Combinado em 01/10/2026. Uma task por vez, na ordem abaixo. Cada item só
começa quando o anterior estiver medido e commitado.

## A regra de quem faz

- **Assunto novo → fazemos juntos.** Eu explico, mostro o código, o JP
  digita, eu meço o resultado.
- **Repetição do que já dominamos → eu faço.** Rota com guarda de sessão,
  vista por estado, formulário com três avisos, classe que o CSS anima —
  isso já foi aprendido; refazer à mão só gasta tempo.
- Em todo item, o que for novo vem com explicação antes do código.

---

## 1. Aparência — claro e escuro ✅ 01/10/2026

**Feito juntos.** Primeiro tema do projeto.

Entregue: `color-scheme: light dark` + `light-dark()` em todos os tokens do
`:root`, os sete valores fixos viraram token, seletor de três estados em
`tema.js` (`window.UPTema`) carregado sem `defer` no `<head>` das duas
casas, controle de rádios na tela de Perfil, e `data-tema` no `<html>` para
o que não é cor.

Medido: os dois verdes trocam de papel sem mudar de valor; a rampa da trama
no claro foi recalculada para igualar o delta de luminância do escuro
(ruído 0.1606 → 0.0796, pior contraste 3.43 → 6.34); a logo prateada ganhou
`brightness(.28)` no claro (contraste 1.12 → 8.86).

Três consertos de tabela: `base.css` saiu do bundle do Vite (o Lightning CSS
reescrevia `light-dark()` com gatilho em `prefers-color-scheme`), o botão de
senha lia `salvandoPerfil`, e o movimento reduzido no `app.js` era medido e
ignorado.

- Novo: tema por tokens (`[data-tema]` na raiz), persistir a escolha, e o
  terceiro estado que todo mundo esquece — "seguir o sistema"
  (`prefers-color-scheme`), que não é nem claro nem escuro.
- Pega o `entrar.html` junto, então o seletor de tema precisa de um pedaço
  de JS que rode nas duas casas (vanilla e React) sem duplicar regra.
- Detalhe pedido: no claro, texto vira preto **menos os verdes**, que se
  mantêm. Isso decide como os tokens são escritos.
- Eu faço sozinho: a varredura dos valores fixos no `base.css` que ainda
  não são token.

**Pronto quando:** alternar muda hub e login, a escolha sobrevive ao F5, e
nenhum verde da marca muda de cor.

---

## 2. Configurações — o esqueleto das cinco seções ✅ 02/10/2026

**Feito sozinho.** Era repetição: vista por estado, ícones, cômodo por
condicional.

A vista `perfil` virou `config`, com `secao` como estado próprio. Cinco
seções com ícone, lista à esquerda e painel à direita (`<button>` comuns:
Tab e Enter já funcionam sem JS de teclado). Só o cômodo atual é montado,
então `inert` não foi preciso — o que não está no DOM não recebe foco.

As três portas do card do usuário passaram a levar a lugares diferentes:
Personalizar → Aparência, Perfil → Perfil, Configurações → Conta. Antes
Personalizar e Configurações eram `href="#"` mortos.

Funcionando hoje: **Conta** (email somente leitura, apelido, setor, troca de
senha) e **Aparência** (o item 1). **Ajuda** leva ao chamado que já existe,
com a caixa em modo Chamado e foco pronto. **Perfil** e **Favoritos** são
estados honestos: dizem o que ainda não dá.

Seções: Perfil · Conta · Aparência · Favoritos · Ajuda, com lista à
esquerda e painel à direita. Nasce com Aparência (item 1) e Conta (o que
já existe hoje em Perfil) funcionando; as outras três entram vazias com
texto honesto do que virá.

**Pronto quando:** navega entre as cinco pelo teclado e pelo mouse, e
nenhuma seção promete o que não faz.

---

## 3. Foto de perfil e bio ✅ 05/10/2026

**Feito juntos.** O item mais novo da lista.

Guardado no banco (`foto` BYTEA, `foto_em` TIMESTAMPTZ, `bio` TEXT), não em
disco: o `pg_dump` leva tudo junto, não sobra arquivo órfão e mudar o
projeto de lugar não arrasta pasta nenhuma. Medido: **2.782 bytes por
foto**, uns 84 KB para os 30 operadores.

A validação é reprocessar com Pillow — abrir, cortar no centro, reduzir a
256×256 e gravar de novo como WEBP. Isso prova que é imagem (se não for,
não abre) e descarta o EXIF, que em foto de celular carrega GPS.

Caminho ruim testado: HTML com extensão `.png` → 422; SVG com `<script>`
dentro → 422; PNG de 94 KB declarando 100 megapixels → 413; arquivo de
5 MB → 413; sem sessão → 401 nas duas rotas. Os três primeiros chegam na
tela como aviso, não no console.

Cache resolvido pelo endereço: `?v=<foto_em>` muda quando a foto muda, e aí
o `Cache-Control` pode ser `immutable`. Medido trocando a foto: endereço
novo, pixel novo.

- Novo e grande: **upload de arquivo**. `multipart/form-data`, validar tipo
  e tamanho de verdade (não confiar na extensão), decidir onde o arquivo
  mora (disco x banco), servir ele depois, e o cache do navegador quando a
  foto muda mas o endereço não.
- Segurança: é a primeira vez que o hub aceita arquivo de fora. Vale
  conversar sobre o que pode dar errado antes de escrever a rota.
- Eu faço sozinho: a coluna `bio`, o campo na tela e o avatar clicável.

**Pronto quando:** trocar a foto reflete na topbar e no card sem F5, e um
arquivo inválido é recusado com mensagem clara.

---

## 4. Favoritos ✅ 05/10/2026

**Modelagem juntos, resto sozinho.**

Tabela `favoritos` com **chave primária composta** `(usuario_id,
automacao_id)` e nenhum `id` próprio — o par já É a identidade, e um `id`
deixaria duplicar o mesmo fato. A ordem das colunas na chave é a pergunta
que a tela faz: "o que o JP favoritou" aproveita o índice; a inversa, não.
É fato, não coisa, então desfavoritar apaga a linha em vez de marcar um
booleano. As duas estrangeiras com `ON DELETE CASCADE`.

Rotas idempotentes: `PUT` marca (com `ON CONFLICT DO NOTHING`), `DELETE`
desmarca. Medido: favoritar duas vezes devolve 200 e deixa **uma** linha;
desfavoritar o que já não existe também é 200.

O `GET /api/automacoes` traz `favorita` por um segundo `LEFT JOIN` com o
usuário **na condição do join** — no `WHERE` sumiriam todas as não
favoritadas. Isolamento medido com duas sessões: cada um vê só as suas.

Na tela a estrela é **irmã** do link, nunca filha: `<button>` dentro de
`<a>` é HTML inválido. Pintura otimista medida em **11,5 ms** contra
**200 ms** da rede, com desfazer testado forçando 500 no servidor.

- Novo: tabela de relação N-para-N (usuário × automação) e chave primária
  composta — a primeira do projeto que não tem `id` próprio.
- Destrava o card "Automação favorita" do Perfil, que substitui o "mais
  usada" (escolha explícita no lugar de inferência — e sem depender da
  `acessos`).

**Pronto quando:** favoritar e desfavoritar da gaveta e da busca, e a
seção Favoritos listar o que foi marcado.

---

## 5. Perfil — layout novo, trama e blur ✅ 05/10/2026

**Canvas juntos, layout sozinho.**

O `app.js` deixou de rodar solto: virou `window.UPTrama.iniciar(canvas)`,
que devolve a própria função de parar. É o mesmo contrato do cleanup do
`useEffect`, então o `Trama.tsx` só liga ao montar e chama o `parar` ao
sair — sem saber nada de canvas. Um arquivo serve as duas casas.

O conceito: numa página única, "a página limpa depois" deixa de valer. A
tela monta e desmonta enquanto a página continua viva, e sem parada
explícita cada visita sobe mais um laço.

Medido com 10 idas e vindas: 10 tramas ligadas, 10 desligadas, 0 canvas e
**0 quadros pendentes**. Com 6 ciclos a mais, os ouvintes de `resize` e
`up:tema` fecharam em 0 cada.

Layout: coluna de identidade à esquerda (foto, nome, bio, setor, email),
favoritos e calendário à direita, tudo em blocos de vidro com
`backdrop-filter` sobre a trama — os mesmos tokens `--vidro` do cartão do
login, sem cor nova. Os cards mostram as **três favoritadas mais
recentemente**, com a logo da UP pequena.

O calendário é estado honesto: diz que o registro de uso não existe e por
quê. Ele destrava no item 6.

- Novo: trazer a trama de pontos (hoje `app.js` vanilla no `entrar.html`)
  para dentro do React. Vira hook ou componente, e aí entra ciclo de vida:
  criar o canvas, redimensionar, e **parar** quando a tela sai.
- Eu faço sozinho: a coluna de identidade, o card da automação favorita com
  a logo, o `backdrop-filter` nos blocos sobrepostos.

**Pronto quando:** a trama roda nas duas telas sem duplicar código e sem
deixar `requestAnimationFrame` vivo depois de sair.

---

## 6. Calendário de uso — bloqueado

**Juntos**, quando desbloquear.

Depende da tabela `acessos`, adiada até o time saber que o uso seria
registrado. Não começar sem essa conversa.

- Novo quando vier: agregação por data no SQL (`date_trunc`,
  `generate_series` para preencher dias sem uso) e desenhar uma grade densa
  a partir de dados esparsos.
- O desenho já está decidido: grade por **competência**, não por semana,
  com a faixa de prazo marcada — porque trabalho fiscal se amontoa perto da
  entrega, e é isso que o gráfico tem que mostrar.

---

## Fora do sprint

- Chat e grupos (o "+ Criar grupo" da gaveta está desabilitado esperando)
- Adicionar amigos (depende do chat para fazer sentido)
- Mover o projeto para o `C:` — continua sendo a pendência de maior retorno
