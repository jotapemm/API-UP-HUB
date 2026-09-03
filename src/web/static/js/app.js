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
const CINZA = [200, 205, 202];
const BRANCO = [255, 255, 255];
const VERDE = [0, 196, 140];
const TONS = [], TAMANHOS = [];
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

if (semMovimento) pintar(0);              // um frame só, bonito e parado


const misturar = (a, b, k) => a.map((c, n) => Math.round(c + (b[n] - c) * k));

for (let n = 0; n < NIVEIS; n++) {
    const v = n / (NIVEIS - 1);

    const cor = v < 0.5
        ? misturar(CINZA, BRANCO, v * 2)           //cinza -> branco
        : misturar(BRANCO, VERDE, (v - 0.5) * 2);  // branco -> verde

    TONS[n] = `rgba(${cor},${(0.12 + v * 0.45).toFixed(3)})`;
    TAMANHOS[n] = v < 0.34 ? 1 : (v < 0.70 ? 2 : 3);
}

const SPRITES = [];
for (let n = 0; n < NIVEIS; n++) {
    const s = TAMANHOS[n];
    const off = document.createElement("canvas")
    off.width = off.height = Math.ceil(2 * s * dpr);

    const o = off.getContext("2d");
    o.scale(dpr, dpr);
    o.fillStyle = TONS[n];
    o.beginPath();
    o.arc(s, s, s, 0, Math.PI * 2);
    o.fill();

    SPRITES[n] = off;
}

function loop(tempo) {
    pintar(tempo);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

dimensionar();
construir();