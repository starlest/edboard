import type { RenderContext } from '../../dsp/buffer.ts'
import { applyReverb } from '../../dsp/effects.ts'
import { Decay, env, gate } from '../../dsp/env.ts'
import { Biquad } from '../../dsp/filters.ts'
import { TAU, note } from '../../dsp/math.ts'
import { Noise } from '../../dsp/noise.ts'
import { Osc } from '../../dsp/osc.ts'
import { bell, brass, cymbal, kick, snare, timpani, timpaniRoll } from '../kit.ts'
import type { BuiltinSound } from '../types.ts'

export const drumRoll: BuiltinSound = {
  id: 'drum-roll',
  name: 'DRUM ROLL',
  description: 'Snare roll building to a cymbal crash. And the winner is…',
  category: 'stage',
  duration: 5,
  render(c) {
    const rollEnd = 2.6
    let t = 0
    let stroke = 0
    while (t < rollEnd) {
      const vel = 0.22 + 0.68 * Math.pow(t / rollEnd, 1.6)
      const accent = stroke % 2 === 0 ? 1 : 0.88
      snare(c, t, vel * accent * c.rng.range(0.9, 1.05), { decay: 0.06, tone: 200, pan: c.rng.range(-0.15, 0.15) })
      t += 0.034 + c.rng.range(-0.003, 0.003)
      stroke++
    }
    snare(c, rollEnd + 0.02, 1, { decay: 0.16 })
    kick(c, rollEnd + 0.02, 1)
    cymbal(c, rollEnd + 0.02, 1, 1.4)
    applyReverb(c.out, { room: 0.5, damp: 0.45, wet: 0.12 })
  },
}

function clap(c: RenderContext, start: number, vel: number, pan: number, centre: number, q: number): void {
  const noise = new Noise(c.rng)
  const band = new Biquad(c.sr, 'bandpass', centre, q)
  const highpass = new Biquad(c.sr, 'highpass', 500, 0.7)
  const tau = c.rng.range(0.006, 0.014)
  const body = new Decay(c.sr, tau)
  c.mono(
    start,
    tau * 7,
    (t) => highpass.process(band.process(noise.white())) * body.next() * Math.min(1, t / 0.0007) * vel * 2.2,
    { pan },
  )
}

export const applause: BuiltinSound = {
  id: 'applause',
  name: 'APPLAUSE',
  description: 'A warm round of applause from the crowd.',
  category: 'stage',
  duration: 4.6,
  render(c) {
    for (let person = 0; person < 34; person++) {
      const rate = c.rng.range(3.3, 5.2)
      const begin = c.rng.range(0, 0.55)
      const end = c.rng.range(2.6, 3.8)
      const pan = c.rng.range(-0.85, 0.85)
      const distance = c.rng.range(0.35, 1)
      const centre = c.rng.range(800, 2400)
      const q = c.rng.range(1, 2.2)
      for (let t = begin; t < end; t += (1 / rate) * c.rng.range(0.85, 1.15)) {
        const swell = Math.min(1, (t - begin) / 0.4) * Math.min(1, (end - t) / 0.6)
        clap(c, t, distance * swell * c.rng.range(0.6, 1), pan, centre * c.rng.range(0.92, 1.08), q)
      }
    }
    const noise = new Noise(c.rng)
    const wash = new Biquad(c.sr, 'bandpass', 1800, 0.6)
    c.mono(0, 4, (t) =>
      0.05 *
      wash.process(noise.pink()) *
      env(t, [
        [0, 0],
        [0.5, 1],
        [2.8, 1],
        [3.9, 0],
      ]),
    )
    applyReverb(c.out, { room: 0.75, damp: 0.4, wet: 0.2 })
  },
}

function chirp(c: RenderContext, start: number, freq: number, gain: number, pan: number): void {
  const osc = new Osc(c.sr)
  const harmonic = new Osc(c.sr)
  const pulse = 0.016
  const period = 0.027
  c.mono(
    start,
    3 * period,
    (t) => {
      const local = t - Math.floor(t / period) * period
      const a = local < pulse ? Math.sin((Math.PI * local) / pulse) ** 2 : 0
      const f = freq * (1 + (0.01 * local) / pulse)
      return (osc.sine(f) + 0.15 * harmonic.sine(f * 2)) * a * gain
    },
    { pan },
  )
}

export const crickets: BuiltinSound = {
  id: 'crickets',
  name: 'CRICKETS',
  description: 'Awkward silence… *chirp chirp*.',
  category: 'stage',
  duration: 3.8,
  render(c) {
    const choir = [
      { f: 4400, period: 0.52, offset: 0.05, pan: -0.5, gain: 1 },
      { f: 4900, period: 0.61, offset: 0.27, pan: 0.55, gain: 0.7 },
      { f: 4150, period: 0.73, offset: 0.4, pan: 0.1, gain: 0.45 },
    ]
    for (const cricket of choir) {
      for (let t = cricket.offset; t < 3.4; t += cricket.period * c.rng.range(0.95, 1.05)) {
        chirp(c, t, cricket.f * c.rng.range(0.99, 1.01), cricket.gain, cricket.pan)
      }
    }
    const noise = new Noise(c.rng)
    const air = new Biquad(c.sr, 'lowpass', 500, 0.7)
    c.mono(0, 3.8, (t) =>
      0.03 *
      air.process(noise.brown()) *
      env(t, [
        [0, 0],
        [0.3, 1],
        [3.3, 1],
        [3.8, 0],
      ]),
    )
    applyReverb(c.out, { room: 0.6, damp: 0.3, wet: 0.18 })
  },
}

export const dunDunDun: BuiltinSound = {
  id: 'dun-dun-dun',
  name: 'DUN DUN DUN',
  description: 'Dramatic orchestral sting. Plot twist!',
  category: 'stage',
  duration: 4.4,
  render(c) {
    const hits: readonly (readonly [number, number, readonly string[], number])[] = [
      [0, 0.3, ['D3', 'A3', 'D4'], 0.9],
      [0.42, 0.3, ['F3', 'C4', 'F4'], 0.95],
      [0.84, 2.3, ['C#3', 'G3', 'C#4', 'E4'], 1],
    ]
    for (const [start, length, chord, vel] of hits) {
      const sustained = length > 1
      for (const name of chord) {
        brass(c, start, length, note(name), {
          vel,
          vibrato: sustained ? 0.12 : 0,
          pan: c.rng.range(-0.35, 0.35),
          swell: 0,
        })
      }
      brass(c, start, length, note(chord[0]) / 2, { vel: vel * 0.8, brightness: 0.6 })
      timpani(c, start, note(chord[0]) / 2, vel, sustained ? 1.2 : 0.5)
    }
    timpaniRoll(c, 1.1, 1.8, note('C#2'), 0.12, 0.4)
    applyReverb(c.out, { room: 0.8, damp: 0.45, wet: 0.25 })
  },
}

export const victory: BuiltinSound = {
  id: 'victory',
  name: 'VICTORY',
  description: 'Triumphant brass fanfare. GG!',
  category: 'stage',
  duration: 3.2,
  render(c) {
    const pickup: readonly (readonly [number, string])[] = [
      [0, 'C5'],
      [0.11, 'E5'],
      [0.22, 'G5'],
    ]
    for (const [start, name] of pickup) brass(c, start, 0.1, note(name), { vel: 0.85, brightness: 1.2 })
    for (const name of ['C5', 'E5', 'G5', 'C6']) {
      brass(c, 0.34, 1.3, note(name), { vel: 1, brightness: 1.2, vibrato: 0.1, pan: c.rng.range(-0.3, 0.3) })
    }
    brass(c, 0.34, 1.3, note('C4'), { vel: 0.8 })
    cymbal(c, 0.34, 0.6, 1.5)
    timpani(c, 0.34, note('C3'), 0.9, 0.8)
    applyReverb(c.out, { room: 0.7, damp: 0.4, wet: 0.2 })
  },
}

export const wrong: BuiltinSound = {
  id: 'wrong',
  name: 'WRONG',
  description: 'Game-show buzzer. Survey says… nope.',
  category: 'stage',
  duration: 1.3,
  render(c) {
    const a = new Osc(c.sr)
    const b = new Osc(c.sr)
    const octave = new Osc(c.sr)
    const lowpass = new Biquad(c.sr, 'lowpass', 2600, 0.8)
    const presence = new Biquad(c.sr, 'peaking', 800, 1.5, 6)
    c.mono(0, 1.05, (t) => {
      let s = a.saw(116) + 0.9 * b.square(123.5, 0.5) + 0.4 * octave.saw(232.5)
      s *= 0.8 + 0.2 * Math.sign(Math.sin(TAU * 60 * t))
      s = Math.tanh(s * 1.4)
      return presence.process(lowpass.process(s)) * gate(t, 0.006, 0.92, 0.08)
    })
  },
}

export const correct: BuiltinSound = {
  id: 'correct',
  name: 'CORRECT',
  description: 'Bright "ding-ding!" for a right answer.',
  category: 'stage',
  duration: 2.4,
  render(c) {
    bell(c, 0, note('E6'), 0.8, 1, { pan: -0.2 })
    bell(c, 0.13, note('G#6'), 1, 1.3, { pan: 0.2 })
    applyReverb(c.out, { room: 0.6, damp: 0.3, wet: 0.2 })
  },
}
