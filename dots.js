/* ════════════════════════════════════════════════════════════════
   Pontinhos interativos de fundo (desviam do mouse e acendem em verde).
   Mesmo efeito do hero do hub, mas como FUNDO de página inteira: procura
   um <canvas id="dots"> que cubra a tela e ouve o mouse na janela toda.
   ════════════════════════════════════════════════════════════════ */
(function interactiveDots() {
  const canvas = document.getElementById("dots");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const GAP = 24;       // espaçamento entre pontos
  const RADIUS = 120;   // raio de influência do mouse
  const PUSH = 22;      // quanto o ponto foge
  const mouse = { x: -9999, y: -9999 };
  let pontos = [], W = 0, H = 0;

  function build() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pontos = [];
    for (let y = GAP / 2; y < H; y += GAP) {
      for (let x = GAP / 2; x < W; x += GAP) {
        pontos.push({ ox: x, oy: y, x, y });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pontos) {
      const dx = p.ox - mouse.x;
      const dy = p.oy - mouse.y;
      const dist = Math.hypot(dx, dy);

      let tx = p.ox, ty = p.oy, force = 0;
      if (dist < RADIUS) {
        force = (RADIUS - dist) / RADIUS;     // 0 (longe) → 1 (em cima)
        const ang = Math.atan2(dy, dx);
        tx = p.ox + Math.cos(ang) * force * PUSH;
        ty = p.oy + Math.sin(ang) * force * PUSH;
      }
      p.x += (tx - p.x) * 0.18;
      p.y += (ty - p.y) * 0.18;

      const alpha = 0.22 + force * 0.65;
      const rC = Math.round(200 + (47 - 200) * force);
      const gC = Math.round(200 + (217 - 200) * force);
      const bC = Math.round(200 + (106 - 200) * force);
      const size = 1.2 + force * 1.7;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  document.addEventListener("mouseleave", () => { mouse.x = mouse.y = -9999; });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(build, 150);
  });

  build();
  draw();
})();
