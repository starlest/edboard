import { TAU } from './math.ts'

export type FilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'notch'
  | 'allpass'
  | 'peaking'
  | 'lowshelf'
  | 'highshelf'

/**
 * RBJ "Audio EQ Cookbook" biquad in transposed direct form II.
 * `q` is a linear Q (resonance); `gainDb` applies to peaking / shelving types.
 */
export class Biquad {
  private b0 = 1
  private b1 = 0
  private b2 = 0
  private a1 = 0
  private a2 = 0
  private z1 = 0
  private z2 = 0
  private readonly sampleRate: number

  constructor(sampleRate: number, type?: FilterType, freq = 1000, q = Math.SQRT1_2, gainDb = 0) {
    this.sampleRate = sampleRate
    if (type) this.set(type, freq, q, gainDb)
  }

  set(type: FilterType, freq: number, q = Math.SQRT1_2, gainDb = 0): this {
    const f = Math.min(Math.max(freq, 5), this.sampleRate * 0.49)
    const w0 = (TAU * f) / this.sampleRate
    const cos = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * Math.max(q, 1e-4))
    const A = Math.pow(10, gainDb / 40)
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
    switch (type) {
      case 'lowpass':
        b0 = (1 - cos) / 2
        b1 = 1 - cos
        b2 = b0
        a0 = 1 + alpha
        a1 = -2 * cos
        a2 = 1 - alpha
        break
      case 'highpass':
        b0 = (1 + cos) / 2
        b1 = -(1 + cos)
        b2 = b0
        a0 = 1 + alpha
        a1 = -2 * cos
        a2 = 1 - alpha
        break
      case 'bandpass': // constant 0 dB peak gain
        b0 = alpha
        b1 = 0
        b2 = -alpha
        a0 = 1 + alpha
        a1 = -2 * cos
        a2 = 1 - alpha
        break
      case 'notch':
        b0 = 1
        b1 = -2 * cos
        b2 = 1
        a0 = 1 + alpha
        a1 = -2 * cos
        a2 = 1 - alpha
        break
      case 'allpass':
        b0 = 1 - alpha
        b1 = -2 * cos
        b2 = 1 + alpha
        a0 = 1 + alpha
        a1 = -2 * cos
        a2 = 1 - alpha
        break
      case 'peaking':
        b0 = 1 + alpha * A
        b1 = -2 * cos
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * cos
        a2 = 1 - alpha / A
        break
      case 'lowshelf': {
        const k = 2 * Math.sqrt(A) * alpha
        b0 = A * (A + 1 - (A - 1) * cos + k)
        b1 = 2 * A * (A - 1 - (A + 1) * cos)
        b2 = A * (A + 1 - (A - 1) * cos - k)
        a0 = A + 1 + (A - 1) * cos + k
        a1 = -2 * (A - 1 + (A + 1) * cos)
        a2 = A + 1 + (A - 1) * cos - k
        break
      }
      case 'highshelf': {
        const k = 2 * Math.sqrt(A) * alpha
        b0 = A * (A + 1 + (A - 1) * cos + k)
        b1 = -2 * A * (A - 1 + (A + 1) * cos)
        b2 = A * (A + 1 + (A - 1) * cos - k)
        a0 = A + 1 - (A - 1) * cos + k
        a1 = 2 * (A - 1 - (A + 1) * cos)
        a2 = A + 1 - (A - 1) * cos - k
        break
      }
    }
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = a1 / a0
    this.a2 = a2 / a0
    return this
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1
    this.z1 = this.b1 * x - this.a1 * y + this.z2
    this.z2 = this.b2 * x - this.a2 * y
    return y
  }

  reset(): void {
    this.z1 = 0
    this.z2 = 0
  }
}

/** One-pole smoothing filter. Use an instance for either low- or high-pass, not both. */
export class OnePole {
  private coeff = 1
  private state = 0
  private readonly sampleRate: number

  constructor(sampleRate: number, cutoff: number) {
    this.sampleRate = sampleRate
    this.setCutoff(cutoff)
  }

  setCutoff(cutoff: number): this {
    this.coeff = 1 - Math.exp((-TAU * Math.max(cutoff, 0.01)) / this.sampleRate)
    return this
  }

  lowpass(x: number): number {
    this.state += this.coeff * (x - this.state)
    return this.state
  }

  highpass(x: number): number {
    this.state += this.coeff * (x - this.state)
    return x - this.state
  }
}

/**
 * Klatt-style two-pole digital resonator with unity gain at DC. Cascading a
 * handful of these models the vocal tract in the formant voice synthesiser.
 */
export class Resonator {
  private a = 1
  private b = 0
  private c = 0
  private y1 = 0
  private y2 = 0
  private readonly invSr: number

  constructor(sampleRate: number) {
    this.invSr = 1 / sampleRate
  }

  set(freq: number, bandwidth: number): this {
    const r = Math.exp(-Math.PI * bandwidth * this.invSr)
    this.c = -r * r
    this.b = 2 * r * Math.cos(TAU * freq * this.invSr)
    this.a = 1 - this.b - this.c
    return this
  }

  process(x: number): number {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

/** First-order DC blocking high-pass. */
export class DcBlocker {
  private x1 = 0
  private y1 = 0
  private readonly r: number

  constructor(sampleRate: number, cutoff = 12) {
    this.r = 1 - (TAU * cutoff) / sampleRate
  }

  process(x: number): number {
    const y = x - this.x1 + this.r * this.y1
    this.x1 = x
    this.y1 = y
    return y
  }
}
