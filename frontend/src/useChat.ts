import { useCallback, useEffect, useMemo, useState } from 'react'

export type Pessoa = {
  id: number
  nome: string
  apelido: string | null
  foto_em: string | null
}

export type Ultima = {
  id: number
  corpo: string
  criada_em: string
  autor_id: number | null
}

export type Conversa = {
  id: number
  tipo: 'direta' | 'grupo'
  nome: string | null
  nao_lidas: number
  lido_ate: number
  /* Em conversa direta é a outra pessoa; em grupo vem null e quem
     nomeia é o `nome`. Quem decide isso é o servidor, porque só ele
     sabe quem está perguntando.                                       */
  outro: Pessoa | null
  ultima: Ultima | null
}

export type Mensagem = {
  id: number
  corpo: string
  criada_em: string
  autor_id: number | null
  autor_nome: string | null
  autor_apelido: string | null
}

export type Evento = {
  tipo: 'mensagem'
  conversa_id: number
  id: number
  corpo: string
  criada_em: string
  autor_id: number
}

/* O chat inteiro em um lugar: a lista de conversas e a conexão que
   empurra novidade.

   A conexão vive aqui, e não na tela do chat, de propósito. Na tela, ela
   só existiria enquanto o chat estivesse aberto — e o contador de não
   lidas, que é o motivo de o stream ser por PESSOA e não por conversa,
   nunca atualizaria em outra vista.                                    */
export function useChat(ligado: boolean, euId: number | undefined) {
  const [conversas, setConversas] = useState<Conversa[] | null>(null)
  const [erro, setErro] = useState(false)

  /* A última mensagem que chegou pelo stream. A tela aberta reage a ela
     por useEffect, em vez de o handler mexer na tela direto — assim o
     handler não precisa saber qual conversa está aberta, e some a chance
     de ele ler esse valor desatualizado.                               */
  const [chegou, setChegou] = useState<Evento | null>(null)

  const recarregar = useCallback(() => {
    fetch('/api/conversas')
      .then((r) => {
        if (r.status === 401) { location.href = '/entrar.html'; return null }
        if (!r.ok) throw new Error('conversas')
        return r.json()
      })
      .then((d) => { if (d) { setConversas(d.conversas); setErro(false) } })
      .catch(() => setErro(true))
  }, [])

  useEffect(() => {
    if (!ligado) return
    recarregar()
  }, [ligado, recarregar])

  useEffect(() => {
    if (!ligado) return

    const fonte = new EventSource('/api/conversas/stream')

    /* Reconectou? O EventSource tenta de novo sozinho quando a conexão
       cai — não existe código de retentativa aqui porque ele já faz.
       Mas cair significa que pode ter passado mensagem no intervalo,
       então a lista é buscada de novo. Sem isto o contador voltaria
       errado e ninguém perceberia.                                     */
    fonte.onopen = () => recarregar()

    fonte.onmessage = (e) => {
      let ev: Evento
      try { ev = JSON.parse(e.data) } catch { return }
      if (ev.tipo !== 'mensagem') return

      setChegou(ev)

      /* FORMA DE FUNÇÃO, sempre. Este handler é criado UMA vez: as
         variáveis que ele enxerga são as do primeiro render, para
         sempre. `setConversas([...conversas, x])` usaria a lista de
         quando a conexão abriu, e cada mensagem apagaria tudo que
         chegou depois. Com `antes =>` o React entrega a lista atual.   */
      setConversas((antes) => {
        if (!antes) return antes

        const nova = antes.map((c) =>
          c.id !== ev.conversa_id
            ? c
            : {
                ...c,
                ultima: {
                  id: ev.id,
                  corpo: ev.corpo,
                  criada_em: ev.criada_em,
                  autor_id: ev.autor_id,
                },
                /* a minha própria mensagem não conta como não lida: o
                   servidor já moveu o meu lido_ate ao gravar */
                nao_lidas: ev.autor_id === euId ? c.nao_lidas : c.nao_lidas + 1,
              },
        )

        /* conversa que acabou de receber sobe para o topo, que é a mesma
           ordem que o servidor usa (última mensagem primeiro) */
        return [...nova].sort(
          (a, b) => (b.ultima?.id ?? 0) - (a.ultima?.id ?? 0) || b.id - a.id,
        )
      })
    }

    /* Mesma regra do parar() da trama: quem liga, desliga. Sem o close,
       cada remontagem deixaria uma conexão para trás — e o servidor
       guardaria uma fila para cada uma delas.                          */
    return () => fonte.close()
  }, [ligado, recarregar, euId])

  const naoLidas = useMemo(
    () => (conversas ?? []).reduce((s, c) => s + c.nao_lidas, 0),
    [conversas],
  )

  /* Zera o contador de uma conversa na tela SEM esperar o servidor. A
     chamada vai junto, mas quem desenha não espera por ela.            */
  const marcarLido = useCallback((conversaId: number, ate: number) => {
    setConversas((antes) =>
      (antes ?? []).map((c) =>
        c.id === conversaId ? { ...c, nao_lidas: 0, lido_ate: Math.max(c.lido_ate, ate) } : c,
      ),
    )
    fetch(`/api/conversas/${conversaId}/lido`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lido_ate: ate }),
    }).catch(() => { /* a marca sobe de novo na próxima abertura */ })
  }, [])

  return { conversas, erro, chegou, naoLidas, recarregar, marcarLido }
}
