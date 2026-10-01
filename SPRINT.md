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

## 1. Aparência — claro e escuro

**Juntos.** Primeiro tema do projeto.

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

## 2. Configurações — o esqueleto das cinco seções

**Eu faço.** É repetição: vista por estado, ícones, `inert`.

Seções: Perfil · Conta · Aparência · Favoritos · Ajuda, com lista à
esquerda e painel à direita. Nasce com Aparência (item 1) e Conta (o que
já existe hoje em Perfil) funcionando; as outras três entram vazias com
texto honesto do que virá.

**Pronto quando:** navega entre as cinco pelo teclado e pelo mouse, e
nenhuma seção promete o que não faz.

---

## 3. Foto de perfil e bio

**Juntos.** O item mais novo da lista.

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

## 4. Favoritos

**Juntos** na modelagem, eu faço o resto.

- Novo: tabela de relação N-para-N (usuário × automação) e chave primária
  composta — a primeira do projeto que não tem `id` próprio.
- Destrava o card "Automação favorita" do Perfil, que substitui o "mais
  usada" (escolha explícita no lugar de inferência — e sem depender da
  `acessos`).

**Pronto quando:** favoritar e desfavoritar da gaveta e da busca, e a
seção Favoritos listar o que foi marcado.

---

## 5. Perfil — layout novo, trama e blur

**Juntos** no canvas, eu faço o layout.

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
