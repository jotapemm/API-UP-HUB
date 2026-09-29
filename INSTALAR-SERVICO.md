# Rodar o UP API HUB sozinho, sem terminal aberto

Hoje o hub depende de alguém deixar uma janela de terminal aberta. Se a
janela fecha, se a pessoa faz logoff, ou se o processo morre, o hub cai — e
o traceback some junto com a janela.

Isto resolve as duas coisas: ele volta sozinho e deixa rastro em arquivo.

---

## Por que Agendador de Tarefas e não um "serviço de verdade"

Windows tem serviços de verdade (`services.msc`), mas o Python não fala o
protocolo que o gerenciador de serviços espera. Para virar serviço mesmo,
seria preciso um intermediário como o NSSM ou o WinSW — programas de
terceiros, que numa máquina de empresa costumam precisar de aprovação.

O Agendador de Tarefas já vem no Windows e entrega o que interessa:
sobe ao ligar o computador, roda sem ninguém logado, e reinicia se cair.

---

## Antes de começar: o `Z:` não existe para a tarefa

Letra de unidade é mapeamento **por usuário e por sessão**. Quando a tarefa
roda "esteja o usuário conectado ou não", não há sessão, e `Z:\...` não é
encontrado — com um erro de "arquivo não existe" apontando para um arquivo
que está bem ali.

Por isso todos os caminhos abaixo usam a forma UNC:

```
\\192.168.0.50\dados\UP-API\UP API HUB
```

---

## Passo a passo

Abra o **Agendador de Tarefas** e escolha **Criar Tarefa…**
(não "Criar Tarefa Básica" — ela não tem as opções que a gente precisa).

### Aba Geral

| campo | valor |
|---|---|
| Nome | `UP API HUB` |
| Descrição | `Servidor do hub de automações (porta 8090)` |
| Segurança | **Executar estando o usuário conectado ou não** |
| Privilégios mais altos | **deixar desmarcado** |

O privilégio elevado não é necessário: só portas abaixo de 1024 exigem
administrador, e a nossa é a 8090. Pedir poder que não se usa é risco de
graça.

### Aba Disparadores → Novo

- **Iniciar a tarefa:** Ao iniciar o computador
- **Atrasar tarefa por:** 30 segundos

O atraso existe porque a rede e o mapeamento do servidor de arquivos
demoram alguns segundos depois do boot. Sem ele, a tarefa tenta subir antes
do `\\192.168.0.50` estar acessível.

### Aba Ações → Nova

- **Ação:** Iniciar um programa
- **Programa/script:** `powershell.exe`
- **Argumentos:**

```
-NoProfile -ExecutionPolicy Bypass -File "\\192.168.0.50\dados\UP-API\UP API HUB\iniciar-hub.ps1"
```

- **Iniciar em:** deixar **vazio**

O campo "Iniciar em" não aceita caminho UNC. Não faz falta: o
`iniciar-hub.ps1` descobre a própria pasta pelo `$PSScriptRoot` e entrega
ela para o Python como diretório de trabalho.

### Aba Condições

- Desmarcar **Iniciar a tarefa somente se o computador estiver na
  alimentação CA** (irrelevante em desktop, atrapalha em notebook)

### Aba Configurações

| opção | valor | por quê |
|---|---|---|
| Se a tarefa falhar, reiniciar a cada | 1 minuto | cobre falha ao *iniciar* a tarefa (ver aviso abaixo) |
| Tentar reiniciar até | 3 vezes | idem |
| **Parar a tarefa se ela for executada por mais de** | **DESMARCAR** | vem marcado com 3 dias; um servidor roda para sempre, e com isso marcado ele morreria toda terça |
| Se a tarefa já estiver em execução | Não iniciar uma nova instância | evita dois hubs disputando a porta 8090 |

Ao clicar OK, o Windows pede a senha do usuário que vai executar a tarefa.
Ela precisa ser de uma conta **com acesso ao `\\192.168.0.50\dados`** — a
conta `SISTEMA` não serve, porque ela não tem credencial de rede.

---

## Quem reinicia o hub quando ele cai (e quem NÃO reinicia)

O "Se a tarefa falhar, reiniciar a cada 1 minuto" do Agendador cobre a
tarefa **falhar ao iniciar**. Ele não cobre o programa subir, rodar e
morrer depois.

Isso foi testado em 29/09/2026: com o hub no ar pela tarefa, o processo do
Python foi morto à força. A tarefa registrou `4294967295` (`0xFFFFFFFF`,
ou seja `-1`) e **não reiniguiu nada** — para o Agendador, a tarefa
simplesmente terminou.

Por isso quem vigia o Python é o próprio `iniciar-hub.ps1`: ele roda o
servidor dentro de um laço e sobe de novo assim que o processo morre.

- Queda depois de pelo menos 30s de pé → religa em 5 segundos
- Quedas seguidas em menos de 30s → espera 5s, 10s, 30s, 60s, 120s
- Cinco quedas rápidas seguidas → **desiste e para**, deixando o último
  `.erro.log` como resposta

Desistir é proposital: cinco quedas em sequência sem o hub nem ficar de pé
não é instabilidade, é defeito. Insistir para sempre esconderia o problema
e encheria o disco de log.

Para acompanhar, o arquivo `logs\historico.log` tem a linha do tempo:

```
[29/09/2026 08:27:57] subindo (2026-09-29_08-27-57)
[29/09/2026 09:14:02] encerrou com codigo -1 depois de 2765s (2026-09-29_08-27-57)
[29/09/2026 09:14:02] religando em 5s
[29/09/2026 09:14:07] subindo (2026-09-29_09-14-07)
```

---

## Conferir se funcionou

```powershell
schtasks /query /tn "UP API HUB" /v /fo list | Select-String "Status|Resultado|Executar"
```

```powershell
Invoke-WebRequest http://localhost:8090/api/saude -UseBasicParsing
```

Os logs ficam em `logs\`, um par de arquivos por subida:

```
logs\hub-2026-09-28_14-35-44.log        saída normal
logs\hub-2026-09-28_14-35-44.erro.log   tracebacks e erros
```

Para ler com os acentos certos:

```powershell
Get-Content "logs\hub-2026-09-28_14-35-44.erro.log" -Encoding utf8
```

Arquivos com mais de 14 dias são apagados a cada subida, pelo próprio
script.

---

## Comandos do dia a dia

```powershell
schtasks /run /tn "UP API HUB"     # subir agora
schtasks /end /tn "UP API HUB"     # derrubar
schtasks /query /tn "UP API HUB"   # ver o estado
```

Enquanto a tarefa estiver ativa, **não** suba o hub à mão com
`python main.py`: os dois vão brigar pela porta 8090, e o segundo morre com
`[Errno 10048]`.

---

## Acesso de outras máquinas

O hub escuta em `0.0.0.0:8090`, então aceita conexões da rede. Mas o
Firewall do Windows bloqueia por padrão. Para liberar (uma vez, como
administrador):

```powershell
New-NetFirewallRule -DisplayName "UP API HUB 8090" -Direction Inbound -LocalPort 8090 -Protocol TCP -Action Allow -Profile Private
```

O `-Profile Private` limita à rede local. Não exponha o hub direto na
internet: para isso existe o túnel do Cloudflare, já documentado em
`cloudflare/DEPLOY.md`. E quando isso acontecer, lembrar de trocar o
`secure=False` do cookie de sessão para `True`.

---

## Um pendência que continua de pé

O hub roda a partir de uma pasta de rede. Isso funciona, mas significa que
ele depende do servidor de arquivos estar no ar e com espaço — que foi
exatamente o que derrubou tudo em 22/09. Mover o projeto para o disco local
(`C:`) tira essa dependência e deixa `npm`, `git` e `tsc` bem mais rápidos.
Se isso for feito, os caminhos deste documento mudam junto.
