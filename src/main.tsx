import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { Soundboard } from './app/soundboard.ts'
import { loadKeyboardLayout } from './state/keys.ts'
import './styles/global.css'

const soundboard = new Soundboard()

if (import.meta.env.DEV) {
  // Handy for poking at the engine from the dev-tools console.
  ;(window as typeof window & { edboard?: Soundboard }).edboard = soundboard
}

// Learn the keyboard layout first (it's quick) so keycap labels match the user's keyboard.
const layoutReady = Promise.race([loadKeyboardLayout(), new Promise((resolve) => setTimeout(resolve, 250))])

void layoutReady.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App soundboard={soundboard} />
    </StrictMode>,
  )
})
