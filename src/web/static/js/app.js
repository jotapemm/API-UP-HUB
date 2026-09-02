const canvas = document.getElementById('trama');
const ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
       + Math.sin(y * 0.011 - t * 0.7)
       + Math.sin((x + y) * 0.0052 + t * 1.4);
}

const GAP = 11;
const FAIXAS = [
    { largura: 260, periodo: 14000, fase: 0 },
    { largura: 140, periodo: 9000, fase: 0.45 },
    { largura: 380, periodo: 21000, fase: 0.75 },
];
const NIVEIS = 16;
const CINZA  = [200, 205, 202];
const BRANCO = [255, 255, 255];
const VERDE  = [  0, 196, 140];

function construir() {
    pontos = [];
    // sua vez: dois laços aninhados, y e x, de GAP/2 até H (e W), de GAP em GAP.
    // cada ponto é só { x, y } — por enquanto não precisa de mais nada.
    for (let y = GAP / 2; y < H; y += GAP) {
        for (let x = GAP / 2; x < W; x += GAP) {
            pontos.push({ x, y })
        }
    }
}

const baldes = Array.from({length: NIVEIS }, () => []);

function pintar(tempo) {
    ctx.clearRect(0, 0, W, H);
    const t = tempo * 0.001;
    
    for(const b of baldes) b.length = 0;
    //ctx.fillStyle = "rgba(200, 205, 202, 0.22)";  // um cinza só, por enquanto
    /*const frentes = FAIXAS.map(f => {
        const curso = W + H + f.largura * 2;
        return {
            pos: (((tempo / f.periodo) + f.fase) % 1) * curso - f.largura,
            meia: f.largura / 2,
        };
    });*/

    // ── por PONTO ───────────────────────────────────────────────
    for (const p of pontos) {
        //const eixo = p.x + p.y;
        const v = (campo(p.x, p.y, t) + 3) / 6;
        const desl = (v - 0.5) * GAP * 1.9;
        const n = Math.min(NIVEIS - 1, Math.floor(v * NIVEIS));

        baldes[n].push(Math.round(p.x + desl), Math.round(p.y + desl * 0.6));
        //let i = 0;

        /*for (const f of frentes) {
            const d = Math.abs(eixo - f.pos);
            if (d < f.meia) i += 1 - d / f.meia;
        }*/

        //i = Math.min(1, i);
        //ctx.fillStyle = `rgba(255, 255, 255, ${0.20 + (0.55 - 0.20) * i})`;
        //ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        ctx.fillRect(Math.round(p.x + desl), Math.round(p.y + desl * 0.6), 1, 1);
    }
}

const misturar = (a, b, k) => a.map((c, n) => Math.round(c + (b[n] - c) * k));

const TONS = [], TAMANHOS = [];
for(let n = 0; m < NIVEIS; n++) {
    const v = n / (NIVEIS - 1);

    const cor = v < 0.5
        ? misturar (CINZA, BRANCO, v * 2)           //cinza -> branco
        : misturar (BRANCO, VERDE, (v - 0.5) * 2);  // branco -> verde

    TONS[n] = `rgba(${cor},${(0.12 + v * 0.45).toFixed(3)})`;
    TAMANHOS[n] = v < 0.34 ? 1 : (v < 0.70 ? 2 : 3);
}

function loop(tempo) {
    pintar(tempo);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

dimensionar();
construir();