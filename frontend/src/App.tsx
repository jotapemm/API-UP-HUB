import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import './App.css'

type Usuario = {
  id: number
  nome: string
  apelido: string | null
  email: string
  setor_id: number | null
}

type Automacao = {
  id: number
  slug: string
  nome: string
  descricao: string
  url: string | null
  palavras_chave: string | null
}

type Setor = {
  id: number
  nome: string
  automacoes: Automacao[]
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const ehChamado = (v: string) =>
  v.trim().startsWith('@')

function App() {

  const [menuAberto, setMenuAberto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const [sel, setSel] = useState(0)

  const alternarSetor = (id: number) => {
    setAbertos((antigos) => {
      const novos = new Set(antigos) // <- cópia, não o mesmo Set
      if (novos.has(id)) novos.delete(id)
      else novos.add(id)
      return novos
    })
  }

  const abrir = (item: (typeof TODAS)[number]) => {
    if (item.url) window.open(item.url, '_blank','noopener,noreferrer')
  }

  const aoTeclarNaCaixa = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (modoChamado) return          // chamado ainda não tem envio: Enter segue quebrando linha

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!achados.length) return
      e.preventDefault()             // senão o cursor do texto anda junto
      const passo = e.key === 'ArrowDown' ? 1 : -1
      setSel((s) => (s + passo + achados.length) % achados.length)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()             // na busca, Enter não vira quebra de linha
      const item = achados[sel]
      if (item) abrir(item)
    }
  }

  const botaoMenu = useRef<HTMLButtonElement>(null)
  const botaoAvatar = useRef<HTMLButtonElement>(null)

  const TODAS = useMemo(
    () =>
      setores.flatMap((s) =>
        s.automacoes.map((a) => ({
          ...a,
          setor: s.nome,
          chave: normalizar(`${a.nome} ${a.descricao} ${a.palavras_chave ?? ''} ${s.nome}`),
        })),
      ),
    [setores],
  )

  const [termo, setTermo] = useState('')
  const modoChamado = ehChamado(termo)

  const achados = useMemo(() => {
    if (ehChamado(termo)) return []
    const t = normalizar(termo).trim()
    if (!t) return []
    const partes = t.split(/\s+/)
    return TODAS.filter((i) => partes.every((p) => i.chave.includes(p))).slice(0, 6)
  }, [termo, TODAS])

  useEffect(() => {
    if (!menuAberto) return          // gaveta fechada: nada pra escutar

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)

    // roda quando a gaveta fecha - as duas coisas significam "fechou"
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      botaoMenu.current?.focus()
    }
  }, [menuAberto])


  useEffect(() => {
    if (!painelAberto) return          // gaveta fechada: nada pra escutar

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPainelAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)

    // roda quando a gaveta fecha - as duas coisas significam "fechou"
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      botaoAvatar.current?.focus()
    }
  }, [painelAberto])

  useEffect(() => {
    let vivo = true

    fetch('/api/eu')
      .then((r) => {
        if (r.status === 401) { location.href = '/entrar.html'; return null }
        if (!r.ok) throw new Error('perfil')
        return r.json()
      })
      .then((dados) => { if (vivo && dados) setUsuario(dados) })
      .catch(() => {/* rede caiu: fica sem nome, mas não quebra a tela */ })
    return () => { vivo = false }
  }, [])

  const tratamento = usuario ? (usuario.apelido || usuario.nome.split(' ')[0]) : ''
  const inicial = tratamento ? tratamento[0].toUpperCase() : ''

  const sair = async () => {
    try { await fetch('/api/logout', { method: 'POST' }) }
    finally { location.href = '/entrar.html' }
  }

  useEffect(() => {
    let vivo = true

    fetch("/api/automacoes")
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => { if (vivo) setSetores(dados) }).catch(() => {
        /* sem catálogo a sidebar fica vazia, o resto funciona */
      })

    return () => { vivo = false }
  }, [])

  return (
    <>
      <div className="grain"></div>

      <aside className={menuAberto ? 'side aberta' : 'side'} inert={!menuAberto}>
        <div className="side-logo">
          <div className="logo"><img src="/assets/logo-up.png" alt="" /></div>
        </div>

        <div className="side-group open">
          <button className="side-head" type="button">Automações</button>
          <div className="side-body">
            <div>
              {setores.map((setor) => (
                <div className={abertos.has(setor.id) ? 'side-sector open' : 'side-sector'} key={setor.id}>
                  <button
                    className="side-head"
                    type="button"
                    aria-expanded={abertos.has(setor.id)}
                    onClick={() => alternarSetor(setor.id)}
                  >{setor.nome}</button>
                  <div className="side-body" inert={!abertos.has(setor.id)}>
                    <div>
                      {setor.automacoes.length > 0 ? (
                        setor.automacoes.map((a) => (
                          <a
                            className={a.url ? 'side-link on' : 'side-link'}
                            href={a.url ?? '#'}
                            target={a.url ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            title={a.descricao}
                            key={a.slug}
                          >
                            <span className="dot"></span>
                            {a.nome}
                          </a>
                        ))
                      ) : (
                        <span className="side-link"><span className="dot"></span>Em breve</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div
        className={menuAberto ? 'scrim visivel' : 'scrim'}
        onClick={() => setMenuAberto(false)}
      />

      {painelAberto && (
        <div className="captura" onClick={() => setPainelAberto(false)} />
      )}

      <div
        className={painelAberto ? 'userpanel aberto' : 'userpanel'}
        role="menu"
        inert={!painelAberto}
      >
        <div className="userpanel-id">
          <span className="avatar">{inicial}</span>
          <span><b>{tratamento}</b><span>{usuario?.nome ?? ''}</span></span>
        </div>
        <a href="#" role="menuitem">Personalizar</a>
        <hr />
        <a href="#" role="menuitem">Perfil</a>
        <a href="#" role="menuitem">Caixa de entrada</a>
        <a href="#" role="menuitem">Automações</a>
        <a href="#" role="menuitem">Setor</a>
        <a href="#" role="menuitem">Configurações</a>
        <hr />
        <a
          href="/entrar.html"
          className="sair"
          role="menuitem"
          onClick={(e) => { e.preventDefault(); sair() }}
        >Sair</a>
      </div>

      <div className="app" inert={menuAberto || painelAberto}>
        <div className="main">
          <header className="topbar">
            <button
              ref={botaoMenu}
              className="btn-icon"
              type="button"
              aria-label="Abrir Menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto(true)}
            >☰</button>

            <a className="logo" href="/app/">
              <img src="/assets/logo-up.png" alt="" />
              <span className="logo-txt"><b>UP</b>
                <span>Recuperação Tributária</span></span>
            </a>

            <div className="topsearch">
              <label className="sr-only" htmlFor="topq">Pesquisar automações</label>
              <input id="topq" type="search" placeholder="Digite para pesquisar as automações" />
            </div>

            <button
              ref={botaoAvatar}
              className="avatar"
              type="button"
              aria-label="Conta"
              aria-haspopup="menu"
              aria-expanded={painelAberto}
              onClick={() => setPainelAberto(true)}
            >{inicial}</button>
          </header>

          <main className="stage">
            <div className="stage-in">
              <p className="saudacao">
                {usuario
                  ? <>Olá <span className="nome">{tratamento}</span>, bem-vindo ao</>
                  : <>&nbsp;</>}
              </p>
              <h1 className="wordmark"><span className="b">UP</span> API <span className="b">HUB</span></h1>

              <div className={modoChamado ? 'cmd is-chamado' : 'cmd'}>
                <label className="sr-only" htmlFor="q">Buscar ou abrir chamado</label>
                <textarea
                  id="q"
                  rows={3}
                  value={termo}
                  onChange={(e) => { setTermo(e.target.value); setSel(0)}}
                  onKeyDown={aoTeclarNaCaixa}
                  placeholder="Buscar automação | Digite @ para solicitar um chamado | Buscar solução | O que você precisa hoje?"
                />

                <div className="cmd-foot">
                  <span className="cmd-mode">{modoChamado ? 'Chamado' : 'Busca'}</span>
                  <span style={{ fontSize: 11, color: 'var(-text-3)' }}>
                    {modoChamado ? 'Descreva o problema e aperte Enter para abrir o chamado' : 'Enter abre o primeiro resultado'}
                  </span>
                </div>
              </div>

              <div className="results">
                {achados.map((i, n) => (
                  <a
                    className={ n === sel ? 'res sel' : 'res' }
                    href={i.url ?? '#'}
                    target={i.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    key={i.slug}
                    onMouseEnter={() => setSel(n)}
                  >
                    <span><b>{i.nome}</b><br /><small>{i.descricao}</small></span>
                    <span className="setor">{i.setor}</span>
                  </a>
                ))}
                {!modoChamado && termo.trim() && achados.length === 0 && (
                  <div className="res-none">Nada encontrado para "{termo.trim()}".</div>
                )}
              </div>

              <section className="recentes">
                <h3>Recentes</h3>
                <div className="recentes-box">
                  <div className="recentes-vazio">O que você abrir aparece aqui.</div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </>

  )
}

export default App
