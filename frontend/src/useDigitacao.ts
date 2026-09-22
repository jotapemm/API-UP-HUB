import { useEffect, useState } from 'react'

// O base.css desliga as animações de CSS pra quem pediu menos movimento no sistema.
// Timer de JavaScript não obedece CSS nenhum, então essa checagem tem que ser feita aqui.
const semMovimento = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useDigitacao(frases: string[], ativo = true) {
    const [indice, setindice] = useState(0)          // qual frase
    const [tamanho, setTamanho] = useState(0)        // quantas letras dela aparecem
    const [apagando, setApagando] = useState(false)  // indo ou voltando
    const frase = frases[indice]

    useEffect(() => {
        if (!ativo || semMovimento()) return

        let espera: number
        let proximo: () => void

        if (!apagando && tamanho < frase.length) {
            espera = 45 + Math.random() * 50                       // digitando, num ritmo irregular
            proximo = () => setTamanho(tamanho + 1)
        } else if (!apagando) {
            espera = 1600                                          // frase completa: tempo de ler em milissegundos
            proximo = () => setApagando(true)
        } else if (tamanho > 0) {
            espera = 25                                            // apagando, mais rápido que digitar
            proximo = () => setTamanho(tamanho - 1)
        } else {
            espera = 350                                           // vazio: um respiro antes da próxima
            proximo = () => {
                setApagando(false)
                setindice((indice + 1) % frases.length)
            }
        }

        const t = setTimeout(proximo, espera)
        return () => clearTimeout(t)
    }, [ativo, apagando, tamanho, indice, frase, frases.length])

    if (semMovimento()) return frases.join(' . ')
    return frase.slice(0, tamanho)
}