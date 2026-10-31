/**
 * Reusable instruments for the built-in sounds: drums, cymbals, brass, bells.
 * Each function schedules one note/hit into the render context.
 *
 * Generators run once per sample, so envelopes use `Decay` (one multiply per
 * sample) instead of `Math.exp`.
 */
import type { RenderContext } from '../dsp/buffer.ts'
import { Decay, gate } from '../dsp/env.ts'
import { Biquad } from '../dsp/filters.ts'
import { TAU, semis } from '../dsp/math.ts'
import { Noise } from '../dsp/noise.ts'
import { Osc } from '../dsp/osc.ts'

export interface SnareOptions {
  /** Shell tone (Hz). */
  tone?: number
  /** Snare-wire decay (s). */
  decay?: number
  pan?: number
}

export function snare(c: RenderContext, start: number, vel = 1, options: SnareOptions = {}): void {
  const { tone = 190, decay: wireDecay = 0.09, pan = 0 } = options
  const shellA = new Osc(c.sr)
  const shellB = new Osc(c.sr)
  const noise = new Noise(c.rng)
  const highpass = new Biquad(c.sr, 'highpass', 1400, 0.7)
  const presence = new Biquad(c.sr, 'peaking', 5200, 1.2, 5)
  const bend = new Decay(c.sr, 0.01)
  const shellEnv = new Decay(c.sr, 0.045)
  const wireEnv = new Decay(c.sr, wireDecay)
  const attack = 0.0015
  c.mono(
    start,
    wireDecay * 6 + 0.03,
    (t) => {
      const f = tone * (1 + 0.35 * bend.next())
      const shell = (shellA.sine(f) + 0.5 * shellB.sine(f * 1.72)) * shellEnv.next()
      const wires = presence.process(highpass.process(noise.white())) * wireEnv.next() * Math.min(1, t / attack)
      return (shell * 0.7 + wires * 0.8) * vel
    },
    { pan },
  )
}

export interface KickOptions {
  from?: number
  to?: number
  decay?: number
}

export function kick(c: RenderContext, start: number, vel = 1, options: KickOptions = {}): void {
  const { from = 150, to = 48, decay: tau = 0.35 } = options
  const osc = new Osc(c.sr)
  const noise = new Noise(c.rng)
  const click = new Biquad(c.sr, 'lowpass', 3500, 0.7)
  const pitch = new Decay(c.sr, 0.035)
  const body = new Decay(c.sr, tau)
  const clickEnv = new Decay(c.sr, 0.003)
  c.mono(start, tau * 5, (t) => {
    const f = to + (from - to) * pitch.next()
    const s = osc.sine(f) * body.next() * Math.min(1, t / 0.001) + 0.3 * click.process(noise.white()) * clickEnv.next()
    return Math.tanh(s * 1.4) * vel
  })
}

export function tom(c: RenderContext, start: number, vel: number, high: number, low: number, tau = 0.25, pan = 0): void {
  const fundamental = new Osc(c.sr)
  const overtone = new Osc(c.sr)
  const noise = new Noise(c.rng)
  const stick = new Biquad(c.sr, 'lowpass', 2500, 0.7)
  const pitch = new Decay(c.sr, 0.05)
  const body = new Decay(c.sr, tau)
  const ring = new Decay(c.sr, tau * 0.4)
  const stickEnv = new Decay(c.sr, 0.008)
  c.mono(
    start,
    tau * 5,
    () => {
      const f = low + (high - low) * pitch.next()
      let s = fundamental.sine(f) * body.next()
      s += 0.3 * overtone.sine(f * 1.6) * ring.next()
      s += 0.25 * stick.process(noise.white()) * stickEnv.next()
      return Math.tanh(s * 1.2) * vel
    },
    { pan },
  )
}

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

export interface CymbalOptions {
  pan?: number
  /** Scales the filter frequencies (1 = crash, higher = brighter/smaller). */
  brightness?: number
}

/** TR-808 style cymbal: six detuned square waves plus filtered noise. */
export function cymbal(c: RenderContext, start: number, vel = 1, tau = 1, options: CymbalOptions = {}): void {
  const { pan = 0, brightness = 1 } = options
  const oscs = METAL.map(() => new Osc(c.sr, c.rng.next()))
  const freqs = METAL.map((f) => f * 1.31)
  const noise = new Noise(c.rng)
  const highpass = new Biquad(c.sr, 'highpass', 4800 * brightness, 0.7)
  const band = new Biquad(c.sr, 'bandpass', 7600 * brightness, 0.9)
  const air = new Biquad(c.sr, 'highpass', 6500, 0.7)
  const body = new Decay(c.sr, tau)
  const splash = new Decay(c.sr, 0.08)
  c.mono(
    start,
    tau * 5,
    (t) => {
      let metal = 0
      for (let i = 0; i < oscs.length; i++) metal += oscs[i].square(freqs[i])
      const m = band.process(highpass.process(metal)) * 0.55
      const n = air.process(noise.white()) * 0.6
      const amp = body.next() * (0.65 + 0.35 * splash.next()) * Math.min(1, t / 0.0015)
      return (m + n) * amp * vel
    },
    { pan },
  )
}

/** `[frequency ratio, amplitude, decay scale]` */
export type Partial = readonly [number, number, number]

interface Mode {
  osc: Osc
  freq: number
  amp: number
  env: Decay
}

function modes(c: RenderContext, freq: number, tau: number, partials: readonly Partial[], randomPhase: boolean): Mode[] {
  const nyquist = c.sr * 0.45
  return partials
    .filter(([ratio]) => freq * ratio < nyquist)
    .map(([ratio, amp, scale]) => ({
      osc: new Osc(c.sr, randomPhase ? c.rng.next() : 0),
      freq: freq * ratio,
      amp,
      env: new Decay(c.sr, tau * scale),
    }))
}

const TIMPANI: readonly Partial[] = [
  [1, 1, 1],
  [1.5, 0.45, 0.7],
  [1.98, 0.28, 0.55],
  [2.44, 0.18, 0.4],
]

export function timpani(c: RenderContext, start: number, freq: number, vel = 1, tau = 0.9): void {
  const drum = modes(c, freq, tau, TIMPANI, false)
  const noise = new Noise(c.rng)
  const mallet = new Biquad(c.sr, 'lowpass', 900, 0.7)
  const malletEnv = new Decay(c.sr, 0.015)
  const bendEnv = new Decay(c.sr, 0.08)
  c.mono(start, tau * 4, (t) => {
    const bend = 1 + 0.03 * bendEnv.next()
    let s = 0
    for (let i = 0; i < drum.length; i++) {
      const m = drum[i]
      s += m.osc.sine(m.freq * bend) * m.amp * m.env.next()
    }
    s += 0.4 * mallet.process(noise.white()) * malletEnv.next()
    return s * Math.min(1, t / 0.002) * vel
  })
}

/**
 * Timpani roll: one drum whose modes keep ringing while rapid mallet strokes
 * (with a crescendo from `velFrom` to `velTo`) re-excite it.
 */
export function timpaniRoll(
  c: RenderContext,
  start: number,
  dur: number,
  freq: number,
  velFrom: number,
  velTo: number,
  strokeRate = 13,
): void {
  const drum = modes(c, freq, 1, TIMPANI, false)
  const noise = new Noise(c.rng)
  const mallet = new Biquad(c.sr, 'lowpass', 900, 0.7)
  const tail = new Decay(c.sr, 0.4)
  c.mono(start, dur + 1.6, (t) => {
    const x = Math.min(1, t / dur)
    const level = (velFrom + (velTo - velFrom) * x) * (t < dur ? 1 : tail.next())
    const strokePhase = (t * strokeRate) % 1
    const stroke = t < dur ? Math.exp(-strokePhase * 12) : 0
    let s = 0
    for (let i = 0; i < drum.length; i++) {
      const m = drum[i]
      s += m.osc.sine(m.freq) * m.amp
    }
    s *= level * (0.7 + 0.3 * stroke)
    s += 0.25 * mallet.process(noise.white()) * stroke * level
    return s * Math.min(1, t / 0.02)
  })
}

export interface BrassOptions {
  vel?: number
  /** Filter brightness multiplier. */
  brightness?: number
  /** Vibrato depth in semitones (fades in after the attack). */
  vibrato?: number
  pan?: number
  voices?: number
  release?: number
  /** Seconds to swell in (0 = punchy attack). */
  swell?: number
}

/** Brass section: detuned saws through an envelope-controlled low-pass. */
export function brass(c: RenderContext, start: number, dur: number, freq: number, options: BrassOptions = {}): void {
  const { vel = 1, brightness = 1, vibrato = 0, pan = 0, voices = 3, release = 0.12, swell = 0 } = options
  const oscs = Array.from({ length: voices }, () => new Osc(c.sr, c.rng.next()))
  const detune = oscs.map((_, i) => semis((i - (voices - 1) / 2) * 0.08))
  const lowpass = new Biquad(c.sr, 'lowpass', 800, 0.9)
  const highpass = new Biquad(c.sr, 'highpass', 60, 0.7)
  const scoop = new Decay(c.sr, 0.03)
  const blat = new Decay(c.sr, 0.12 / 16)
  let counter = 0
  c.mono(
    start,
    dur + release + 0.05,
    (t) => {
      let f = freq * (1 - 0.02 * scoop.next())
      if (vibrato > 0) f *= semis(vibrato * Math.min(1, Math.max(0, t - 0.25) / 0.3) * Math.sin(TAU * 5.4 * t))
      let s = 0
      for (let i = 0; i < voices; i++) s += oscs[i].saw(f * detune[i])
      s /= voices
      if ((counter++ & 15) === 0) {
        // `blat` advances once per 16 samples, hence its tau is divided by 16.
        const swellIn = swell > 0 ? Math.min(1, t / swell) : 1
        const cutoff = freq * (3 + 6 * brightness * (0.5 + blat.next())) * (0.6 + 0.4 * vel) * (0.4 + 0.6 * swellIn)
        lowpass.set('lowpass', Math.min(c.sr * 0.45, cutoff), 0.9)
      }
      const amp = gate(t, swell > 0 ? swell : 0.025, dur, release)
      return highpass.process(lowpass.process(Math.tanh(s * 1.5))) * amp * vel
    },
    { pan },
  )
}

const BELL: readonly Partial[] = [
  [1, 1, 1],
  [2, 0.5, 0.7],
  [2.76, 0.45, 0.55],
  [5.4, 0.25, 0.3],
  [8.93, 0.12, 0.18],
]

export interface BellOptions {
  pan?: number
  partials?: readonly Partial[]
}

/** Additive bell / chime with inharmonic partials. */
export function bell(c: RenderContext, start: number, freq: number, vel = 1, tau = 1, options: BellOptions = {}): void {
  const { pan = 0, partials = BELL } = options
  const chime = modes(c, freq, tau, partials, true)
  c.mono(
    start,
    tau * 4,
    (t) => {
      let s = 0
      for (let i = 0; i < chime.length; i++) {
        const m = chime[i]
        s += m.osc.sine(m.freq) * m.amp * m.env.next()
      }
      return s * Math.min(1, t / 0.0015) * vel
    },
    { pan },
  )
}
