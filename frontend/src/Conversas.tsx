import { useCallback, useEffect, useRef, useState } from 'react'
import BotaoLuz from './BotaoLuz'
import type { Conversa, Evento, Mensagem, Pessoa } from './useChat'

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const inicial = (nome: string) => (nome.trim()[0] ?? '?').toUpperCase()

/* O rótulo de uma conversa: o nome do grupo, ou o apelido/nome do outro.
   Conversa direta não tem nome guardado — quem monta é a tela, porque é
   ela que sabe quem está olhando.                                      */
const rotulo = (c: Conversa) =>
  c.tipo === 'grupo' ? (c.nome ?? 'Grupo') : (c.outro?.apelido || c.outro?.nome || 'Conversa')

function Retrato({ de, tamanho }: { de: Pessoa | null; tamanho: 'p' | 'g' }) {
  const classe = tamanho === 'p' ? 'conv-foto' : 'conv-foto grande'
  if (!de) return <span className={classe}>#</span>
  if (!de.foto_em) return <span className={classe}>{inicial(de.nome)}</span>
  return (
    <img
      className={classe}
      alt=""
      src={`/api/usuarios/${de.id}/foto?v=${Date.parse(de.foto_em)}`}
    />
  )
}

type Props = {
  euId: number
  conversas: Conversa[] | null
  erro: boolean
  chegou: Evento | null
  recarregar: () => void
  marcarLido: (conversaId: number, ate: number) => void
  aoVoltar: () => void
}

export default function Conversas({
  euId, conversas, erro, chegou, recarregar, marcarLido, aoVoltar,
}: Props) {
  const [abertaId, setAbertaId] = useState<number | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')

  const [procurando, setProcurando] = useState(false)
  const [busca, setBusca] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null)

  const fim = useRef<HTMLDivElement>(null)
  const aberta = conversas?.find((c) => c.id === abertaId) ?? null

  /* ── carregar a conversa aberta ─────────────────────────────── */
  useEffect(() => {
    if (abertaId === null) { setMensagens(null); return }

    let vivo = true
    setMensagens(null)
    fetch(`/api/conversas/${abertaId}/mensagens`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (vivo) setMensagens(d.mensagens) })
      .catch(() => { if (vivo) setMensagens([]) })

    return () => { vivo = false }   // resposta atrasada não escreve em tela que saiu
  }, [abertaId])

  /* ── mensagem que chegou pelo stream ────────────────────────── */
  useEffect(() => {
    if (!chegou || chegou.conversa_id !== abertaId) return

    setMensagens((antes) => {
      if (!antes) return antes
      if (antes.some((m) => m.id === chegou.id)) return antes   // já estava (eu mesmo mandei)
      return [...antes, {
        id: chegou.id,
        corpo: chegou.corpo,
        criada_em: chegou.criada_em,
        autor_id: chegou.autor_id,
        autor_nome: null,
        autor_apelido: null,
      }]
    })
  }, [chegou, abertaId])

  /* ── marcar lido ─────────────────────────────────────────────
     Vale para abrir a conversa E para mensagem que chega com ela já
     aberta: se está na tela, está lido.                             */
  useEffect(() => {
    if (!aberta || !mensagens?.length) return
    const ultima = mensagens[mensagens.length - 1].id
    if (ultima > aberta.lido_ate) marcarLido(aberta.id, ultima)
  }, [aberta, mensagens, marcarLido])

  /* rola para o fim quando a lista cresce */
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [mensagens])

  /* ── buscar pessoas ──────────────────────────────────────────── */
  useEffect(() => {
    if (!procurando) return
    let vivo = true
    const t = setTimeout(() => {
      fetch(`/api/pessoas?busca=${encodeURIComponent(busca)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (vivo) setPessoas(d.pessoas) })
        .catch(() => { if (vivo) setPessoas([]) })
    }, 250)   // espera a digitação parar antes de perguntar ao servidor
    return () => { vivo = false; clearTimeout(t) }
  }, [procurando, busca])

  const abrirCom = useCallback(async (pessoaId: number) => {
    try {
      const r = await fetch('/api/conversas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ com: pessoaId }),
      })
      if (!r.ok) return
      const d = await r.json()
      setProcurando(false)
      setBusca('')
      recarregar()
      setAbertaId(d.id)
    } catch { /* a lista continua como está */ }
  }, [recarregar])

  const enviar = useCallback(async () => {
    const corpo = texto.trim()
    if (!corpo || abertaId === null || enviando) return

    setEnviando(true)
    setErroEnvio('')
    try {
      const r = await fetch(`/api/conversas/${abertaId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corpo }),
      })
      if (!r.ok) { setErroEnvio('Não deu para enviar. Tente de novo.'); return }
      const m = await r.json()
      setTexto('')
      /* o stream também vai trazer esta mensagem; o filtro por id lá em
         cima impede que ela apareça duas vezes */
      setMensagens((antes) => (antes ?? []).some((x) => x.id === m.id)
        ? antes
        : [...(antes ?? []), { ...m, autor_nome: null, autor_apelido: null }])
    } catch {
      setErroEnvio('Não deu para enviar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }, [texto, abertaId, enviando])

  return (
    <section className="conv">
      <div className="conv-topo">
        <h2>Conversas</h2>
        <button type="button" className="btn" onClick={aoVoltar}>Voltar</button>
      </div>

      {erro && <div className="aviso erro">Não foi possível carregar suas conversas.</div>}

      <div className="conv-corpo">
        {/* ── coluna da esquerda ───────────────────────────────── */}
        <aside className="conv-lista">
          <BotaoLuz
            className="conv-nova"
            onClick={() => { setProcurando((v) => !v); setPessoas(null) }}
          >
            {procurando ? 'Cancelar' : 'Nova conversa'}
          </BotaoLuz>

          {procurando && (
            <div className="conv-busca">
              <input
                autoFocus
                placeholder="Buscar pelo nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {pessoas === null && <p className="conv-vazio">Carregando…</p>}
              {pessoas?.length === 0 && <p className="conv-vazio">Ninguém com esse nome.</p>}
              {pessoas?.map((p) => (
                <button
                  type="button"
                  className="conv-item"
                  key={p.id}
                  onClick={() => abrirCom(p.id)}
                >
                  <Retrato de={p} tamanho="p" />
                  <span className="conv-nome">{p.apelido || p.nome}</span>
                </button>
              ))}
            </div>
          )}

          {!procurando && conversas === null && !erro && (
            <p className="conv-vazio">Carregando…</p>
          )}

          {!procurando && conversas?.length === 0 && (
            <p className="conv-vazio">
              Você ainda não tem conversa nenhuma. Comece por <b>Nova conversa</b>.
            </p>
          )}

          {!procurando && conversas?.map((c) => (
            <button
              type="button"
              key={c.id}
              className={c.id === abertaId ? 'conv-item aberta' : 'conv-item'}
              onClick={() => setAbertaId(c.id)}
            >
              <Retrato de={c.outro} tamanho="p" />
              <span className="conv-meio">
                <span className="conv-nome">{rotulo(c)}</span>
                <span className="conv-previa">
                  {c.ultima ? c.ultima.corpo : 'Sem mensagens ainda'}
                </span>
              </span>
              {c.nao_lidas > 0 && <span className="conv-badge">{c.nao_lidas}</span>}
            </button>
          ))}
        </aside>

        {/* ── coluna da direita ────────────────────────────────── */}
        <div className="conv-aberta">
          {!aberta ? (
            <p className="conv-vazio centro">Escolha uma conversa à esquerda.</p>
          ) : (
            <>
              <header className="conv-cabeca">
                <Retrato de={aberta.outro} tamanho="g" />
                <div>
                  <strong>{rotulo(aberta)}</strong>
                  {aberta.tipo === 'grupo' && <small>grupo</small>}
                </div>
              </header>

              <div className="conv-fluxo">
                {mensagens === null && <p className="conv-vazio">Carregando…</p>}
                {mensagens?.length === 0 && (
                  <p className="conv-vazio">Nenhuma mensagem ainda. Diga alguma coisa.</p>
                )}
                {mensagens?.map((m) => (
                  <div
                    className={m.autor_id === euId ? 'msg minha' : 'msg'}
                    key={m.id}
                    title={quando(m.criada_em)}
                  >
                    {aberta.tipo === 'grupo' && m.autor_id !== euId && (
                      <span className="msg-autor">{m.autor_apelido || m.autor_nome}</span>
                    )}
                    <p>{m.corpo}</p>
                    <span className="msg-hora">{hora(m.criada_em)}</span>
                  </div>
                ))}
                <div ref={fim} />
              </div>

              {erroEnvio && <div className="aviso erro">{erroEnvio}</div>}

              <form
                className="conv-escrever"
                onSubmit={(e) => { e.preventDefault(); enviar() }}
              >
                <input
                  placeholder="Escreva aqui"
                  value={texto}
                  maxLength={4000}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <BotaoLuz type="submit" disabled={enviando || !texto.trim()}>
                  {enviando ? 'Enviando…' : 'Enviar'}
                </BotaoLuz>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
