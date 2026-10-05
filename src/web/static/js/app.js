/* Em vez de rodar solto, a trama agora é LIGADA por alguém e devolve o
   próprio desligamento. Quem liga guarda essa função e chama na hora de
   sair — é o mesmo contrato do cleanup do useEffect, e por isso o React
   consegue usar sem saber nada de canvas.                              */
window.UPTrama = {
    iniciar(canvas) {
        const ctx = canvas.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        /* Estes três eram de módulo. Com duas tramas na mesma página elas
           brigariam pelas MESMAS variáveis; aqui dentro, cada chamada de
           iniciar() ganha o seu jogo.                                     */
        let W = 0, H = 0, pontos = [];

        function dimensionar() {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + "px";
            canvas.style.height = H + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function campo(x, y, t) {
            return Math.sin(x * 0.0075 + t)
                + Math.sin(y * 0.012 - t * 0.7)
                + Math.sin((x * 0.6 + y * 1.3) * 0.004 + t * 0.35);
        }


        const GAP = 11;
        const FAIXAS = [
            { largura: 260, periodo: 14000, fase: 0 },
            { largura: 140, periodo: 9000, fase: 0.45 },
            { largura: 380, periodo: 21000, fase: 0.75 },
        ];
        const NIVEIS = 16;
        const TONS = [], TAMANHOS = [], SPRITES = [];
        const baldes = Array.from({ length: NIVEIS }, () => []);

        function construir() {
            pontos = [];
            for (let y = GAP / 2; y < H; y += GAP) {
                for (let x = GAP / 2; x < W; x += GAP) {
                    pontos.push({
                        x: x + (Math.random() - 0.5) * GAP * 0.5,
                        y: y + (Math.random() - 0.5) * GAP * 0.5,
                    });
                }
            }
        }

        function pintar(tempo) {
            ctx.clearRect(0, 0, W, H);
            const t = tempo * 0.00012;

            for (const b of baldes) b.length = 0;

            // ── por PONTO ───────────────────────────────────────────────
            for (const p of pontos) {
                //const eixo = p.x + p.y;
                const v = (campo(p.x, p.y, t) + 3) / 6;
                const desl = (v - 0.5) * GAP * 1.9;
                const n = Math.min(NIVEIS - 1, Math.floor(v * NIVEIS));

                baldes[n].push(Math.round(p.x + desl), Math.round(p.y + desl * 0.6));

            }

            for (let n = 0; n < NIVEIS; n++) {
                const b = baldes[n];
                if (b.length === 0) continue;

                const sp = SPRITES[n];
                const s = TAMANHOS[n];

                for (let k = 0; k < b.length; k += 2) {
                    ctx.drawImage(sp, b[k] - s, b[k + 1] - s, s * 2, s * 2);
                }
            }
        }

        const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

        /* a decisão de animar ou não mora no fim do arquivo, depois que a
           trama existe de verdade */


        const misturar = (a, b, k) => a.map((c, n) => Math.round(c + (b[n] - c) * k));

        /* "rgb(10, 107, 81)" -> [10, 107, 81] */
        const emNumeros = (s) => s.match(/\d+/g).slice(0, 3).map(Number);

        /* Os nomes antigos passaram a mentir: no tema claro o degrau do meio é
           PRETO, não branco. Agora cada um se chama pelo LUGAR que ocupa na
           rampa, não pela cor que tinha num tema só.                         */

        function montarPaleta() {
            const BAIXO = emNumeros(UPTema.cor('--trama-baixo'));
            const MEIO = emNumeros(UPTema.cor('--trama-meio'));
            const ALTO = emNumeros(UPTema.cor('--trama-alto'));

            for (let n = 0; n < NIVEIS; n++) {
                const v = n / (NIVEIS - 1);

                const cor = v < 0.5
                    ? misturar(BAIXO, MEIO, v * 2)
                    : misturar(MEIO, ALTO, (v - 0.5) * 2);

                TONS[n] = `rgba(${cor},${(0.12 + v * 0.45).toFixed(3)})`;
                TAMANHOS[n] = v < 0.34 ? 1 : (v < 0.70 ? 2 : 3);

                /* O sprite é um carimbo com a cor JÁ ASSADA dentro dele. É por
                   isso que trocar de tema tem que refazer os 16: repintar o
                   canvas com os carimbos velhos não muda cor nenhuma.         */

                const s = TAMANHOS[n];
                const off = document.createElement("canvas");
                off.width = off.height = Math.ceil(2 * s * dpr);

                const o = off.getContext("2d");
                o.scale(dpr, dpr);
                o.fillStyle = TONS[n];
                o.beginPath();
                o.arc(s, s, s, 0, Math.PI * 2);
                o.fill();

                SPRITES[n] = off;
            }
        }

        montarPaleta();

        /* A ordem aqui importa: nada pode pintar antes de dimensionar() e
           construir(), senão o primeiro quadro sai vazio — era o que acontecia
           com o pintar(0) do movimento reduzido, lá em cima.                 */
        dimensionar();
        construir();
        /* Os identificadores ficam guardados FORA do `parar` para ele poder
           alcançá-los depois. É só um fechamento (closure): a função lembra
           das variáveis que existiam quando ela foi criada.                 */
        let quadro = null;
        let remontar = null;

        function loop(tempo) {
            pintar(tempo);
            quadro = requestAnimationFrame(loop);
        }

        /* Quem pediu movimento reduzido recebe UM quadro parado, e nenhum
           requestAnimationFrame fica vivo. Antes o loop subia de qualquer
           jeito e a checagem não desligava coisa nenhuma.                    */
        if (semMovimento) pintar(0);
        else quadro = requestAnimationFrame(loop);

        const aoTrocarTema = () => {
            montarPaleta();
            if (semMovimento) pintar(0);
        };

        const aoRedimensionar = () => {
            dimensionar();
            clearTimeout(remontar);
            remontar = setTimeout(() => {
                construir();
                if (semMovimento) pintar(0);
            }, 150);
        };

        /* Trocar de tema refaz os carimbos. Sem loop rodando não há quem
           redesenhe, então o quadro parado é repintado na mão.               */
        addEventListener('up:tema', aoTrocarTema);
        addEventListener("resize", aoRedimensionar);

        /* O desligamento. Repare que ele desfaz EXATAMENTE as quatro coisas
       que a função ligou, na ordem inversa. Se um dia entrar um quinto
       listener aqui em cima, tem que entrar um quinto removeEventListener
       aqui embaixo — é essa simetria que impede o vazamento.            */
        return function parar() {
            removeEventListener('resize', aoRedimensionar);
            removeEventListener('up:tema', aoTrocarTema);
            clearTimeout(remontar);
            if (quadro !== null) cancelAnimationFrame(quadro);
        };
    },
};


