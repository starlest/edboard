import type { BoardState, PadColor, PadConfig, PlayMode, Settings } from './types.ts'
import { PAD_COUNT, PADS_PER_BANK } from './types.ts'

/**
 * Default shortcuts mirror the pad grid on the keyboard: bank A lives under
 * the left hand (1-4 / Q-R / A-F / Z-V) and bank B under the right hand
 * (5-8 / T-I / G-K / B-,), so the key layout matches the pad layout.
 */
export const BANK_A_KEYS = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR',
  'KeyA', 'KeyS', 'KeyD', 'KeyF',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV',
] as const

export const BANK_B_KEYS = [
  'Digit5', 'Digit6', 'Digit7', 'Digit8',
  'KeyT', 'KeyY', 'KeyU', 'KeyI',
  'KeyG', 'KeyH', 'KeyJ', 'KeyK',
  'KeyB', 'KeyN', 'KeyM', 'Comma',
] as const

export type Preset = readonly [builtinId: string, label: string, color: PadColor, mode?: PlayMode]

/**
 * Bumped whenever the factory layout changes. Boards saved under an older
 * revision get their untouched pads moved to the new layout (see legacy.ts).
 */
export const FACTORY_REVISION = 2

/** Factory sounds, in pad order from A01. Everything after them starts empty. */
const FACTORY_PADS: readonly Preset[] = [
  ['fah', 'FAH!', 'red'],
  ['laugh', 'LAUGH', 'amber'],
  ['air-horn', 'AIR HORN', 'orange'],
  ['vine-boom', 'VINE BOOM', 'violet'],
  ['bruh', 'BRUH', 'teal'],
  ['sad-trombone', 'SAD TROMBONE', 'blue'],
  ['rimshot', 'BA DUM TSS', 'lime'],
  ['crickets', 'CRICKETS', 'green'],
]

export const DEFAULT_BANK_NAMES = ['MEMES', 'BANK B', 'BANK C', 'BANK D']

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  pitch: 0,
  echo: 0,
  limiter: true,
  solo: false,
  outputDeviceId: '',
  showKeys: true,
}

export function emptyPad(key: string | null = null): PadConfig {
  return { label: '', color: 'white', key, volume: 1, mode: 'oneshot', source: null, autoLevel: true }
}

/** Shortcut a pad gets out of the box: banks A and B are mapped, C and D are free. */
export function defaultKey(pad: number): string | null {
  const bank = Math.floor(pad / PADS_PER_BANK)
  const keys = bank === 0 ? BANK_A_KEYS : bank === 1 ? BANK_B_KEYS : null
  return keys?.[pad % PADS_PER_BANK] ?? null
}

export function presetPad(preset: Preset, key: string | null): PadConfig {
  const [id, label, color, mode = 'oneshot'] = preset
  return { label, color, key, volume: 1, mode, source: { kind: 'builtin', id }, autoLevel: true }
}

/** Factory configuration of a single pad. */
export function defaultPad(pad: number): PadConfig {
  const preset = FACTORY_PADS[pad]
  return preset ? presetPad(preset, defaultKey(pad)) : emptyPad(defaultKey(pad))
}

export function defaultBoard(): BoardState {
  return {
    version: 1,
    factoryRevision: FACTORY_REVISION,
    bank: 0,
    bankNames: [...DEFAULT_BANK_NAMES],
    pads: Array.from({ length: PAD_COUNT }, (_, pad) => defaultPad(pad)),
    settings: { ...DEFAULT_SETTINGS },
  }
}
