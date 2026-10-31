import { TAU } from './math.ts'

// Interpolated sine table: ~5x faster than Math.sin, error below -130 dB.
const TABLE_SIZE = 4096
const SINE_TABLE = new Float64Array(TABLE_SIZE + 1)
for (let i = 0; i <= TABLE_SIZE; i++) SINE_TABLE[i] = Math.sin((TAU * i) / TABLE_SIZE)

/** Fast sine of a normalised phase in [0, 1). */
export function sinePhase(phase: number): number {
  const x = phase * TABLE_SIZE
  const i = x | 0
  const a = SINE_TABLE[i]
  return a + (SINE_TABLE[i + 1] - a) * (x - i)
}

/**
 * PolyBLEP residual used to band-limit hard edges in saw / square waves.
 * `t` is the phase relative to the discontinuity, `dt` the phase increment.
 */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}

/**
 * Phase-accumulating oscillator. Call exactly one waveform method per sample;
 * the frequency may change on every call (pitch sweeps, vibrato, FM).
 */
export class Osc {
  phase: number
  private readonly invSr: number

  constructor(sampleRate: number, phase = 0) {
    this.invSr = 1 / sampleRate
    this.phase = phase - Math.floor(phase)
  }

  private advance(dt: number): void {
    let p = this.phase + dt
    if (p >= 1 || p < 0) p -= Math.floor(p)
    this.phase = p
  }

  sine(freq: number): number {
    const value = sinePhase(this.phase)
    this.advance(freq * this.invSr)
    return value
  }

  saw(freq: number): number {
    const dt = Math.min(0.5, Math.abs(freq) * this.invSr)
    const p = this.phase
    const value = 2 * p - 1 - polyBlep(p, dt)
    this.advance(freq * this.invSr)
    return value
  }

  /** Pulse wave; `width` is the duty cycle (0.5 = square). */
  square(freq: number, width = 0.5): number {
    const dt = Math.min(0.5, Math.abs(freq) * this.invSr)
    const p = this.phase
    let value = p < width ? 1 : -1
    value += polyBlep(p, dt)
    let q = p - width
    if (q < 0) q += 1
    value -= polyBlep(q, dt)
    this.advance(freq * this.invSr)
    return value
  }

  tri(freq: number): number {
    const p = this.phase
    const value = p < 0.5 ? 4 * p - 1 : 3 - 4 * p
    this.advance(freq * this.invSr)
    return value
  }
}
