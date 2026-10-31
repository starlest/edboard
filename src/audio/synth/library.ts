import { airHorn, bleep, bonk, recordScratch, rimshot, sadTrombone, vineBoom } from './sounds/memes.ts'
import { coin, gameOver, powerUp } from './sounds/retro.ts'
import {
  alarm,
  boing,
  chaChing,
  countdown,
  explosion,
  gong,
  heartbeat,
  laser,
  slideWhistle,
  suspense,
  whoosh,
} from './sounds/sfx.ts'
import { applause, correct, crickets, drumRoll, dunDunDun, victory, wrong } from './sounds/stage.ts'
import { bruh, fah, laugh, oof, wow } from './sounds/voices.ts'
import type { BuiltinSound } from './types.ts'

/** Every built-in sound, in the order they appear in the pad editor. */
export const BUILTIN_SOUNDS: readonly BuiltinSound[] = [
  fah,
  laugh,
  bruh,
  oof,
  wow,
  airHorn,
  vineBoom,
  sadTrombone,
  rimshot,
  bonk,
  recordScratch,
  bleep,
  applause,
  crickets,
  drumRoll,
  dunDunDun,
  victory,
  wrong,
  correct,
  laser,
  explosion,
  boing,
  whoosh,
  chaChing,
  heartbeat,
  alarm,
  countdown,
  suspense,
  slideWhistle,
  gong,
  coin,
  powerUp,
  gameOver,
]

const BY_ID = new Map(BUILTIN_SOUNDS.map((sound) => [sound.id, sound]))

export function getBuiltin(id: string): BuiltinSound | undefined {
  return BY_ID.get(id)
}
