import { useEffect, useRef, useState } from 'react'
import './App.css'

const SETORES = [
  'Contabilidade',
  'Departamento Pessoal',
  'Financeiro',
  'Fiscal',
  'Gerência',
  'Recuperação Tributária',
]

function App() {

  const [menuAberto, setMenuAberto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)

  const botaoMenu = useRef<HTMLButtonElement>(null)
  const botaoAvatar = useRef<HTMLButtonElement>(null)

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
              {SETORES.map((nome) => (
                <a className="side-link" href="#" key={nome}>
                  <span className="dot"></span>{nome}
                </a>
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
          <span className="avatar">U</span>
          <span><b>user</b><span>Nome completo do user</span></span>
        </div>
        <a href="#" role="menuitem">Personalizar</a>
        <hr />
        <a href="#" role="menuitem">Perfil</a>
        <a href="#" role="menuitem">Caixa de entrada</a>
        <a href="#" role="menuitem">Automações</a>
        <a href="#" role="menuitem">Setor</a>
        <a href="#" role="menuitem">Configurações</a>
        <hr />
        <a href="/entrar.html" className="sair" role="menuitem">Sair</a>
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
            >U</button>
          </header>

          <main className="stage">
            <div className="stage-in">
              <p className="saudacao">Olá <span className="nome">User</span>, bem-vindo ao</p>
              <h1 className="wordmark"><span className="b">UP</span> API <span className="b">HUB</span></h1>

              <div className="cmd">
                <label className="sr-only" htmlFor="q">Buscar ou abrir chamado</label>
                <textarea id="q" rows={3} placeholder="Buscar automação | Digite @ para solicitar um chamado | Buscar solução | O que você precisa hoje?" />
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
