import { useRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'

/* Botão sólido com a luz que nasce ONDE o ponteiro entrou.

   O JS aqui faz uma coisa só: guardar a coordenada da entrada em duas
   variáveis CSS. Quem cresce o círculo é o CSS, no ::before — assim a
   animação roda no compositor e o React não re-renderiza a cada pixel
   do mouse.

   A posição é lida no enter e no leave, de propósito. Se fosse no move,
   o círculo perseguiria o ponteiro e viraria outra coisa; lido só nas
   duas bordas, ele cresce de onde a mão chegou e encolhe para onde ela
   saiu.                                                                */
export default function BotaoLuz({
  className = '',
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null)

  const marcar = (e: MouseEvent<HTMLButtonElement>) => {
    const b = ref.current
    if (!b) return
    const r = b.getBoundingClientRect()
    b.style.setProperty('--mx', `${e.clientX - r.left}px`)
    b.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <button
      ref={ref}
      className={`btn btn-solid btn-luz ${className}`.trim()}
      onMouseEnter={marcar}
      onMouseLeave={marcar}
      {...resto}
    >
      {/* o rótulo precisa de camada própria para ficar acima do círculo */}
      <span className="btn-luz-txt">{children}</span>
    </button>
  )
}
