import { useEffect, useRef } from 'react'

declare global {
    interface Window {
        UPTrama?: { iniciar(canvas: HTMLCanvasElement): () => void }
    }
}

/* O componente não sabe desenhar nada. Ele só liga a trama quando entra
   na tela e chama o desligamento quando sai.

   O `return` de dentro do useEffect é a tarefa de desmontagem: o React
   guarda essa função e executa quando o componente some. É o mesmo
   contrato que o iniciar() devolve, por isso os dois encaixam direto. */
export default function Trama() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !window.UPTrama) return

        const parar = window.UPTrama.iniciar(canvas)
        return parar
    }, [])

    return <canvas id="trama" ref={canvasRef} aria-hidden="true" />
}