import { useEffect, useMemo, useState } from 'react'

type Dia = { dia: string; execucoes: number }

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/* Rótulos alternados: sete nomes empilhados em 7 linhas de 13px viram um
   paredão ilegível. Domingo, terça, quinta e sábado dão a referência. */
const SEMANA = ['dom', '', 'ter', '', 'qui', '', 'sáb']

const diasDoAno = (ano: number) =>
  (new Date(ano + 1, 0, 1).getTime() - new Date(ano, 0, 1).getTime()) / 86_400_000

/* Quatro faixas tiradas do PRÓPRIO histórico da pessoa, não de números
   fixos. Quem roda 3 por dia e quem roda 80 precisam dos dois gráficos
   legíveis, e um limiar cravado deixaria um sempre pálido e o outro
   sempre no talo.                                                      */
function faixas(valores: number[]) {
  const vivos = valores.filter((v) => v > 0).sort((a, b) => a - b)
  if (!vivos.length) return [1, 2, 3]
  const corte = (p: number) => vivos[Math.min(vivos.length - 1, Math.floor(vivos.length * p))]
  return [corte(0.25), corte(0.5), corte(0.75)]
}

const nivel = (v: number, [a, b, c]: number[]) =>
  v <= 0 ? 0 : v <= a ? 1 : v <= b ? 2 : v <= c ? 3 : 4

export default function Calendario({ ano }: { ano: number }) {
  const [dias, setDias] = useState<Dia[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/eu/uso?ano=${ano}`)
      .then((r) => {
        if (r.status === 401) { location.href = '/entrar.html'; return null }
        if (!r.ok) throw new Error('uso')
        return r.json()
      })
      .then((d) => { if (vivo && d) setDias(d.dias) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }      // resposta atrasada não escreve em tela que já saiu
  }, [ano])

  const grade = useMemo(() => {
    const porDia = new Map((dias ?? []).map((d) => [d.dia, d.execucoes]))
    const total = diasDoAno(ano)

    /* O ano não começa no domingo. getDay() devolve 0 para domingo, então
       ele é direto o número de células vazias antes do primeiro dia —
       em 2026 o ano abre numa quinta, que é o 5º slot da coluna.        */
    const vazias = new Date(ano, 0, 1).getDay()

    const celulas: ({ data: Date; chave: string; execucoes: number } | null)[] =
      Array.from({ length: vazias }, () => null)

    for (let i = 0; i < total; i++) {
      const data = new Date(ano, 0, 1 + i)
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
      celulas.push({ data, chave, execucoes: porDia.get(chave) ?? 0 })
    }

    const limites = faixas([...porDia.values()])
    const colunas = Math.ceil(celulas.length / 7)

    /* Onde cada mês começa, em qual coluna. O rótulo vai em cima da coluna
       que contém o dia 1 — é a mesma leitura do GitHub.                 */
    const rotulos: { mes: number; coluna: number }[] = []
    celulas.forEach((c, i) => {
      if (c && c.data.getDate() === 1) rotulos.push({ mes: c.data.getMonth(), coluna: Math.floor(i / 7) + 1 })
    })

    return { celulas, limites, colunas, rotulos }
  }, [dias, ano])

  if (erro) {
    return <p className="config-vazio">Não deu para carregar o uso do ano. Tente recarregar.</p>
  }

  const total = (dias ?? []).reduce((s, d) => s + d.execucoes, 0)

  return (
    <div className="cal">
      <div className="cal-rolagem">
        <div className="cal-grade" style={{ ['--colunas' as string]: grade.colunas }}>
          <div className="cal-meses">
            {grade.rotulos.map((r) => (
              <span key={r.mes} style={{ gridColumn: r.coluna }}>{MESES[r.mes]}</span>
            ))}
          </div>

          <div className="cal-semana" aria-hidden="true">
            {SEMANA.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="cal-celulas">
            {grade.celulas.map((c, i) =>
              c === null
                ? <i className="cal-vazia" key={`v${i}`} aria-hidden="true" />
                : (
                  <i
                    key={c.chave}
                    className={`cal-dia n${nivel(c.execucoes, grade.limites)}`}
                    title={`${c.chave}: ${c.execucoes} ${c.execucoes === 1 ? 'execução' : 'execuções'}`}
                  />
                ),
            )}
          </div>
        </div>
      </div>

      <div className="cal-pe">
        <span>
          {dias === null
            ? 'Carregando…'
            : total === 0
              ? 'Nenhuma execução registrada em ' + ano + '.'
              : `${total} ${total === 1 ? 'execução' : 'execuções'} em ${ano}.`}
        </span>
        <span className="cal-legenda" aria-hidden="true">
          menos
          <i className="cal-dia n0" />
          <i className="cal-dia n1" />
          <i className="cal-dia n2" />
          <i className="cal-dia n3" />
          <i className="cal-dia n4" />
          mais
        </span>
      </div>
    </div>
  )
}
