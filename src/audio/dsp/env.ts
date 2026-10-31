import { smoothstep } from './math.ts'

/** `[time, value]` breakpoint. Times must be ascending. */
export type EnvPoint = readonly [number, number]

function segment(t: number, points: readonly EnvPoint[], ease: (x: number) => number): number {
  if (t <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]
    if (t < t1) {
      const [t0, v0] = points[i - 1]
      const x = t1 > t0 ? (t - t0) / (t1 - t0) : 1
      return v0 + (v1 - v0) * ease(x)
    }
  }
  return points[points.length - 1][1]
}

const linear = (x: number) => x

/** Piecewise-linear envelope, held flat before the first and after the last point. */
export function env(t: number, points: readonly EnvPoint[]): number {
  return segment(t, points, linear)
}

/** Piecewise envelope with smoothstep easing — good for articulator / formant motion. */
export function envSmooth(t: number, points: readonly EnvPoint[]): number {
  return segment(t, points, smoothstep)
}

/** Piecewise exponential envelope (values must be > 0) — natural for pitch and cutoff sweeps. */
export function envExp(t: number, points: readonly EnvPoint[]): number {
  if (t <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]
    if (t < t1) {
      const [t0, v0] = points[i - 1]
      const x = t1 > t0 ? (t - t0) / (t1 - t0) : 1
      return v0 * Math.pow(v1 / v0, x)
    }
  }
  return points[points.length - 1][1]
}

/** Exponential decay that starts at 1 when t = 0 (0 before). */
export function decay(t: number, tau: number): number {
  return t < 0 ? 0 : Math.exp(-t / tau)
}

/**
 * Per-sample exponential decay: starts at 1 and is multiplied by a constant on
 * every `next()`. Much cheaper than `Math.exp` in hot loops; call it exactly
 * once per sample.
 */
export class Decay {
  private value = 1
  private readonly factor: number

  constructor(sampleRate: number, tau: number) {
    this.factor = Math.exp(-1 / (sampleRate * tau))
  }

  next(): number {
    const v = this.value
    this.value *= this.factor
    return v
  }
}

/** Linear attack followed by an exponential decay. */
export function attackDecay(t: number, attack: number, tau: number): number {
  if (t < 0) return 0
  if (t < attack) return t / attack
  return Math.exp(-(t - attack) / tau)
}

/**
 * Gate envelope: linear attack, sustain at 1 until `end`, then a smooth
 * (quadratic) release over `release` seconds.
 */
export function gate(t: number, attack: number, end: number, release: number): number {
  if (t < 0) return 0
  let level = attack > 0 ? Math.min(1, t / attack) : 1
  if (t > end) {
    const x = 1 - (t - end) / release
    level *= x > 0 ? x * x : 0
  }
  return level
}
