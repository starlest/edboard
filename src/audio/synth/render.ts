import { RenderContext } from '../dsp/buffer.ts'
import { DcBlocker } from '../dsp/filters.ts'
import { applyGainWithLimiter, findEnd, levelGain, measureLoudness } from '../dsp/loudness.ts'
import { dbToGain } from '../dsp/math.ts'
import { hashString } from '../dsp/random.ts'
import type { BuiltinSound } from './types.ts'

/** Target loudness for built-in sounds (max momentary LUFS). */
export const DEFAULT_LOUDNESS = -14
/** Peak ceiling for everything Edboard renders or levels. */
export const PEAK_CEILING = dbToGain(-1)

export interface RenderedSound {
  id: string
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

/**
 * Renders a built-in sound at the given sample rate, then levels it to its
 * loudness target and trims the silent tail. Pure and deterministic, so it
 * runs the same in a Web Worker, on the main thread, or in Node tests.
 */
export function renderBuiltin(sound: BuiltinSound, sampleRate: number): RenderedSound {
  const c = new RenderContext(sampleRate, sound.duration, hashString(sound.id))
  sound.render(c)
  const { left, right } = c.out
  const channels = [left, right]

  for (const channel of channels) {
    const dc = sound.loopable ? null : new DcBlocker(sampleRate)
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i]
      const safe = Number.isFinite(x) ? x : 0
      channel[i] = dc ? dc.process(safe) : safe
    }
  }

  const stats = measureLoudness(channels, sampleRate)
  const gain = levelGain(stats, {
    targetLufs: sound.loudness ?? DEFAULT_LOUDNESS,
    ceiling: PEAK_CEILING,
    limitDb: sound.loopable ? 0 : 4,
  })
  applyGainWithLimiter(channels, gain, PEAK_CEILING)

  if (sound.loopable) return { id: sound.id, sampleRate, left, right }

  const end = Math.min(left.length, findEnd(channels, -58) + Math.round(0.02 * sampleRate))
  const fade = Math.min(end, Math.round(0.012 * sampleRate))
  for (let i = 0; i < fade; i++) {
    const g = i / fade
    left[end - 1 - i] *= g
    right[end - 1 - i] *= g
  }
  return { id: sound.id, sampleRate, left: left.slice(0, end), right: right.slice(0, end) }
}
