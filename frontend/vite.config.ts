import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // o hub inteiro vive em localhost:8090/<algo> — o app fica em /app/
  base: '/app/',

  build: {
    // o FastAPI já serve tudo dentro de src/web/static/ na raiz do site;
    // construir direto ali dispensa qualquer passo de "copiar depois do build"
    outDir: '../src/web/static/app',
    emptyOutDir: true,
  },
})
