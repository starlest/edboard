import type { RenderContext } from '../dsp/buffer.ts'

export type SoundCategory = 'voice' | 'meme' | 'stage' | 'sfx' | 'retro'

/** A built-in sound: a recipe that synthesises audio from scratch (no samples shipped). */
export interface BuiltinSound {
  id: string
  /** Short label printed on the pad. */
  name: string
  description: string
  category: SoundCategory
  /** Seconds of audio to render, including tails. Trailing silence is trimmed afterwards. */
  duration: number
  /** Target loudness (max momentary LUFS). Defaults to DEFAULT_LOUDNESS. */
  loudness?: number
  /** Rendered as a seamless loop: no tail trimming, fades or DC filtering. */
  loopable?: boolean
  render(c: RenderContext): void
}
