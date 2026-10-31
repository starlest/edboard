import type { RenderContext } from '../../dsp/buffer.ts'
import { panGains } from '../../dsp/buffer.ts'
import { applyEcho, applyReverb } from '../../dsp/effects.ts'
import { Decay, attackDecay, decay, envExp, gate } from '../../dsp/env.ts'
import { Biquad } from '../../dsp/filters.ts'
import { TAU, semis, smoothstep } from '../../dsp/math.ts'
import { Noise } from '../../dsp/noise.ts'
import { Osc } from '../../dsp/osc.ts'
import { bell } from '../kit.ts'
import type { BuiltinSound } from '../types.ts'

export const laser: BuiltinSound = {
  id: 'laser',
  name: 'LASER',
  description: 'Sci-fi blaster: pew pew!',
  category: 'sfx',
  duration: 1.1,
  render(c) {
    for (const [start, pan] of [
      [0, -0.2],
      [0.21, 0.2],
    ] as const) {
      const square = new Osc(c.sr)
      const saw = new Osc(c.sr)
      const lowpass = new Biquad(c.sr, 'lowpass', 6000, 0.7)
      c.mono(
        start,
        0.25,
        (t) => {
          const f = 170 + 2300 * Math.exp(-t / 0.045)
          return lowpass.process(square.square(f, 0.3) * 0.7 + saw.saw(f * 0.503) * 0.5) * attackDecay(t, 0.002, 0.09)
        },
        { pan },
      )
    }
    applyEcho(c.out, { time: 0.11, feedback: 0.35, mix: 0.35, tone: 3500, pingPong: true })
  },
}

export const explosion: BuiltinSound = {
  id: 'explosion',
  name: 'EXPLOSION',
  description: 'Big boom with rumble and falling debris.',
  category: 'sfx',
  duration: 3.6,
  loudness: -13,
  render(c) {
    const noise = new Noise(c.rng)
    const lowpass = new Biquad(c.sr, 'lowpass', 4000, 0.8)
    const crack = new Biquad(c.sr, 'highpass', 1200, 0.7)
    const sub = new Osc(c.sr)
    let counter = 0
    c.mono(0, 3.4, (t) => {
      if ((counter++ & 31) === 0) lowpass.set('lowpass', 120 + 5500 * Math.exp(-t / 0.35), 0.8)
      let s = lowpass.process(noise.brown() * 0.8 + noise.white() * 0.25) * attackDecay(t, 0.004, 0.75)
      s += crack.process(noise.white()) * decay(t, 0.025) * 0.8
      s += sub.sine(28 + 55 * Math.exp(-t / 0.12)) * attackDecay(t, 0.003, 0.45) * 0.9
      return Math.tanh(s * 2.2)
    })
    for (let i = 0; i < 70; i++) {
      const start = 0.15 + Math.pow(c.rng.next(), 1.8) * 2.2
      const vel = c.rng.range(0.05, 0.3) * Math.exp(-start / 1.2)
      const band = new Biquad(c.sr, 'bandpass', c.rng.range(800, 4000), 2)
      const grit = new Noise(c.rng)
      c.mono(start, 0.03, (t) => band.process(grit.white()) * decay(t, 0.006) * vel * 4, { pan: c.rng.range(-0.7, 0.7) })
    }
    applyReverb(c.out, { room: 0.85, damp: 0.5, wet: 0.25 })
  },
}

export const boing: BuiltinSound = {
  id: 'boing',
  name: 'BOING',
  description: 'Cartoon spring: boyoyoyoing!',
  category: 'sfx',
  duration: 1.2,
  render(c) {
    const tri = new Osc(c.sr)
    const pulse = new Osc(c.sr)
    const mouth = new Biquad(c.sr, 'bandpass', 800, 4)
    let counter = 0
    c.mono(0, 1, (t) => {
      const wobble = Math.sin(TAU * 11 * t) * Math.exp(-t / 0.3)
      const f = 220 * (1 + 0.6 * smoothstep(t / 0.5)) * (1 + 0.12 * wobble)
      if ((counter++ & 15) === 0) mouth.set('bandpass', 900 + 900 * smoothstep(t / 0.05) + 500 * wobble, 4)
      const s = 0.6 * tri.tri(f) + 0.4 * pulse.square(f, 0.25)
      return (0.5 * s + 1.6 * mouth.process(s)) * attackDecay(t, 0.003, 0.32)
    })
  },
}

export const whoosh: BuiltinSound = {
  id: 'whoosh',
  name: 'WHOOSH',
  description: 'Fast swoosh flying past, left to right.',
  category: 'sfx',
  duration: 1.2,
  render(c) {
    const noise = new Noise(c.rng)
    const bandL = new Biquad(c.sr, 'bandpass', 500, 1.3)
    const bandR = new Biquad(c.sr, 'bandpass', 500, 1.3)
    let counter = 0
    c.stereo(0, 1, (t, frame) => {
      const x = Math.min(1, t / 0.9)
      const swell = Math.sin(Math.PI * x) ** 2
      if ((counter++ & 15) === 0) {
        const centre = 250 + 2600 * Math.sin(Math.PI * Math.min(1, x * 0.95)) ** 1.5
        bandL.set('bandpass', centre, 1.3)
        bandR.set('bandpass', centre * 1.05, 1.3)
      }
      const s = noise.white()
      const [gl, gr] = panGains(-0.9 + 1.8 * smoothstep(x))
      frame[0] = bandL.process(s) * swell * gl
      frame[1] = bandR.process(s) * swell * gr
    })
  },
}

export const chaChing: BuiltinSound = {
  id: 'cha-ching',
  name: 'CHA-CHING',
  description: 'Cash register: ka-ching! Thanks for the sub.',
  category: 'sfx',
  duration: 2,
  render(c) {
    for (const [start, centre] of [
      [0, 3200],
      [0.045, 2600],
    ] as const) {
      const noise = new Noise(c.rng)
      const band = new Biquad(c.sr, 'bandpass', centre, 2)
      c.mono(start, 0.1, (t) => band.process(noise.white()) * attackDecay(t, 0.001, 0.02) * 1.6)
    }
    const thunk = new Osc(c.sr)
    c.mono(0.06, 0.3, (t) => thunk.sine(140 * (1 + 0.3 * Math.exp(-t / 0.01))) * decay(t, 0.05) * 0.8)
    bell(c, 0.1, 2093, 1, 1.1, {
      partials: [
        [1, 1, 1],
        [2.32, 0.6, 0.7],
        [3.86, 0.45, 0.5],
        [5.5, 0.3, 0.35],
        [7.9, 0.15, 0.2],
      ],
    })
    for (let i = 0; i < 24; i++) {
      const ping = new Osc(c.sr)
      const f = c.rng.range(3500, 7500)
      const tau = c.rng.range(0.03, 0.12)
      const vel = c.rng.range(0.05, 0.2)
      c.mono(0.08 + c.rng.next() * 0.45, tau * 5, (t) => ping.sine(f) * decay(t, tau) * vel, { pan: c.rng.range(-0.6, 0.6) })
    }
    applyReverb(c.out, { room: 0.4, damp: 0.4, wet: 0.12 })
  },
}

function thump(c: RenderContext, start: number, vel: number, high: number, low: number): void {
  const osc = new Osc(c.sr)
  const body = new Biquad(c.sr, 'lowpass', 160, 0.8)
  const smooth = new Biquad(c.sr, 'lowpass', 500, 0.7)
  c.mono(start, 0.4, (t) => {
    const f = low + (high - low) * Math.exp(-t / 0.04)
    const s = osc.sine(f) * attackDecay(t, 0.012, 0.075)
    // Saturation gives the thump harmonics that small speakers can reproduce.
    return smooth.process(Math.tanh(body.process(s) * 3)) * vel
  })
}

export const heartbeat: BuiltinSound = {
  id: 'heartbeat',
  name: 'HEARTBEAT',
  description: 'Tense heartbeat: lub-dub, lub-dub.',
  category: 'sfx',
  duration: 3,
  render(c) {
    for (let k = 0; k < 3; k++) {
      const t = 0.02 + k * 0.86
      thump(c, t, 1, 62, 44)
      thump(c, t + 0.23, 0.72, 70, 50)
    }
  },
}

export const alarm: BuiltinSound = {
  id: 'alarm',
  name: 'ALARM',
  description: 'Rising whoop alarm. Red alert!',
  category: 'sfx',
  duration: 2.5,
  render(c) {
    for (let k = 0; k < 4; k++) {
      const saw = new Osc(c.sr)
      const square = new Osc(c.sr)
      const lowpass = new Biquad(c.sr, 'lowpass', 4000, 0.7)
      c.mono(k * 0.55, 0.5, (t) => {
        const f = 520 * Math.pow(2.2, t / 0.48)
        const s = saw.saw(f) * 0.6 + square.square(f * 1.005, 0.5) * 0.4
        return lowpass.process(Math.tanh(s * 1.2)) * gate(t, 0.01, 0.46, 0.03)
      })
    }
    applyReverb(c.out, { room: 0.5, damp: 0.5, wet: 0.1 })
  },
}

function beep(c: RenderContext, start: number, length: number, freq: number, vel: number): void {
  const square = new Osc(c.sr)
  const sine = new Osc(c.sr)
  const lowpass = new Biquad(c.sr, 'lowpass', 5000, 0.7)
  c.mono(start, length + 0.05, (t) => lowpass.process(square.square(freq) * 0.35 + sine.sine(freq) * 0.65) * gate(t, 0.004, length, 0.03) * vel)
}

export const countdown: BuiltinSound = {
  id: 'countdown',
  name: 'COUNTDOWN',
  description: 'Three, two, one… GO!',
  category: 'sfx',
  duration: 4.2,
  render(c) {
    for (let k = 0; k < 3; k++) beep(c, k, 0.16, 880, 0.8)
    beep(c, 3, 0.75, 1760, 1)
  },
}

export const suspense: BuiltinSound = {
  id: 'suspense',
  name: 'SUSPENSE',
  description: 'Rising tension riser that cuts off right at the reveal.',
  category: 'sfx',
  duration: 3.4,
  render(c) {
    const noise = new Noise(c.rng)
    const air = new Biquad(c.sr, 'bandpass', 300, 2.5)
    const lowpass = new Biquad(c.sr, 'lowpass', 400, 1.5)
    const saws = Array.from({ length: 6 }, () => ({ osc: new Osc(c.sr, c.rng.next()), ratio: semis(c.rng.range(-0.15, 0.15)) }))
    const length = 3
    let counter = 0
    c.mono(0, length + 0.05, (t) => {
      const x = Math.min(1, t / length)
      if ((counter++ & 15) === 0) {
        air.set('bandpass', 300 * Math.pow(20, x), 2.5)
        lowpass.set('lowpass', 400 * Math.pow(14, x), 1.5)
      }
      const f = 110 * Math.pow(2, x * 1.5)
      let tone = 0
      for (const s of saws) tone += s.osc.saw(f * s.ratio)
      const tremolo = 1 + 0.15 * Math.sin(TAU * (4 + 10 * x) * t)
      return (lowpass.process(tone / 3) * 0.6 + air.process(noise.white()) * 1.4) * x * x * tremolo * gate(t, 0.05, length, 0.02)
    })
  },
}

export const slideWhistle: BuiltinSound = {
  id: 'slide-whistle',
  name: 'SLIDE WHISTLE',
  description: 'Cartoon slide whistle, up and back down.',
  category: 'sfx',
  duration: 1.4,
  render(c) {
    const sine = new Osc(c.sr)
    const harmonic = new Osc(c.sr)
    const noise = new Noise(c.rng)
    const breath = new Biquad(c.sr, 'bandpass', 1000, 3)
    let counter = 0
    c.mono(0, 1.2, (t) => {
      const f =
        envExp(t, [
          [0, 520],
          [0.45, 1750],
          [1.05, 480],
        ]) *
        (1 + 0.012 * Math.sin(TAU * 6 * t))
      if ((counter++ & 31) === 0) breath.set('bandpass', f, 3)
      const s = sine.sine(f) + 0.12 * harmonic.sine(f * 2) + 0.25 * breath.process(noise.white())
      return s * gate(t, 0.04, 1.05, 0.1)
    })
    applyReverb(c.out, { room: 0.35, damp: 0.5, wet: 0.08 })
  },
}

/** `[ratio, amplitude, decay seconds]` */
const GONG_PARTIALS: readonly (readonly [number, number, number])[] = [
  [1, 1, 2.7],
  [1.52, 0.8, 2.3],
  [2.03, 0.7, 1.9],
  [2.47, 0.55, 1.7],
  [2.94, 0.5, 1.45],
  [3.58, 0.42, 1.2],
  [4.17, 0.35, 1],
  [4.83, 0.3, 0.85],
  [5.45, 0.25, 0.72],
  [6.31, 0.2, 0.6],
  [7.2, 0.16, 0.5],
  [8.6, 0.12, 0.36],
  [10.3, 0.08, 0.27],
]

export const gong: BuiltinSound = {
  id: 'gong',
  name: 'GONG',
  description: 'Huge shimmering gong. You have been eliminated.',
  category: 'sfx',
  duration: 6,
  loudness: -15,
  render(c) {
    const f0 = 92
    // Each partial is doubled with a slight detune per side for the shimmering beat.
    const partials = GONG_PARTIALS.flatMap(([ratio, amp, tau]) =>
      [-1, 1].map((side) => ({
        osc: new Osc(c.sr, c.rng.next()),
        freq: f0 * ratio * (1 + side * c.rng.range(0.0006, 0.002)),
        // Higher partials "bloom" in after the strike as energy spreads.
        bloom: c.rng.range(0.02, 0.35) * Math.min(1, ratio / 3),
        glide: c.rng.range(-0.004, 0.006),
        ring: new Decay(c.sr, tau),
        amp,
        left: side < 0,
      })),
    )
    const settle = new Decay(c.sr, 1.5)
    const length = 5.8
    c.stereo(0, length, (t, frame) => {
      const drift = 1 - settle.next()
      const release = smoothstep((length - t) / 1.6)
      let left = 0
      let right = 0
      for (let i = 0; i < partials.length; i++) {
        const p = partials[i]
        const v = p.osc.sine(p.freq * (1 + p.glide * drift)) * Math.min(1, t / p.bloom) * p.ring.next() * p.amp
        if (p.left) {
          left += v * 0.95
          right += v * 0.3
        } else {
          left += v * 0.3
          right += v * 0.95
        }
      }
      frame[0] = left * release
      frame[1] = right * release
    })
    const noise = new Noise(c.rng)
    const mallet = new Biquad(c.sr, 'lowpass', 1500, 0.7)
    c.mono(0, 0.2, (t) => mallet.process(noise.white()) * decay(t, 0.02) * 1.5)
    applyReverb(c.out, { room: 0.8, damp: 0.3, wet: 0.2 })
  },
}
