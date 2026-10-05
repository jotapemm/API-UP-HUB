import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Trama from './Trama'
import BotaoLuz from './BotaoLuz'
import { useDigitacao } from './useDigitacao'
import { lerRecentes, registrarRecente } from './recentes'
import './App.css'

type Usuario = {
  id: number
  nome: string
  apelido: string | null
  email: string
  setor_id: number | null
  papel: string
  bio: string | null
  /* Quando a foto mudou. É null quando não existe foto, e é a chave de
     cache da imagem — por isso vem do servidor em vez de ser inventado
     aqui. Os BYTES da foto nunca trafegam neste objeto.                */
  foto_em: string | null
}

type Automacao = {
  id: number
  slug: string
  nome: string
  descricao: string
  url: string | null
  palavras_chave: string | null
  favorita: boolean
  favorita_em: string | null
}

type Setor = {
  id: number
  nome: string
  automacoes: Automacao[]
}

type Chamado = {
  id: number
  descricao: string
  status: string
  criado_em: string
  automacao: string | null
}

type ChamadoFila = Chamado & {
  atualizado_em: string
  aberto_por: string
  email_de_quem_abriu: string
  atendido_por: string | null
}

type Vista = 'inicio' | 'entrada' | 'triagem' | 'config' | 'perfil'

/* As Configurações são UMA vista com cinco cômodos. A seção é estado
   próprio: trocar de cômodo não recarrega nada nem mexe na vista.      */
type Secao = 'perfil' | 'conta' | 'aparencia' | 'favoritos' | 'ajuda'

const SECOES: [Secao, string][] = [
  ['perfil', 'Perfil'],
  ['conta', 'Conta'],
  ['aparencia', 'Aparência'],
  ['favoritos', 'Favoritos'],
  ['ajuda', 'Ajuda'],
]

type Tema = 'claro' | 'escuro' | 'sistema'

/* O tema.js é script clássico, não módulo = ele não tem import.
   Isso aqui só conta pro TS que window.UPTema existe e qual a forma dele. */
declare global {
  interface Window {
    /* O tema.js vive FORA do bundle. Se ele não carregar, isto é
       undefined — e o "?" obriga todo uso a tratar esse caso, em vez de
       o hub inteiro sumir numa tela branca.                            */
    UPTema?: {
      ler(): Tema
      salvar(t: Tema): void
      aplicar(t: Tema): void
      cor(token: string): string
    }
  }
}

const ROTULO: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

const FRASES = [
  'Buscar automação',
  'Tente "questor" ou "icms"',
  'Digite @ para solicitar um chamado',
  'Buscar solução',
  'O que você precisa hoje?',
]

const TEMAS: [Tema, string][] = [
  ['claro', 'Claro'],
  ['escuro', 'Escuro'],
  ['sistema', 'Seguir o sistema'],
]

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const ehChamado = (v: string) =>
  v.trim().startsWith('@')

/* Ícones: um traço só, 24x24, herdando a cor do texto. Ficam num mapa
   porque desenho é dado, não marcação — e assim a sidebar não vira um
   paredão de <svg> no meio do JSX. */
const TRACOS: Record<string, string[]> = {
  grupo: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M2 21v-1a6 6 0 0 1 6-6h2', 'M17 14v6', 'M14 17h6'],
  chamados: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  entrada: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
  automacoes: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],

  perfil: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  conta: ['M12 3 4 6v5c0 4.5 3.2 8.6 8 10 4.8-1.4 8-5.5 8-10V6l-8-3z', 'M9.5 12l1.8 1.8 3.5-3.6'],
  aparencia: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 3v18a9 9 0 0 0 0-18'],
  favoritos: ['M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z'],
  ajuda: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.3-2.4 3.8', 'M12 17h.01'],
}

/* O endereço da foto não muda quando a foto muda: /api/usuarios/7/foto
   continua /api/usuarios/7/foto, e o navegador serviria a antiga para
   sempre. O ?v= carimba a hora da última troca — endereço novo, imagem
   nova. É o mesmo truque do hash que o Vite põe no nome dos bundles.  */
function Foto({ de, inicial }: { de: Usuario | null; inicial: string }) {
  if (!de?.foto_em) return <>{inicial}</>

  return (
    <img
      className="avatar-img"
      alt=""
      src={`/api/usuarios/${de.id}/foto?v=${Date.parse(de.foto_em)}`}
    />
  )
}

/* Botão de alternar, não link: aria-pressed é o que faz o leitor de tela
   anunciar "marcado" / "não marcado" em vez de ler duas vezes o nome.   */
function Estrela({ ligada, aoClicar }: { ligada: boolean; aoClicar: () => void }) {
  return (
    <button
      type="button"
      className={'estrela' + (ligada ? ' ligada' : '')}
      aria-pressed={ligada}
      aria-label={ligada ? 'Desfavoritar' : 'Favoritar'}
      onClick={aoClicar}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
           fill={ligada ? 'currentColor' : 'none'} stroke="currentColor"
           strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />
      </svg>
    </button>
  )
}

function Icone({ nome }: { nome: keyof typeof TRACOS }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACOS[nome].map((d) => <path d={d} key={d} />)}
    </svg>
  )
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const PROXIMOS: Record<string, { status: string; rotulo: string }[]> = {
  aberto: [{ status: 'em_andamento', rotulo: 'Assumir' },
  { status: 'resolvido', rotulo: 'Resolver' },
  { status: 'cancelado', rotulo: 'Cancelar' }],
  em_andamento: [{ status: 'resolvido', rotulo: 'Resolver' },
  { status: 'cancelado', rotulo: 'Cancelar' }],
  resolvido: [{ status: 'aberto', rotulo: 'Reabrir' }],
  cancelado: [{ status: 'aberto', rotulo: 'Reabrir' }],
}

function App() {

  const [menuAberto, setMenuAberto] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const [sel, setSel] = useState(0)
  type Aviso = { tipo: "ok" | "erro"; texto: string }
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [semServidor, setSemServidor] = useState(false)
  const [recentes, setRecentes] = useState<string[]>([])
  const [vista, setVista] = useState<Vista>('inicio')
  const [secao, setSecao] = useState<Secao>('perfil')
  const [chamados, setChamados] = useState<Chamado[] | null>(null)
  const [erroChamados, setErroChamados] = useState(false)
  const [fila, setFila] = useState<ChamadoFila[] | null>(null)
  const [erroFila, setErroFila] = useState(false)
  const [ordem, setOrdem] = useState<'antigos' | 'recentes'>('antigos')
  const [recarga, setRecarga] = useState(0)
  const [mudando, setMudando] = useState<number | null>(null)
  const [apelidoForm, setApelidoForm] = useState('')
  const [bioForm, setBioForm] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [setorForm, setSetorForm] = useState<number | ''>('')
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [avisoPerfil, setAvisoPerfil] = useState<Aviso | null>(null)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [avisoSenha, setAvisoSenha] = useState<Aviso | null>(null)
  /* useState com FUNÇÃO em vez de valor: assim o localStorage é lido uma
     vez, na montagem. Passando window.UPTema.ler() direto, a leitura
     aconteceria a cada render e o valor seria jogado fora.              */
  const [tema, setTema] = useState<Tema>(() => window.UPTema?.ler() ?? 'sistema')

  const alternarSetor = (id: number) => {
    setAbertos((antigos) => {
      const novos = new Set(antigos) // <- cópia, não o mesmo Set
      if (novos.has(id)) novos.delete(id)
      else novos.add(id)
      return novos
    })
  }

  const registrar = (slug: string) => {
    if (!usuario) return
    setRecentes(registrarRecente(usuario.id, slug))
  }

  const abrir = (item: (typeof TODAS)[number]) => {
    registrar(item.slug)
    if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  const abrirChamado = async () => {
    if (enviando) return              // dedo nervoso: o segundo Enter não abre outro chamado
    setEnviando(true)
    setAviso(null)

    try {
      const r = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: termo.trim().slice(1) }),   // sem o @
      })

      if (r.status === 401) { location.href = '/entrar.html'; return }

      if (r.status === 422) {
        const corpo = await r.json().catch(() => ({}))
        const tipo = corpo.detail?.[0]?.type
        setAviso({
          tipo: 'erro',
          texto: tipo === 'string_too_long'
            ? 'O texto passou do limite de 4000 caracteres.'
            : 'Descreva o problema com um pouco mais de detalhe.',
        })
        return
      }

      if (!r.ok) {
        setAviso({ tipo: 'erro', texto: 'Não foi possível abrir o chamado. Tente de novo.' })
        return
      }

      const chamado = await r.json()
      setTermo('')
      setAviso({
        tipo: 'ok',
        texto: `Chamado #${chamado.id} aberto. Use esse número se precisar falar com a equipe sobre ele.`,
      })
    } catch {
      setAviso({ tipo: 'erro', texto: 'Sem conexão com o servidor. Seu texto continua aí — tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  const aoTeclarNaCaixa = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (modoChamado) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()             // Enter envia; Shift+Enter continua quebrando linha
        abrirChamado()
      }
      return
    }

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
  const caixaRef = useRef<HTMLTextAreaElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

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
  const dica = useDigitacao(FRASES, termo === '')

  const achados = useMemo(() => {
    if (ehChamado(termo)) return []
    const t = normalizar(termo).trim()
    if (!t) return []
    const partes = t.split(/\s+/)
    return TODAS.filter((i) => partes.every((p) => i.chave.includes(p))).slice(0, 6)
  }, [termo, TODAS])

  /* Ordem: a favoritada mais recentemente primeiro. É a regra que decide
     quais vão para os cards do Perfil, sem precisar de uma coluna
     "principal" que alguém teria que manter.                            */
  const favoritas = useMemo(
    () => TODAS.filter((a) => a.favorita)
               .sort((x, y) => (y.favorita_em ?? '').localeCompare(x.favorita_em ?? '')),
    [TODAS],
  )

  const nomeSetor = useMemo(
    () => setores.find((s) => s.id === usuario?.setor_id)?.nome ?? null,
    [setores, usuario],
  )

  const itensRecentes = useMemo(
    () => recentes.flatMap((slug) => TODAS.filter((a) => a.slug === slug)), [recentes, TODAS],
  )

  /* Pinta ANTES da resposta e desfaz se o servidor recusar. A estrela tem
     que reagir no clique; esperar a rede faria ela parecer emperrada. O
     preço é a tela poder mentir por um instante — por isso o desfazer
     devolve exatamente o valor que estava lá.                            */
  const alternarFavorito = async (id: number, estaFavorita: boolean) => {
    const alvo = !estaFavorita
    const pintar = (v: boolean) =>
      setSetores((antes) =>
        antes.map((s) => ({
          ...s,
          automacoes: s.automacoes.map((a) => (a.id === id ? { ...a, favorita: v } : a)),
        })),
      )

    pintar(alvo)
    try {
      const r = await fetch(`/api/automacoes/${id}/favorito`, {
        method: alvo ? 'PUT' : 'DELETE',      // PUT marca, DELETE desmarca
      })
      if (r.status === 401) { location.href = '/entrar.html'; return }
      if (!r.ok) throw new Error('falhou')
    } catch {
      pintar(estaFavorita)
      setAviso({ tipo: 'erro', texto: 'Não deu para salvar o favorito.' })
    }
  }

  const mudarStatus = async (id: number, status: string) => {
    setMudando(id)
    try {
      const r = await fetch(`/api/triagem/chamados/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) throw new Error('patch')
      setRecarga((n) => n + 1)
    } catch {
      setErroFila(true)
    } finally {
      setMudando(null)
    }
  }

  /* Cada porta do menu entra numa seção diferente, e o formulário é
     recarregado do usuário atual a cada abertura — assim um Salvar que
     falhou não deixa texto velho na tela da próxima vez.               */
  const abrirConfig = (alvo: Secao) => {
    setApelidoForm(usuario?.apelido ?? '')
    setBioForm(usuario?.bio ?? '')
    setSetorForm(usuario?.setor_id ?? '')
    setSenhaAtual(''); setSenhaNova('')
    setAvisoPerfil(null); setAvisoSenha(null)
    setSecao(alvo)
    setVista('config')
    setPainelAberto(false)
  }

  /* A Ajuda não inventa canal novo: ela leva para o chamado que já
     existe. O textarea só nasce depois que a vista troca, então o foco
     espera o próximo quadro.                                           */
  const pedirAjuda = () => {
    setTermo('@ ')
    setVista('inicio')
    requestAnimationFrame(() => caixaRef.current?.focus())
  }

  const salvarPerfil = async () => {
    setSalvandoPerfil(true)
    setAvisoPerfil(null)
    try {
      const r = await fetch('/api/eu/perfil', {
        method: 'PUT',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify({
          apelido: apelidoForm,
          setor_id: setorForm === '' ? null : Number(setorForm),
          bio: bioForm,
        }),
      })
      if (r.status === 401) { location.href = '/entrar.html'; return }
      if (!r.ok) throw new Error('perfil')

      const atualizado = await r.json()
      setUsuario(atualizado)                       // a saudação muda na hora
      setApelidoForm(atualizado.apelido ?? '')     // mostra o que o servidor guardou
      setBioForm(atualizado.bio ?? '')
      setAvisoPerfil({ tipo: 'ok', texto: 'Perfil salvo.' })
    } catch {
      setAvisoPerfil({ tipo: 'erro', texto: 'Não foi possível salvar. Tente de novo.' })
    } finally {
      setSalvandoPerfil(false)
    }
  }

  const enviarFoto = async (arquivo: File) => {
    /* Conforto, não segurança: evita subir 5 MB para ouvir não. Quem
       decide continua sendo o servidor — isto some com um F12.        */
    if (arquivo.size > 4 * 1024 * 1024) {
      setAvisoPerfil({ tipo: 'erro', texto: 'A imagem passa de 4 MB.' })
      return
    }

    setEnviandoFoto(true)
    setAvisoPerfil(null)
    try {
      /* FormData é o que vira multipart/form-data. NÃO escreva o header
         Content-Type aqui: ele precisa levar um "boundary" sorteado na
         hora, e o navegador só escreve isso se o campo estiver vazio.
         Pondo 'multipart/form-data' na mão, o corpo sai sem boundary e
         a rota responde 422 sem explicar o motivo.                     */
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)      // 'arquivo' = o nome do parâmetro na rota

      const r = await fetch('/api/eu/foto', { method: 'POST', body: corpo })
      if (r.status === 401) { location.href = '/entrar.html'; return }

      const resposta = await r.json().catch(() => null)
      if (!r.ok) throw new Error(resposta?.detail ?? 'Não deu para enviar.')

      // trocar foto_em muda o ?v= da imagem, e só por isso ela aparece
      setUsuario((antes) => antes && { ...antes, foto_em: resposta.foto_em })
      setAvisoPerfil({ tipo: 'ok', texto: 'Foto atualizada.' })
    } catch (e) {
      setAvisoPerfil({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não deu para enviar.' })
    } finally {
      setEnviandoFoto(false)
      /* Sem isto, escolher o MESMO arquivo de novo não dispara onChange
         e parece que o botão quebrou.                                  */
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  const removerFoto = async () => {
    setEnviandoFoto(true)
    setAvisoPerfil(null)
    try {
      const r = await fetch('/api/eu/foto', { method: 'DELETE' })
      if (r.status === 401) { location.href = '/entrar.html'; return }
      if (!r.ok) throw new Error('falhou')

      setUsuario((antes) => antes && { ...antes, foto_em: null })
      setAvisoPerfil({ tipo: 'ok', texto: 'Foto removida.' })
    } catch {
      setAvisoPerfil({ tipo: 'erro', texto: 'Não deu para remover.' })
    } finally {
      setEnviandoFoto(false)
    }
  }

  const trocarTema = (novo: Tema) => {
    window.UPTema?.salvar(novo)   // muda a tela e lembra a escolha
    setTema(novo)                // muda qual botão aparece marcado
  }

  const trocarSenha = async () => {
    setSalvandoSenha(true)
    setAvisoSenha(null)
    try {
      const r = await fetch('/api/eu/senha', {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify({
          atual: senhaAtual,
          nova: senhaNova
        }),
      })
      if (r.status === 401) { location.href = '/entrar.html'; return }

      if (r.status === 422) {
        const corpo = await r.json().catch(() => ({}))
        const d = corpo.detail
        setAvisoSenha({
          tipo: 'erro',
          texto: typeof d === 'string' ? d : 'A nova senha precisa ter pelo menos 8 caracteres.',
        })
        return
      }
      if (!r.ok) throw new Error('senha')

      setSenhaAtual(''); setSenhaNova('')
      setAvisoSenha({ tipo: 'ok', texto: 'Senha trocada. As outras sessões foram encerradas.' })
    } catch {
      setAvisoSenha({ tipo: 'erro', texto: 'Não foi possível trocar a senha. Tente de novo' })
    } finally {
      setSalvandoSenha(false)
    }
  }

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
      .catch(() => { if (vivo) setSemServidor(true) })
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
      .then((r) => {
        if (r.status === 401) return []          // o efeito do /api/eu já te manda pro login
        if (!r.ok) throw new Error('catalogo')   // 500 não é "catálogo vazio", é problema
        return r.json()
      })
      .then((dados) => { if (vivo) setSetores(dados) })
      .catch(() => { if (vivo) setSemServidor(true) })

    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (usuario) setRecentes(lerRecentes(usuario.id))
  }, [usuario])

  useEffect(() => {
    if (vista !== 'entrada') return

    let vivo = true
    setChamados(null)
    setErroChamados(false)

    fetch('/api/chamados')
      .then((r) => {
        if (!r.ok) throw new Error('chamados')
        return r.json()
      })
      .then((dados) => { if (vivo) setChamados(dados) })
      .catch(() => { if (vivo) setErroChamados(true) })

    return () => { vivo = false }
  }, [vista])

  useEffect(() => {
    if (vista !== 'triagem') return

    let vivo = true
    setFila(null)
    setErroFila(false)

    fetch(`/api/triagem/chamados?ordem=${ordem}`)
      .then((r) => {
        if (!r.ok) throw new Error('fila')
        return r.json()
      })
      .then((dados) => { if (vivo) setFila(dados) })
      .catch(() => { if (vivo) setErroFila(true) })

    return () => { vivo = false }
  }, [vista, ordem, recarga])

  return (
    <>
      <div className="grain"></div>

      <aside className={menuAberto ? 'side aberta' : 'side'} inert={!menuAberto}>
        <div className="side-logo">
          <div className="logo"><img src="/assets/logo-up.png" alt="" /></div>
        </div>

        <nav className="side-acoes">
          <button
            className="side-acao"
            type="button"
            disabled
            title="Conversas por setor — ainda não existe"
          >
            <Icone nome="grupo" />
            Criar grupo
            <span className="side-breve">em breve</span>
          </button>

          {usuario?.papel === 'suporte' && (
            <button
              className="side-acao"
              type="button"
              onClick={() => { setVista('triagem'); setMenuAberto(false) }}
            >
              <Icone nome="chamados" />
              Chamados
            </button>
          )}

          <button
            className="side-acao"
            type="button"
            onClick={() => { setVista('entrada'); setMenuAberto(false) }}
          >
            <Icone nome="entrada" />
            Caixa de entrada
          </button>
        </nav>

        <hr className="side-divisor" />

        <div className="side-group open">
          <button className="side-head" type="button">
            <Icone nome="automacoes" />
            Automações
          </button>
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
                          <div className="side-item" key={a.slug}>
                            <a
                              className={a.url ? 'side-link on' : 'side-link'}
                              href={a.url ?? '#'}
                              target={a.url ? '_blank' : undefined}
                              rel="noopener noreferrer"
                              title={a.descricao}
                              onClick={() => registrar(a.slug)}
                            >
                              <span className="dot"></span>
                              {a.nome}
                            </a>
                            <Estrela ligada={a.favorita} aoClicar={() => alternarFavorito(a.id, a.favorita)} />
                          </div>
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
          <span className="avatar"><Foto de={usuario} inicial={inicial} /></span>
          <span><b>{tratamento}</b><span>{usuario?.nome ?? ''}</span></span>
        </div>
        <a href="#"
          role="menuitem"
          onClick={(e) => { e.preventDefault(); abrirConfig('aparencia') }}
        >Personalizar</a>
        <hr />
        <a href="#"
          role="menuitem"
          onClick={(e) => {
            e.preventDefault(); setVista('perfil'); setPainelAberto(false)
          }}
        >Perfil</a>
        <a
          href="#"
          role="menuitem"
          onClick={(e) => {
            e.preventDefault(); setVista('entrada'); setPainelAberto(false)
          }}
        >Caixa de entrada</a>
        {usuario?.papel === 'suporte' && (
          <a
            href="#"
            role="menuitem"
            onClick={(e) => { e.preventDefault(); setVista('triagem'); setPainelAberto(false) }}
          >Triagem</a>
        )}
        <a href="#"
          role="menuitem"
          onClick={(e) => { e.preventDefault(); abrirConfig('conta') }}
        >Configurações</a>
        <hr />
        <a
          href="/entrar.html"
          className="sair"
          role="menuitem"
          onClick={(e) => { e.preventDefault(); sair() }}
        >Sair</a>
      </div>

      {/* A trama fica FORA do .app, irmã dele. Ela já esteve dentro do
          palco, e aí o backdrop-filter do palco nunca a alcançava: um filho
          é pintado na FRENTE do fundo do pai, e backdrop-filter só enxerga
          o que está atrás. Como irmã, ela fica atrás e o vidro pega.

          A condição mantém o ciclo de vida: sair do Perfil desmonta o
          componente e o cleanup chama o parar() que o app.js devolveu.   */}
      {vista === 'perfil' && <Trama />}

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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
              </svg>
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
            ><Foto de={usuario} inicial={inicial} /></button>
          </header>

          {semServidor && (
            <div className="faixa-offline" role="alert" >
              Sem conexão com o servidor do hub. Suas automações e seu nome não carregaram.
              <button type="button" className="btn" onClick={() => location.reload()}>
                Tentar de novo
              </button>
            </div>
          )}

          <main className={'stage' + (vista === 'perfil' ? ' com-trama' : '') + (vista === 'config' ? ' no-alto' : '')}>
            {vista === 'perfil' ? (

              <>
                <section className="perfil-pagina">
                  <aside className="perfil-lado">
                    <div className="perfil-bloco">
                      <span className="avatar perfil-foto" aria-hidden="true">
                        <Foto de={usuario} inicial={inicial} />
                      </span>

                      <h2 className="perfil-nome">{usuario?.nome ?? ''}</h2>
                      <p className="perfil-apelido">{tratamento}</p>

                      {usuario?.bio
                        ? <p className="perfil-bio">{usuario.bio}</p>
                        : <p className="perfil-bio vazia">Sem bio ainda.</p>}

                      <dl className="perfil-dados">
                        <div>
                          <dt>Setor</dt>
                          <dd>{nomeSetor ?? 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{usuario?.email ?? ''}</dd>
                        </div>
                      </dl>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => abrirConfig('perfil')}
                      >Editar perfil</button>
                    </div>
                  </aside>

                  <div className="perfil-corpo">
                    <section className="perfil-bloco">
                      <div className="perfil-topo">
                        <h3>Favoritos</h3>
                        {favoritas.length > 3 && (
                          <button
                            type="button"
                            className="botao-texto"
                            onClick={() => abrirConfig('favoritos')}
                          >ver os {favoritas.length}</button>
                        )}
                      </div>

                      {favoritas.length > 0 ? (
                        <div className="cards">
                          {favoritas.slice(0, 3).map((a) => (
                            <a
                              className="card"
                              key={a.slug}
                              href={a.url ?? '#'}
                              target={a.url ? '_blank' : undefined}
                              rel="noopener noreferrer"
                              onClick={() => registrar(a.slug)}
                            >
                              <span className="card-topo">
                                <img className="card-logo" src="/assets/logo-up.png" alt="" />
                                <b>{a.nome}</b>
                              </span>
                              <small>{a.descricao}</small>
                              <span className="card-setor">{a.setor}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="config-vazio">
                          Marque uma automação com a estrela, na gaveta ou na
                          busca, e as três mais recentes aparecem aqui.
                        </p>
                      )}
                    </section>

                    <section className="perfil-bloco">
                      <h3>Uso no ano</h3>
                      <p className="config-vazio">
                        O hub ainda não registra quem rodou o quê. Isso depende de
                        uma conversa com o time, porque passa a ser medição de
                        trabalho — e ela ainda não aconteceu. Quando acontecer, o
                        ano inteiro aparece aqui, agrupado por competência.
                      </p>
                    </section>
                  </div>
                </section>
              </>

            ) : vista === 'config' ? (

              <section className="config">
                {/* Quem está sendo configurado vem antes do que se configura:
                    a foto e o nome respondem "de quem é esta conta" sem o
                    usuário precisar perguntar.                             */}
                <header className="config-id">
                  <span className="avatar config-id-foto" aria-hidden="true">
                    <Foto de={usuario} inicial={inicial} />
                  </span>
                  <div className="config-id-txt">
                    <b>{usuario?.nome ?? ''}</b>
                    {usuario?.apelido && <span>{usuario.apelido}</span>}
                  </div>
                  <button type="button" className="btn" onClick={() => setVista('inicio')}>Voltar</button>
                </header>

                <div className="config-corpo">
                  {/* Lista à esquerda. São <button> de verdade: o Tab passa por
                      todos e o Enter entra, sem nenhum JS de teclado. */}
                  <nav className="config-nav" aria-label="Seções das configurações">
                    {SECOES.map(([id, rotulo]) => (
                      <button
                        key={id}
                        type="button"
                        className={'config-item' + (secao === id ? ' ativa' : '')}
                        aria-current={secao === id ? 'true' : undefined}
                        onClick={() => setSecao(id)}
                      >
                        <Icone nome={id} />
                        {rotulo}
                      </button>
                    ))}
                  </nav>

                  {/* Só o cômodo atual é montado. É por isso que aqui NÃO
                      precisa de inert: o que não está na tela também não está
                      no DOM, então não tem como receber foco. */}
                  <div className="config-painel">

                    {secao === 'perfil' && (
                      <>
                        <h3>Perfil</h3>
                        <p className="config-dica">Como você aparece para o resto do time.</p>


                        <div className="config-identidade">
                          {/* O avatar É o botão. O input de arquivo fica escondido
                              com `hidden`, que o tira do Tab mas deixa o .click()
                              funcionar — assim existe um controle só, não dois. */}
                          <button
                            type="button"
                            className="avatar avatar-g foto-troca"
                            onClick={() => arquivoRef.current?.click()}
                            disabled={enviandoFoto}
                            aria-label="Trocar foto de perfil"
                          >
                            <Foto de={usuario} inicial={inicial} />
                            <span className="foto-capa">{enviandoFoto ? '…' : 'Trocar'}</span>
                          </button>

                          <input
                            ref={arquivoRef}
                            type="file"
                            hidden
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const a = e.target.files?.[0]
                              if (a) enviarFoto(a)
                            }}
                          />

                          {/* O nome já está no cabeçalho da tela. Aqui o bloco
                              responde outra pergunta: o que esta foto é e o que
                              dá para fazer com ela.                            */}
                          <div>
                            <b>Foto de perfil</b>
                            <span>Clique na imagem para trocar.</span>
                            {usuario?.foto_em && (
                              <button
                                type="button"
                                className="botao-texto"
                                onClick={removerFoto}
                                disabled={enviandoFoto}
                              >Remover foto</button>
                            )}
                          </div>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); salvarPerfil() }}>
                          <div className="field">
                            <label htmlFor="c-bio">Bio</label>
                            <textarea
                              id="c-bio"
                              rows={3}
                              maxLength={280}
                              value={bioForm}
                              onChange={(e) => setBioForm(e.target.value)}
                              placeholder="Uma linha sobre o que você faz por aqui."
                            />
                            {/* O maxLength é conforto: ele impede de digitar além.
                                Quem manda de verdade é o servidor, porque o
                                atributo some com um F12 e o servidor não. */}
                            <p className="config-contador">{bioForm.length}/280</p>
                          </div>

                          <BotaoLuz type="submit" disabled={salvandoPerfil}>
                            {salvandoPerfil ? 'Salvando…' : 'Salvar'}
                          </BotaoLuz>
                        </form>

                        <div role="status">
                          {avisoPerfil && <div className={`aviso ${avisoPerfil.tipo}`}>{avisoPerfil.texto}</div>}
                        </div>

                        <p className="config-vazio">
                          PNG, JPEG ou WEBP até 4 MB. A imagem é recortada no
                          centro e reduzida para 256×256.
                          Apelido e setor ficam em <b>Conta</b>.
                        </p>
                      </>
                    )}

                    {secao === 'conta' && (
                      <>
                        <h3>Conta</h3>

                        <div className="field">
                          <label htmlFor="c-email">Email</label>
                          <input id="c-email" value={usuario?.email ?? ''} readOnly />
                        </div>
                        <p className="config-nota">
                          É por ele que você entra. Trocar ainda não dá por aqui — fale com o suporte.
                        </p>

                        <form onSubmit={(e) => { e.preventDefault(); salvarPerfil() }}>
                          <div className="field">
                            <label htmlFor="c-apelido">Como o hub te chama</label>
                            <input
                              id="c-apelido"
                              value={apelidoForm}
                              onChange={(e) => setApelidoForm(e.target.value)}
                              placeholder={usuario?.nome.split(' ')[0] ?? ''}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="c-setor">Setor</label>
                            <select
                              id="c-setor"
                              value={setorForm}
                              onChange={(e) => setSetorForm(e.target.value === '' ? '' : Number(e.target.value))}>
                              <option value="">- Não informado -</option>
                              {setores.map((s) => (
                                <option value={s.id} key={s.id}>{s.nome}</option>
                              ))}
                            </select>
                          </div>

                          <BotaoLuz type="submit" disabled={salvandoPerfil}>
                            {salvandoPerfil ? 'Salvando…' : 'Salvar'}
                          </BotaoLuz>
                        </form>

                        <div role="status">
                          {avisoPerfil && <div className={`aviso ${avisoPerfil.tipo}`}>{avisoPerfil.texto}</div>}
                        </div>

                        <hr className="perfil-divisor" />

                        <h3>Trocar senha</h3>
                        <form onSubmit={(e) => { e.preventDefault(); trocarSenha() }}>
                          <div className="field">
                            <label htmlFor="c-atual">Senha atual</label>
                            <input id="c-atual" type="password" autoComplete="current-password"
                              value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
                          </div>
                          <div className="field">
                            <label htmlFor="c-nova">Nova senha</label>
                            <input id="c-nova" type="password" autoComplete="new-password"
                              value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
                          </div>
                          <BotaoLuz type="submit" disabled={salvandoSenha}>
                            {salvandoSenha ? 'Trocando…' : 'Trocar senha'}
                          </BotaoLuz>
                        </form>

                        <div role="status">
                          {avisoSenha && <div className={`aviso ${avisoSenha.tipo}`}>{avisoSenha.texto}</div>}
                        </div>

                        <p className="config-vazio">
                          Adicionar colegas depende do chat, que ainda não existe.
                        </p>
                      </>
                    )}

                    {secao === 'aparencia' && (
                      <>
                        <h3>Aparência</h3>
                        <fieldset className="tema-campo">
                          <legend>Tema do hub</legend>
                          <p className="config-dica">
                            "Seguir o sistema" acompanha o Windows ao vivo: se ele mudar, o hub
                            muda. A escolha também vale para a tela de entrar.
                          </p>
                          <div className="tema-opcoes">
                            {TEMAS.map(([valor, rotulo]) => (
                              <label key={valor} className={'tema-opcao' + (tema === valor ? ' ativa' : '')}>
                                <input
                                  type="radio"
                                  name="tema"
                                  value={valor}
                                  checked={tema === valor}
                                  onChange={() => trocarTema(valor)}
                                />
                                {rotulo}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}

                    {secao === 'favoritos' && (
                      <>
                        <h3>Favoritos</h3>
                        {favoritas.length > 0 ? (
                          <>
                            <p className="config-dica">
                              Marcadas por você. A estrela também fica na gaveta e na busca.
                            </p>
                            <div className="fav-lista">
                              {favoritas.map((a) => (
                                <div className="fav-item" key={a.slug}>
                                  <div>
                                    <b>{a.nome}</b>
                                    <span>{a.descricao}</span>
                                  </div>
                                  <Estrela ligada aoClicar={() => alternarFavorito(a.id, true)} />
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="config-vazio">
                            Nenhuma automação favoritada ainda. A estrela fica ao
                            lado de cada uma, na gaveta e nos resultados da busca.
                          </p>
                        )}
                      </>
                    )}

                    {secao === 'ajuda' && (
                      <>
                        <h3>Ajuda</h3>
                        <p className="config-dica">
                          Travou em alguma coisa? Abra um chamado que o suporte responde.
                        </p>
                        <BotaoLuz type="button" onClick={pedirAjuda}>
                          Abrir um chamado
                        </BotaoLuz>
                        <p className="config-nota">
                          O andamento fica em <b>Caixa de entrada</b>.
                        </p>
                      </>
                    )}

                  </div>
                </div>
              </section>

            ) : vista === 'triagem' ? (
              <section className="entrada">
                <div className="entrada-topo">
                  <h2>Triagem</h2>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setOrdem(ordem === 'antigos' ? 'recentes' : 'antigos')}
                  >
                    {ordem === 'antigos' ? 'Mais antigos primeiro ↑' : 'Mais recentes primeiro ↓'}
                  </button>
                  <button type="button" className="btn" onClick={() => setVista('inicio')}>Voltar</button>
                </div>

                {erroFila && <div className="aviso erro">Não foi possível carregar a fila.</div>}
                {!erroFila && fila === null && <p className="recentes-vazio">Carregando…</p>}
                {fila?.length === 0 && <p className="recentes-vazio">Nenhum chamado na fila.</p>}

                {fila && fila.length > 0 && (
                  <div className="chamados">
                    {fila.map((c) => (
                      <article className="chamado" key={c.id}>
                        <div className="chamado-topo">
                          <span className="chamado-num">#{c.id}</span>
                          <span className={`estado ${c.status}`}>{ROTULO[c.status] ?? c.status}</span>
                          <span className="chamado-num">{c.aberto_por}</span>
                          <span className="chamado-quando">{quando(c.criado_em)}</span>
                        </div>
                        <p>{c.descricao}</p>
                        <div className="fila-acoes">
                          {(PROXIMOS[c.status] ?? []).map((acao) => (
                            <button
                              type="button"
                              className="btn"
                              key={acao.status}
                              disabled={mudando === c.id}
                              onClick={() => mudarStatus(c.id, acao.status)}
                            >{acao.rotulo}</button>
                          ))}
                          {c.atendido_por && (
                            <span className="chamado-quando">por {c.atendido_por}</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : vista === 'entrada' ? (
              <section className="entrada">
                <div className="entrada-topo">
                  <h2>Caixa de entrada</h2>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setVista('inicio')}
                  >Voltar</button>
                </div>
                {erroChamados && (
                  <div className="aviso erro">Não foi possível carregar seus chamados.</div>
                )}

                {!erroChamados && chamados === null && (
                  <p className="recentes-vazio">Carregando...</p>
                )}

                {chamados?.length === 0 && (
                  <p className="recentes-vazio">
                    Você ainda não abriu nenhum chamado. Digite <b>@</b> na caixa de busca para abrir o primeiro.
                  </p>
                )}

                {chamados && chamados.length > 0 && (
                  <div className="chamados">
                    {chamados.map((c) => (
                      <article className="chamado" key={c.id}>
                        <div className="chamado-topo">
                          <span className="chamado-num">#{c.id}</span>
                          <span className={`estado ${c.status}`}>{ROTULO[c.status] ?? c.status}</span>

                          {c.automacao && <span className="chamado-num">{c.automacao}</span>}
                          <span className="chamado-quando">{quando(c.criado_em)}</span>
                        </div>
                        <p>{c.descricao}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

            ) : (

              <div className="stage-in">
                <p className="saudacao">
                  {usuario
                    ? <>Olá <span className="nome brilho">{tratamento}</span>, bem-vindo ao</>
                    : <>&nbsp;</>}
                </p>
                <h1 className="wordmark"><span className="b">UP</span> API <span className="b">HUB</span></h1>

                <div className={modoChamado ? 'cmd is-chamado' : 'cmd'}>
                  <label className="sr-only" htmlFor="q">Buscar automação ou digitar @ para abrir um chamado</label>
                  <textarea
                    id="q"
                    ref={caixaRef}
                    rows={3}
                    value={termo}
                    onChange={(e) => { setTermo(e.target.value); setSel(0); setAviso(null) }}
                    readOnly={enviando}
                    onKeyDown={aoTeclarNaCaixa}
                    placeholder={dica}
                  />

                  <div role="status">
                    {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
                  </div>

                  <div className="cmd-foot">
                    <span className="cmd-mode">{modoChamado ? 'Chamado' : 'Busca'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {enviando ? 'Enviando…' : modoChamado ? 'Descreva o problema e aperte Enter para abrir o chamado' : '↑↓ para escolher · Enter para abrir'}
                    </span>
                  </div>
                </div>

                <div className="results">
                  {achados.map((i, n) => (
                    <div
                      className={n === sel ? 'res-item sel' : 'res-item'}
                      key={i.slug}
                      onMouseEnter={() => setSel(n)}
                    >
                      <a
                        className="res"
                        href={i.url ?? '#'}
                        target={i.url ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        onClick={() => registrar(i.slug)}
                      >
                        <span><b>{i.nome}</b><br /><small>{i.descricao}</small></span>
                        <span className="setor">{i.setor}</span>
                      </a>
                      <Estrela ligada={i.favorita} aoClicar={() => alternarFavorito(i.id, i.favorita)} />
                    </div>
                  ))}
                  {!modoChamado && termo.trim() && achados.length === 0 && (
                    <div className="res-none">Nada encontrado para "{termo.trim()}".</div>
                  )}
                </div>

                <section className="recentes">
                  <h3>Recentes</h3>
                  <div className="recentes-box">
                    {itensRecentes.length > 0 ? (
                      itensRecentes.map((a) => (
                        <a
                          className={a.url ? 'chip on' : 'chip'}
                          href={a.url ?? '#'}
                          target={a.url ? '_blank' : undefined}
                          rel="noopener noreferrer"
                          title={a.descricao}
                          key={a.slug}
                          onClick={() => registrar(a.slug)}
                        >
                          <span className="dot"></span>{a.nome}
                        </a>
                      ))
                    ) : (
                      <div className="recentes-vazio">O que você abrir aparece aqui.</div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </>

  )
}

export default App
