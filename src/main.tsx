import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

async function demarrer() {
  let appli: ReactNode
  if (import.meta.env.VITE_DEMO === '1') {
    const { Demo } = await import('./demo')
    appli = <Demo />
  } else {
    const { default: App } = await import('./App')
    appli = <App />
  }
  createRoot(document.getElementById('root')!).render(<StrictMode>{appli}</StrictMode>)
}

void demarrer()
