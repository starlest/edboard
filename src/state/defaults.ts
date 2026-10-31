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

type Preset = readonly [builtinId: string, label: string, color: PadColor, mode?: PlayMode]

const BANK_A: readonly Preset[] = [
  ['fah', 'FAH!', 'red'],
  ['air-horn', 'AIR HORN', 'orange'],
  ['rimshot', 'BA DUM TSS', 'lime'],
  ['sad-trombone', 'SAD TROMBONE', 'blue'],
  ['vine-boom', 'VINE BOOM', 'violet'],
  ['bruh', 'BRUH', 'teal'],
  ['crickets', 'CRICKETS', 'green'],
  ['applause', 'APPLAUSE', 'amber'],
  ['wrong', 'WRONG', 'red'],
  ['correct', 'CORRECT', 'green'],
  ['drum-roll', 'DRUM ROLL', 'orange'],
  ['dun-dun-dun', 'DUN DUN DUN', 'violet'],
  ['record-scratch', 'SCRATCH', 'magenta'],
  ['bonk', 'BONK', 'amber'],
  ['victory', 'VICTORY', 'cyan'],
  ['bleep', 'BLEEP', 'white', 'hold'],
]

const BANK_B: readonly Preset[] = [
  ['oof', 'OOF', 'pink'],
  ['wow', 'WOW', 'magenta'],
  ['laser', 'LASER', 'cyan'],
  ['explosion', 'EXPLOSION', 'orange'],
  ['boing', 'BOING', 'lime'],
  ['whoosh', 'WHOOSH', 'teal'],
  ['coin', 'COIN', 'amber'],
  ['power-up', 'POWER UP', 'green'],
  ['game-over', 'GAME OVER', 'red'],
  ['cha-ching', 'CHA-CHING', 'green'],
  ['heartbeat', 'HEARTBEAT', 'pink'],
  ['alarm', 'ALARM', 'red'],
  ['countdown', 'COUNTDOWN', 'blue'],
  ['suspense', 'SUSPENSE', 'violet'],
  ['slide-whistle', 'SLIDE WHISTLE', 'cyan'],
  ['gong', 'GONG', 'amber'],
]

export const DEFAULT_BANK_NAMES = ['MEMES', 'SFX', 'BANK C', 'BANK D']

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

/** Factory configuration of a single pad. */
export function defaultPad(pad: number): PadConfig {
  const bank = Math.floor(pad / PADS_PER_BANK)
  const slot = pad % PADS_PER_BANK
  const presets = bank === 0 ? BANK_A : bank === 1 ? BANK_B : null
  const keys = bank === 0 ? BANK_A_KEYS : bank === 1 ? BANK_B_KEYS : null
  const preset = presets?.[slot]
  const key = keys?.[slot] ?? null
  if (!preset) return emptyPad(key)
  const [id, label, color, mode = 'oneshot'] = preset
  return { label, color, key, volume: 1, mode, source: { kind: 'builtin', id }, autoLevel: true }
}

export function defaultBoard(): BoardState {
  return {
    version: 1,
    bank: 0,
    bankNames: [...DEFAULT_BANK_NAMES],
    pads: Array.from({ length: PAD_COUNT }, (_, pad) => defaultPad(pad)),
    settings: { ...DEFAULT_SETTINGS },
  }
}
