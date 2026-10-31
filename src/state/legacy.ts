import { presetPad, type Preset } from './defaults.ts'
import type { PadConfig } from './types.ts'

/**
 * Factory layouts from earlier releases, kept so boards saved under them can
 * be upgraded: a pad that still matches its old factory setup was never
 * touched by the user, so it follows the new factory layout.
 */
const REVISION_1: readonly Preset[] = [
  // Bank A — memes
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
  // Bank B — SFX
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

const LEGACY_LAYOUTS: Record<number, { pads: readonly Preset[]; bankNames: readonly string[] }> = {
  1: { pads: REVISION_1, bankNames: ['MEMES', 'SFX', 'BANK C', 'BANK D'] },
}

function samePad(a: PadConfig, b: PadConfig): boolean {
  return (
    a.label === b.label &&
    a.color === b.color &&
    a.key === b.key &&
    a.volume === b.volume &&
    a.mode === b.mode &&
    a.autoLevel === b.autoLevel &&
    JSON.stringify(a.source) === JSON.stringify(b.source)
  )
}

/** Whether `pad` is exactly what the given factory revision put on pad `index`. */
export function isLegacyFactoryPad(revision: number, index: number, pad: PadConfig): boolean {
  const preset = LEGACY_LAYOUTS[revision]?.pads[index]
  return preset !== undefined && samePad(pad, presetPad(preset, pad.key))
}

/** The bank name a given factory revision used (to tell renamed banks from defaults). */
export function legacyBankName(revision: number, bank: number): string | undefined {
  return LEGACY_LAYOUTS[revision]?.bankNames[bank]
}

/** The full pad list a past factory revision shipped with (used to test upgrades). */
export function legacyFactoryPads(revision: number, keyFor: (pad: number) => string | null): PadConfig[] {
  return (LEGACY_LAYOUTS[revision]?.pads ?? []).map((preset, pad) => presetPad(preset, keyFor(pad)))
}
