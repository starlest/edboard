import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { sourceKey, type SoundStatus } from '../audio/soundBank.ts'
import type { BoardState, PadConfig, Settings, SoundSource } from '../state/types.ts'
import type { DisplayState, Soundboard } from './soundboard.ts'

export const SoundboardContext = createContext<Soundboard | null>(null)

export function useSoundboard(): Soundboard {
  const soundboard = useContext(SoundboardContext)
  if (!soundboard) throw new Error('useSoundboard must be used inside <SoundboardContext.Provider>')
  return soundboard
}

/** Subscribes to a slice of the board. The selector must return stable references. */
export function useBoard<T>(selector: (state: BoardState) => T): T {
  const { store } = useSoundboard()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

export const usePad = (pad: number): PadConfig => useBoard((state) => state.pads[pad])
export const useSettings = (): Settings => useBoard((state) => state.settings)

/** True while the pad has a sounding voice. */
export function usePadLit(pad: number): boolean {
  const { engine } = useSoundboard()
  const subscribe = useCallback(
    (onChange: () => void) => engine.subscribe((event) => event.type === 'pad' && event.pad === pad && onChange()),
    [engine, pad],
  )
  return useSyncExternalStore(subscribe, () => engine.isPlaying(pad))
}

/** True while the pad is held down by mouse, touch or keyboard. */
export function usePadPressed(pad: number): boolean {
  const soundboard = useSoundboard()
  return useSyncExternalStore(soundboard.subscribePressed, () => soundboard.isPressed(pad))
}

export function useSoundStatus(source: SoundSource | null): SoundStatus {
  const { sounds } = useSoundboard()
  const key = source ? sourceKey(source) : null
  return useSyncExternalStore(sounds.subscribe, () => (key ? sounds.status(key) : 'idle'))
}

/** How many of the given sounds are still loading (for the boot screen). */
export function useLoadingCount(keys: readonly string[]): number {
  const { sounds } = useSoundboard()
  return useSyncExternalStore(sounds.subscribe, () => keys.filter((k) => sounds.status(k) === 'loading').length)
}

export function useDisplay(): DisplayState {
  const soundboard = useSoundboard()
  return useSyncExternalStore(soundboard.subscribeDisplay, soundboard.getDisplay)
}

export function useAudioState(): AudioContextState {
  const { engine } = useSoundboard()
  const subscribe = useCallback(
    (onChange: () => void) => engine.subscribe((event) => event.type === 'state' && onChange()),
    [engine],
  )
  return useSyncExternalStore(subscribe, () => engine.state)
}

export function useBankActive(bank: number): boolean {
  const soundboard = useSoundboard()
  const subscribe = useCallback(
    (onChange: () => void) => soundboard.engine.subscribe((event) => event.type === 'pad' && onChange()),
    [soundboard],
  )
  return useSyncExternalStore(subscribe, () => soundboard.bankActive(bank))
}

/** Runs `callback` on every animation frame while `active`. */
export function useFrame(callback: (now: number) => void, active = true): void {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  useEffect(() => {
    if (!active) return
    let frame = requestAnimationFrame(function tick(now) {
      latest.current(now)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active])
}

export type Layout = 'landscape' | 'portrait'

/** Natural (unscaled) device sizes used to pick the layout that gives the biggest pads. */
const DEVICE_SIZE: Record<Layout, { width: number; height: number }> = {
  landscape: { width: 1114, height: 744 },
  portrait: { width: 650, height: 1272 },
}

/** Room around the device; extra below for its front edge and shadow. */
const MARGIN_X = 24
const MARGIN_Y = 64
const MAX_SCALE = 1.6

/**
 * Picks landscape or portrait and a scale factor so the whole device fits the
 * window — like a real piece of hardware, it scales rather than reflows.
 */
export function useFitToWindow(): { layout: Layout; scale: number } {
  const compute = useCallback(() => {
    const width = Math.max(200, window.innerWidth - MARGIN_X)
    const height = Math.max(200, window.innerHeight - MARGIN_Y)
    const fit = (layout: Layout) =>
      Math.min(width / DEVICE_SIZE[layout].width, height / DEVICE_SIZE[layout].height, MAX_SCALE)
    const landscape = fit('landscape')
    const portrait = fit('portrait')
    // Prefer landscape unless portrait gives clearly bigger pads.
    return portrait > landscape * 1.12 ? { layout: 'portrait' as const, scale: portrait } : { layout: 'landscape' as const, scale: landscape }
  }, [])
  const [fit, setFit] = useState(compute)
  useEffect(() => {
    const update = () => setFit(compute())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [compute])
  return fit
}

export { DEVICE_SIZE }
