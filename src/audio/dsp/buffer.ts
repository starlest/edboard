import { Random } from './random.ts'

/** A pair of float channels that recipes render into. */
export class StereoBuffer {
  readonly sampleRate: number
  readonly length: number
  readonly left: Float32Array
  readonly right: Float32Array

  constructor(sampleRate: number, length: number) {
    this.sampleRate = sampleRate
    this.length = length
    this.left = new Float32Array(length)
    this.right = new Float32Array(length)
  }

  get duration(): number {
    return this.length / this.sampleRate
  }

  get channels(): [Float32Array, Float32Array] {
    return [this.left, this.right]
  }
}

/** Equal-power pan law: -1 = hard left, 0 = centre, 1 = hard right. */
export function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

export interface MixOptions {
  gain?: number
  pan?: number
  /**
   * Seconds of linear fade applied to the end of the event, so a generator
   * that is still ringing when its time is up never ends with a click.
   */
  fade?: number
}

const DEFAULT_FADE = 0.005

/**
 * Generator called once per sample with the local time (seconds since the
 * event started). Generators are usually closures that own oscillators and
 * filters, so they must be called in order — which `mono()` guarantees.
 */
export type MonoGenerator = (t: number) => number
export type StereoGenerator = (t: number, frame: [number, number]) => void

/** Everything a built-in sound recipe needs to render itself. */
export class RenderContext {
  readonly sr: number
  readonly out: StereoBuffer
  readonly rng: Random

  constructor(sampleRate: number, duration: number, seed: number) {
    this.sr = sampleRate
    this.out = new StereoBuffer(sampleRate, Math.max(1, Math.ceil(duration * sampleRate)))
    this.rng = new Random(seed)
  }

  get duration(): number {
    return this.out.duration
  }

  /** Sample range of an event, clipped to the buffer, plus where its end fade begins. */
  private span(start: number, dur: number, fade: number) {
    const first = Math.max(0, Math.round(start * this.sr))
    const count = Math.max(0, Math.min(Math.round(dur * this.sr), this.out.length - first))
    const fadeLength = Math.min(count, Math.round(fade * this.sr))
    return { first, count, fadeStart: count - fadeLength, fadeLength }
  }

  /** Mixes a mono generator into the output, starting at `start` seconds for `dur` seconds. */
  mono(start: number, dur: number, gen: MonoGenerator, options: MixOptions = {}): void {
    const { gain = 1, pan = 0, fade = DEFAULT_FADE } = options
    const [gl, gr] = panGains(pan)
    const { left, right } = this.out
    const { first, count, fadeStart, fadeLength } = this.span(start, dur, fade)
    const invSr = 1 / this.sr
    for (let i = 0; i < count; i++) {
      let value = gen(i * invSr) * gain
      if (i >= fadeStart) value *= (count - i) / (fadeLength + 1)
      left[first + i] += value * gl
      right[first + i] += value * gr
    }
  }

  /** Mixes a stereo generator into the output. */
  stereo(start: number, dur: number, gen: StereoGenerator, options: Omit<MixOptions, 'pan'> = {}): void {
    const { gain = 1, fade = DEFAULT_FADE } = options
    const { left, right } = this.out
    const { first, count, fadeStart, fadeLength } = this.span(start, dur, fade)
    const invSr = 1 / this.sr
    const frame: [number, number] = [0, 0]
    for (let i = 0; i < count; i++) {
      frame[0] = 0
      frame[1] = 0
      gen(i * invSr, frame)
      const g = i >= fadeStart ? (gain * (count - i)) / (fadeLength + 1) : gain
      left[first + i] += frame[0] * g
      right[first + i] += frame[1] * g
    }
  }
}
