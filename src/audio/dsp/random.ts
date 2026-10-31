/** FNV-1a hash, used to derive a stable seed from a sound id. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Small, fast, seedable PRNG (mulberry32). Built-in sounds are rendered with a
 * seed derived from their id so they sound identical on every load.
 */
export class Random {
  private state: number
  private spareGauss: number | null = null

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Uniform float in [-1, 1). */
  bipolar(): number {
    return this.next() * 2 - 1
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  /** Standard normal distribution (Box–Muller). */
  gauss(): number {
    if (this.spareGauss !== null) {
      const value = this.spareGauss
      this.spareGauss = null
      return value
    }
    let u = 0
    while (u === 0) u = this.next()
    const v = this.next()
    const mag = Math.sqrt(-2 * Math.log(u))
    this.spareGauss = mag * Math.sin(2 * Math.PI * v)
    return mag * Math.cos(2 * Math.PI * v)
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
}
