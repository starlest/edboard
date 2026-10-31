import type { Random } from './random.ts'

/** White, pink and brown noise sources driven by a seeded RNG. */
export class Noise {
  private readonly rng: Random
  private b0 = 0
  private b1 = 0
  private b2 = 0
  private b3 = 0
  private b4 = 0
  private b5 = 0
  private b6 = 0
  private brownState = 0

  constructor(rng: Random) {
    this.rng = rng
  }

  white(): number {
    return this.rng.next() * 2 - 1
  }

  /** Paul Kellet's refined pink noise filter (-3 dB/octave). */
  pink(): number {
    const w = this.white()
    this.b0 = 0.99886 * this.b0 + w * 0.0555179
    this.b1 = 0.99332 * this.b1 + w * 0.0750759
    this.b2 = 0.969 * this.b2 + w * 0.153852
    this.b3 = 0.8665 * this.b3 + w * 0.3104856
    this.b4 = 0.55 * this.b4 + w * 0.5329522
    this.b5 = -0.7616 * this.b5 - w * 0.016898
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362
    this.b6 = w * 0.115926
    return out * 0.11
  }

  /** Leaky-integrated white noise (-6 dB/octave). */
  brown(): number {
    this.brownState = (this.brownState + 0.02 * this.white()) / 1.02
    return this.brownState * 3.5
  }
}
