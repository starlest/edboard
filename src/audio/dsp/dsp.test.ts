import { describe, expect, it } from 'vitest'
import { applyGainWithLimiter, findEnd, findStart, levelGain, measureLoudness } from './loudness.ts'
import { note } from './math.ts'
import { Osc, sinePhase } from './osc.ts'
import { Random } from './random.ts'

const SR = 48000

function sine(freq: number, amplitude: number, seconds: number, sampleRate = SR): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate))
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  return out
}

describe('loudness', () => {
  it('reads a full-scale 997 Hz stereo sine as ~0 LUFS (BS.1770 reference)', () => {
    const tone = sine(997, 1, 1)
    const stats = measureLoudness([tone, tone], SR)
    expect(stats.lufs).toBeCloseTo(0, 0)
    expect(stats.peak).toBeCloseTo(1, 3)
  })

  it('drops 6 dB when the amplitude halves, and works at 44.1 kHz', () => {
    const tone = sine(997, 0.5, 1, 44100)
    expect(measureLoudness([tone, tone], 44100).lufs).toBeCloseTo(-6.02, 0)
  })

  it('treats silence as -Infinity and leaves its gain alone', () => {
    const silence = new Float32Array(SR)
    const stats = measureLoudness([silence, silence], SR)
    expect(stats.lufs).toBe(-Infinity)
    expect(levelGain(stats, { targetLufs: -14, ceiling: 0.9 })).toBe(1)
  })

  it('levels towards the target but never past the peak ceiling', () => {
    const quiet = sine(997, 0.05, 1)
    const quietStats = measureLoudness([quiet, quiet], SR)
    const gain = levelGain(quietStats, { targetLufs: -14, ceiling: 0.9 })
    expect(quietStats.lufs + 20 * Math.log10(gain)).toBeCloseTo(-14, 1)

    // A spiky click: loudness target would need huge gain, the ceiling caps it.
    const click = new Float32Array(SR)
    click[100] = 0.5
    const clickGain = levelGain(measureLoudness([click], SR), { targetLufs: -14, ceiling: 0.9 })
    expect(clickGain * 0.5).toBeLessThanOrEqual(0.9 + 1e-9)
  })

  it('soft-limits peaks to the ceiling', () => {
    const loud = sine(440, 1, 0.1)
    applyGainWithLimiter([loud], 3, 0.9)
    expect(Math.max(...loud.map(Math.abs))).toBeLessThanOrEqual(0.9)
  })

  it('finds where sound starts and ends', () => {
    const data = new Float32Array(1000)
    data.fill(0.5, 200, 700)
    expect(findStart([data])).toBe(200)
    expect(findEnd([data])).toBe(700)
    expect(findEnd([new Float32Array(10)])).toBe(0)
  })
})

describe('oscillators', () => {
  it('has a sine table accurate to better than -120 dB', () => {
    let worst = 0
    for (let i = 0; i < 10000; i++) {
      const phase = i / 10000
      worst = Math.max(worst, Math.abs(sinePhase(phase) - Math.sin(2 * Math.PI * phase)))
    }
    expect(worst).toBeLessThan(1e-6)
  })

  it('runs at the requested frequency', () => {
    const osc = new Osc(SR)
    let crossings = 0
    let previous = 0
    for (let i = 0; i < SR; i++) {
      const v = osc.sine(440)
      if (previous < 0 && v >= 0) crossings++
      previous = v
    }
    expect(crossings).toBeGreaterThanOrEqual(439)
    expect(crossings).toBeLessThanOrEqual(441)
  })

  it('keeps band-limited saw and square waves bounded', () => {
    const osc = new Osc(SR)
    for (let i = 0; i < SR / 10; i++) {
      expect(Math.abs(osc.saw(3000))).toBeLessThan(1.3)
      expect(Math.abs(osc.square(3000, 0.3))).toBeLessThan(1.3)
    }
  })

  it('parses note names', () => {
    expect(note('A4')).toBeCloseTo(440, 6)
    expect(note('C4')).toBeCloseTo(261.626, 2)
    expect(note('C#4')).toBeCloseTo(note('Db4'), 9)
    expect(() => note('H2')).toThrow()
  })
})

describe('Random', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = new Random(42)
    const b = new Random(42)
    for (let i = 0; i < 1000; i++) {
      const x = a.next()
      expect(x).toBe(b.next())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
    expect(new Random(1).next()).not.toBe(new Random(2).next())
  })
})
