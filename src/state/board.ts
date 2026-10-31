import { clamp } from '../audio/dsp/math.ts'
import { getBuiltin } from '../audio/synth/library.ts'
import { defaultBoard, defaultPad, DEFAULT_BANK_NAMES, DEFAULT_SETTINGS, emptyPad } from './defaults.ts'
import { isBindable } from './keys.ts'
import type { BoardState, PadConfig, Settings, SoundSource } from './types.ts'
import { BANK_COUNT, PAD_COLORS, PAD_COUNT, PLAY_MODES } from './types.ts'

export const MAX_LABEL_LENGTH = 24
export const MAX_BANK_NAME_LENGTH = 12
export const MAX_PAD_VOLUME = 1.5

export type BoardAction =
  | { type: 'select-bank'; bank: number }
  | { type: 'update-pad'; pad: number; patch: Partial<PadConfig> }
  | { type: 'swap-pads'; a: number; b: number }
  | { type: 'reset-pad'; pad: number }
  | { type: 'clear-pad'; pad: number }
  | { type: 'rename-bank'; bank: number; name: string }
  | { type: 'update-settings'; patch: Partial<Settings> }
  | { type: 'reset-board' }

const isPadIndex = (pad: number): boolean => Number.isInteger(pad) && pad >= 0 && pad < PAD_COUNT

function replacePad(state: BoardState, pad: number, next: PadConfig): BoardState {
  const pads = state.pads.slice()
  pads[pad] = next
  return { ...state, pads }
}

/** Shortcuts are unique: assigning one to a pad takes it away from any other pad. */
function claimKey(pads: PadConfig[], owner: number): PadConfig[] {
  const key = pads[owner].key
  if (!key) return pads
  return pads.map((p, i) => (i !== owner && p.key === key ? { ...p, key: null } : p))
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'select-bank': {
      const { bank } = action
      if (!Number.isInteger(bank) || bank < 0 || bank >= BANK_COUNT || bank === state.bank) return state
      return { ...state, bank }
    }
    case 'update-pad': {
      if (!isPadIndex(action.pad)) return state
      const next = sanitizePad({ ...state.pads[action.pad], ...action.patch }, state.pads[action.pad])
      const updated = replacePad(state, action.pad, next)
      return action.patch.key !== undefined ? { ...updated, pads: claimKey(updated.pads, action.pad) } : updated
    }
    case 'swap-pads': {
      // Sounds move; shortcuts stay with the physical pad position.
      const { a, b } = action
      if (!isPadIndex(a) || !isPadIndex(b) || a === b) return state
      const pads = state.pads.slice()
      pads[a] = { ...state.pads[b], key: state.pads[a].key }
      pads[b] = { ...state.pads[a], key: state.pads[b].key }
      return { ...state, pads }
    }
    case 'reset-pad':
      if (!isPadIndex(action.pad)) return state
      return replacePad(state, action.pad, { ...defaultPad(action.pad), key: state.pads[action.pad].key })
    case 'clear-pad':
      if (!isPadIndex(action.pad)) return state
      return replacePad(state, action.pad, emptyPad(state.pads[action.pad].key))
    case 'rename-bank': {
      if (!Number.isInteger(action.bank) || action.bank < 0 || action.bank >= BANK_COUNT) return state
      const bankNames = state.bankNames.slice()
      bankNames[action.bank] = cleanBankName(action.name, DEFAULT_BANK_NAMES[action.bank])
      return { ...state, bankNames }
    }
    case 'update-settings':
      return { ...state, settings: sanitizeSettings({ ...state.settings, ...action.patch }) }
    case 'reset-board':
      return defaultBoard()
  }
}

// ---------------------------------------------------------------------------
// Sanitising (for persisted data, which may be stale, hand-edited or corrupt)
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

function cleanBankName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const name = value.trim().toUpperCase().slice(0, MAX_BANK_NAME_LENGTH)
  return name || fallback
}

function sanitizeSource(value: unknown, fallback: SoundSource | null): SoundSource | null {
  if (value === null) return null
  if (!isRecord(value)) return fallback
  if (value.kind === 'builtin' && typeof value.id === 'string') {
    return getBuiltin(value.id) ? { kind: 'builtin', id: value.id } : null
  }
  if (value.kind === 'file' && typeof value.fileId === 'string' && value.fileId) {
    return { kind: 'file', fileId: value.fileId, name: typeof value.name === 'string' ? value.name.slice(0, 200) : '' }
  }
  return fallback
}

export function sanitizePad(value: unknown, fallback: PadConfig): PadConfig {
  if (!isRecord(value)) return fallback
  const color = PAD_COLORS.find((c) => c === value.color)
  const mode = PLAY_MODES.find((m) => m === value.mode)
  return {
    label: typeof value.label === 'string' ? value.label.slice(0, MAX_LABEL_LENGTH) : fallback.label,
    color: color ?? fallback.color,
    key: value.key === null ? null : typeof value.key === 'string' && isBindable(value.key) ? value.key : fallback.key,
    volume: clamp(finite(value.volume, fallback.volume), 0, MAX_PAD_VOLUME),
    mode: mode ?? fallback.mode,
    source: 'source' in value ? sanitizeSource(value.source, fallback.source) : fallback.source,
    autoLevel: typeof value.autoLevel === 'boolean' ? value.autoLevel : fallback.autoLevel,
  }
}

export function sanitizeSettings(value: unknown): Settings {
  const d = DEFAULT_SETTINGS
  if (!isRecord(value)) return { ...d }
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    masterVolume: clamp(finite(value.masterVolume, d.masterVolume), 0, 1),
    pitch: Math.round(clamp(finite(value.pitch, d.pitch), -12, 12)),
    echo: clamp(finite(value.echo, d.echo), 0, 1),
    limiter: bool(value.limiter, d.limiter),
    solo: bool(value.solo, d.solo),
    outputDeviceId: typeof value.outputDeviceId === 'string' ? value.outputDeviceId : d.outputDeviceId,
    showKeys: bool(value.showKeys, d.showKeys),
  }
}

/** Turns anything (usually parsed JSON) into a valid board, keeping whatever is usable. */
export function sanitizeBoard(value: unknown): BoardState {
  const base = defaultBoard()
  if (!isRecord(value)) return base
  const rawPads = Array.isArray(value.pads) ? value.pads : []
  const seen = new Set<string>()
  const pads = base.pads.map((fallback, i) => {
    const pad = i < rawPads.length ? sanitizePad(rawPads[i], fallback) : fallback
    if (!pad.key) return pad
    if (seen.has(pad.key)) return { ...pad, key: null }
    seen.add(pad.key)
    return pad
  })
  const rawNames = Array.isArray(value.bankNames) ? value.bankNames : []
  return {
    version: 1,
    bank: Number.isInteger(value.bank) && (value.bank as number) >= 0 && (value.bank as number) < BANK_COUNT ? (value.bank as number) : 0,
    bankNames: base.bankNames.map((fallback, i) => cleanBankName(rawNames[i], fallback)),
    pads,
    settings: sanitizeSettings(value.settings),
  }
}

/** Every custom file a board references (used to clean up orphaned audio). */
export function referencedFiles(state: BoardState): Set<string> {
  const ids = new Set<string>()
  for (const pad of state.pads) if (pad.source?.kind === 'file') ids.add(pad.source.fileId)
  return ids
}
