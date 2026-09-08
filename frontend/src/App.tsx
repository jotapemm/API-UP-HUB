import { useState } from 'react'
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

  return (
    <>
      <div className="grain"></div>

      <aside className={menuAberto ? 'side aberta' : 'side'}>
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

      <div className="app">
        <div className="main">
          <header className="topbar">
            <button className="btn-icon" 
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

            <button className="avatar" type="button" aria-label="Conta"></button>
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
