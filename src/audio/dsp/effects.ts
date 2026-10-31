import type { StereoBuffer } from './buffer.ts'
import { OnePole } from './filters.ts'

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const ALLPASS_TUNING = [556, 441, 341, 225]
const STEREO_SPREAD = 23

class Comb {
  feedback = 0.84
  damp = 0.2
  private readonly buffer: Float64Array
  private index = 0
  private store = 0

  constructor(size: number) {
    this.buffer = new Float64Array(Math.max(1, size))
  }

  process(input: number): number {
    const output = this.buffer[this.index]
    this.store = output * (1 - this.damp) + this.store * this.damp
    this.buffer[this.index] = input + this.store * this.feedback
    if (++this.index >= this.buffer.length) this.index = 0
    return output
  }
}

class AllpassDelay {
  private readonly buffer: Float64Array
  private index = 0

  constructor(size: number) {
    this.buffer = new Float64Array(Math.max(1, size))
  }

  process(input: number): number {
    const buffered = this.buffer[this.index]
    this.buffer[this.index] = input + buffered * 0.5
    if (++this.index >= this.buffer.length) this.index = 0
    return buffered - input
  }
}

export interface ReverbOptions {
  /** Room size 0..1 (decay time). */
  room?: number
  /** High-frequency damping 0..1. */
  damp?: number
  wet?: number
  dry?: number
  /** Stereo width 0..1. */
  width?: number
  /** Seconds before the reverb starts. */
  preDelay?: number
}

/** Freeverb (Jezar at Dreampoint) applied in place. */
export function applyReverb(buf: StereoBuffer, options: ReverbOptions = {}): void {
  const { room = 0.5, damp = 0.5, wet = 0.3, dry = 1, width = 1, preDelay = 0 } = options
  const { left, right, length, sampleRate } = buf
  const scale = sampleRate / 44100
  const combsL = COMB_TUNING.map((n) => new Comb(Math.round(n * scale)))
  const combsR = COMB_TUNING.map((n) => new Comb(Math.round((n + STEREO_SPREAD) * scale)))
  const allpassL = ALLPASS_TUNING.map((n) => new AllpassDelay(Math.round(n * scale)))
  const allpassR = ALLPASS_TUNING.map((n) => new AllpassDelay(Math.round((n + STEREO_SPREAD) * scale)))
  const feedback = room * 0.28 + 0.7
  for (const comb of [...combsL, ...combsR]) {
    comb.feedback = feedback
    comb.damp = damp * 0.4
  }
  const wet1 = wet * 3 * (width / 2 + 0.5)
  const wet2 = wet * 3 * ((1 - width) / 2)
  const preSamples = Math.round(preDelay * sampleRate)
  const pre = preSamples > 0 ? new Float64Array(preSamples) : null
  let preIndex = 0

  for (let i = 0; i < length; i++) {
    let input = (left[i] + right[i]) * 0.015
    if (pre) {
      const delayed = pre[preIndex]
      pre[preIndex] = input
      if (++preIndex >= preSamples) preIndex = 0
      input = delayed
    }
    let outL = 0
    let outR = 0
    for (let c = 0; c < 8; c++) {
      outL += combsL[c].process(input)
      outR += combsR[c].process(input)
    }
    for (let a = 0; a < 4; a++) {
      outL = allpassL[a].process(outL)
      outR = allpassR[a].process(outR)
    }
    const l = left[i]
    const r = right[i]
    left[i] = outL * wet1 + outR * wet2 + l * dry
    right[i] = outR * wet1 + outL * wet2 + r * dry
  }
}

export interface EchoOptions {
  /** Delay time in seconds. */
  time: number
  feedback: number
  mix: number
  /** Low-pass cutoff of the repeats (Hz). */
  tone?: number
  pingPong?: boolean
}

/** Feedback delay applied in place. */
export function applyEcho(buf: StereoBuffer, options: EchoOptions): void {
  const { time, feedback, mix, tone = 5000, pingPong = false } = options
  const { left, right, length, sampleRate } = buf
  const size = Math.max(1, Math.round(time * sampleRate))
  const lineL = new Float64Array(size)
  const lineR = new Float64Array(size)
  const toneL = new OnePole(sampleRate, tone)
  const toneR = new OnePole(sampleRate, tone)
  let index = 0
  for (let i = 0; i < length; i++) {
    const outL = lineL[index]
    const outR = lineR[index]
    const inL = left[i]
    const inR = right[i]
    if (pingPong) {
      lineL[index] = toneL.lowpass((inL + inR) * 0.5 + outR * feedback)
      lineR[index] = toneR.lowpass(outL * feedback)
    } else {
      lineL[index] = toneL.lowpass(inL + outL * feedback)
      lineR[index] = toneR.lowpass(inR + outR * feedback)
    }
    left[i] = inL + outL * mix
    right[i] = inR + outR * mix
    if (++index >= size) index = 0
  }
}
