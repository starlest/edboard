import { describe, expect, it } from 'vitest'
import { measureLoudness } from '../dsp/loudness.ts'
import { BUILTIN_SOUNDS, getBuiltin } from './library.ts'
import { DEFAULT_LOUDNESS, PEAK_CEILING, renderBuiltin } from './render.ts'

describe('built-in sound library', () => {
  it('has unique ids and short pad labels', () => {
    const ids = BUILTIN_SOUNDS.map((sound) => sound.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const sound of BUILTIN_SOUNDS) {
      expect(sound.name.length).toBeLessThanOrEqual(14)
      expect(getBuiltin(sound.id)).toBe(sound)
    }
    expect(getBuiltin('fah')?.name).toBe('FAH!')
  })

  it.each(BUILTIN_SOUNDS.map((sound) => [sound.id, sound] as const))(
    '%s renders clean, levelled audio',
    (_, sound) => {
      const rendered = renderBuiltin(sound, 48000)
      const { left, right } = rendered
      expect(left.length).toBeGreaterThan(48000 * 0.3)
      expect(left.length).toBeLessThanOrEqual(Math.ceil(sound.duration * 48000))
      let peak = 0
      let finite = true
      for (const channel of [left, right]) {
        for (const v of channel) {
          if (!Number.isFinite(v)) finite = false
          else if (Math.abs(v) > peak) peak = Math.abs(v)
        }
      }
      expect(finite).toBe(true)
      expect(peak).toBeLessThanOrEqual(PEAK_CEILING + 1e-6)
      const { lufs } = measureLoudness([left, right], 48000)
      const target = sound.loudness ?? DEFAULT_LOUDNESS
      // Either on target, or quieter because the peak ceiling won.
      expect(lufs).toBeLessThanOrEqual(target + 0.5)
      expect(lufs).toBeGreaterThan(target - 6)
      if (!sound.loopable) {
        // Ends in silence (no clicks at the cut).
        expect(Math.abs(left[left.length - 1])).toBeLessThan(1e-3)
        expect(Math.abs(right[right.length - 1])).toBeLessThan(1e-3)
      }
    },
  )

  it('renders deterministically and at other sample rates', () => {
    const fah = getBuiltin('fah')!
    const a = renderBuiltin(fah, 44100)
    const b = renderBuiltin(fah, 44100)
    expect(a.sampleRate).toBe(44100)
    expect(a.left).toEqual(b.left)
  })

  it('renders the censor bleep as a seamless loop', () => {
    for (const sampleRate of [44100, 48000]) {
      const { left } = renderBuiltin(getBuiltin('bleep')!, sampleRate)
      expect(left.length).toBe(sampleRate)
      // The sample after the last one would be the first one again.
      const step = left[1] - left[0]
      expect(Math.abs(left[0] - (left[left.length - 1] + step))).toBeLessThan(0.02)
    }
  })
})
