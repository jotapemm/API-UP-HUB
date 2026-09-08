import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/web/static/css/base.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
