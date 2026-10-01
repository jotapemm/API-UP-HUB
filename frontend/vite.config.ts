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
  server: {
    // em dev a página vem do Vite (5173), mas os dados vêm do FastAPI (8090).
    // O que não é código do React é repassado pra lá.
    proxy: {
      '/api': 'http://localhost:8090',
      '/assets': 'http://localhost:8090',
      '/entrar.html': 'http://localhost:8090',
      '/css': 'http://localhost:8090',
      '/js': 'http://localhost:8090',

      // Em DEV o Vite prefixa o base nos caminhos absolutos do index.html:
      // /js/tema.js vira /app/js/tema.js. No build ele não mexe. Estas duas
      // regras desfazem o prefixo, para o mesmo HTML servir as duas pontas.
      '/app/js': {
        target: 'http://localhost:8090',
        rewrite: (caminho) => caminho.replace(/^\/app/, ''),
      },
      '/app/css': {
        target: 'http://localhost:8090',
        rewrite: (caminho) => caminho.replace(/^\/app/, ''),
      },
    },
  },
})
