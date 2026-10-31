export const BANK_COUNT = 4
export const PADS_PER_BANK = 16
export const PAD_COUNT = BANK_COUNT * PADS_PER_BANK
export const BANK_LETTERS = ['A', 'B', 'C', 'D'] as const

export const PAD_COLORS = [
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'violet',
  'magenta',
  'pink',
  'white',
] as const
export type PadColor = (typeof PAD_COLORS)[number]

/**
 * - `oneshot`: plays to the end; pressing again restarts it.
 * - `overlap`: every press layers another copy.
 * - `hold`: plays (looping) only while held.
 * - `toggle`: press to start, press again to stop.
 * - `loop`: like toggle, but loops until stopped.
 */
export const PLAY_MODES = ['oneshot', 'overlap', 'hold', 'toggle', 'loop'] as const
export type PlayMode = (typeof PLAY_MODES)[number]

export type SoundSource = { kind: 'builtin'; id: string } | { kind: 'file'; fileId: string; name: string }

export interface PadConfig {
  label: string
  color: PadColor
  /** `KeyboardEvent.code` of the shortcut (physical key), or null. */
  key: string | null
  /** Linear gain multiplier, 0 – 1.5. */
  volume: number
  mode: PlayMode
  source: SoundSource | null
  /** Level custom files to a consistent loudness. */
  autoLevel: boolean
}

export interface Settings {
  /** Master knob position 0 – 1 (mapped to gain with an audio taper). */
  masterVolume: number
  /** Global pitch / vari-speed in semitones, -12 – +12. */
  pitch: number
  /** Echo send amount 0 – 1. */
  echo: number
  limiter: boolean
  /** Only one sound at a time: triggering a pad cuts the others. */
  solo: boolean
  /** Audio output device id ('' = system default). */
  outputDeviceId: string
  showKeys: boolean
}

export interface BoardState {
  version: 1
  /** Bank currently shown on the pads. */
  bank: number
  bankNames: string[]
  pads: PadConfig[]
  settings: Settings
}

export const padBank = (pad: number): number => Math.floor(pad / PADS_PER_BANK)
export const padSlot = (pad: number): number => pad % PADS_PER_BANK

/** Hardware-style pad name, e.g. `A05`. */
export const padName = (pad: number): string =>
  `${BANK_LETTERS[padBank(pad)]}${String(padSlot(pad) + 1).padStart(2, '0')}`
