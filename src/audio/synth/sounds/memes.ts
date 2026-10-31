import type { RenderContext } from '../../dsp/buffer.ts'
import { applyReverb } from '../../dsp/effects.ts'
import { decay, envSmooth, gate } from '../../dsp/env.ts'
import { Biquad } from '../../dsp/filters.ts'
import { TAU, note, semis, smoothstep } from '../../dsp/math.ts'
import { Noise } from '../../dsp/noise.ts'
import { Osc } from '../../dsp/osc.ts'
import { cymbal, kick, snare, tom } from '../kit.ts'
import type { BuiltinSound } from '../types.ts'

export const airHorn: BuiltinSound = {
  id: 'air-horn',
  name: 'AIR HORN',
  description: 'Stadium air horn: BWAAA – BWA – BWA – BWAAAAAA.',
  category: 'meme',
  duration: 2.6,
  loudness: -13,
  render(c) {
    const blasts: readonly (readonly [number, number])[] = [
      [0, 0.4],
      [0.5, 0.11],
      [0.68, 0.11],
      [0.86, 1.15],
    ]
    const f0 = note('G4')
    for (const [start, length] of blasts) {
      const reeds = [new Osc(c.sr, c.rng.next()), new Osc(c.sr, c.rng.next()), new Osc(c.sr, c.rng.next())]
      const sub = new Osc(c.sr, c.rng.next())
      const body = new Biquad(c.sr, 'peaking', 1350, 1.1, 8)
      const honk = new Biquad(c.sr, 'peaking', 2900, 2, 5)
      const lowpass = new Biquad(c.sr, 'lowpass', 7000, 0.8)
      const highpass = new Biquad(c.sr, 'highpass', 220, 0.7)
      const noise = new Noise(c.rng)
      const hiss = new Biquad(c.sr, 'bandpass', 3500, 0.8)
      c.mono(start, length + 0.15, (t) => {
        // Air horns scoop up into pitch and waver slightly under pressure.
        const f = f0 * (1 - 0.12 * Math.exp(-t / 0.025)) * (1 + 0.003 * Math.sin(TAU * 7 * t))
        // Two reeds ~25 Hz apart give the raspy beating.
        let s = reeds[0].saw(f) + reeds[1].saw(f * 1.004) + 0.85 * reeds[2].saw(f * 1.063) + 0.35 * sub.square(f * 0.5, 0.45)
        s = Math.tanh(s * 0.9)
        s = highpass.process(lowpass.process(honk.process(body.process(s))))
        s += 0.05 * hiss.process(noise.white())
        return s * gate(t, 0.012, length, 0.07)
      })
    }
    applyReverb(c.out, { room: 0.7, damp: 0.35, wet: 0.12 })
  },
}

export const vineBoom: BuiltinSound = {
  id: 'vine-boom',
  name: 'VINE BOOM',
  description: 'The deep, dramatic bass boom.',
  category: 'meme',
  duration: 2.8,
  render(c) {
    const sub = new Osc(c.sr)
    const body = new Osc(c.sr)
    const overtone = new Osc(c.sr)
    const noise = new Noise(c.rng)
    const click = new Biquad(c.sr, 'lowpass', 2500, 0.7)
    const lowpass = new Biquad(c.sr, 'lowpass', 1100, 0.9)
    c.mono(0, 2.75, (t) => {
      const fSub = 44 + 76 * Math.exp(-t / 0.045)
      const fBody = 88 + 160 * Math.exp(-t / 0.03)
      let s = sub.sine(fSub) * decay(t, 0.75)
      s += 0.5 * body.tri(fBody) * decay(t, 0.22)
      s += 0.18 * overtone.sine(fSub * 3.01) * decay(t, 0.15)
      s += 0.35 * click.process(noise.white()) * decay(t, 0.006)
      // Saturation adds harmonics so the boom still reads on laptop speakers.
      return lowpass.process(Math.tanh(s * 2.2)) * Math.min(1, t / 0.002)
    })
    applyReverb(c.out, { room: 0.82, damp: 0.55, wet: 0.22 })
  },
}

/** One plunger-muted trombone note. */
function tromboneNote(c: RenderContext, start: number, length: number, freq: number, last: boolean): void {
  const main = new Osc(c.sr, c.rng.next())
  const second = new Osc(c.sr, c.rng.next())
  const sub = new Osc(c.sr, c.rng.next())
  const lowpass = new Biquad(c.sr, 'lowpass', 600, 3)
  const highpass = new Biquad(c.sr, 'highpass', 90, 0.7)
  let counter = 0
  c.mono(start, length + 0.2, (t) => {
    let cents = -40 * Math.exp(-t / 0.035)
    if (last) {
      cents += -60 * smoothstep(t / length)
      cents += (8 + 32 * smoothstep(t / 0.9)) * Math.sin(TAU * 5.2 * t)
    }
    const f = freq * semis(cents / 100)
    const s = main.saw(f) + 0.6 * second.saw(f * 1.003) + 0.3 * sub.square(f * 0.5, 0.5)
    if ((counter++ & 15) === 0) {
      // The "wah": the plunger opens on each note; the final note wobbles with the vibrato.
      const open = Math.min(1, t / 0.08)
      const cutoff = last
        ? (350 + 1150 * open) * (1 - 0.45 * smoothstep(t / length)) * (1 + 0.45 * Math.sin(TAU * 5.2 * t - 1.2))
        : 350 + 1500 * open * Math.exp(-Math.max(0, t - 0.08) / 0.3)
      lowpass.set('lowpass', cutoff, 3.2)
    }
    return highpass.process(lowpass.process(Math.tanh(s * 0.7))) * gate(t, 0.025, length, 0.12)
  })
}

export const sadTrombone: BuiltinSound = {
  id: 'sad-trombone',
  name: 'SAD TROMBONE',
  description: 'Wah, wah, wah, waaaah. You tried.',
  category: 'meme',
  duration: 3.6,
  render(c) {
    const notes: readonly (readonly [number, number, string])[] = [
      [0, 0.36, 'D4'],
      [0.42, 0.36, 'C#4'],
      [0.84, 0.36, 'C4'],
      [1.26, 1.65, 'B3'],
    ]
    notes.forEach(([start, length, name], i) => tromboneNote(c, start, length, note(name), i === notes.length - 1))
    applyReverb(c.out, { room: 0.55, damp: 0.5, wet: 0.15 })
  },
}

export const bonk: BuiltinSound = {
  id: 'bonk',
  name: 'BONK',
  description: 'A hollow cartoon bonk on the head.',
  category: 'meme',
  duration: 0.9,
  render(c) {
    const p1 = new Osc(c.sr)
    const p2 = new Osc(c.sr)
    const p3 = new Osc(c.sr)
    const noise = new Noise(c.rng)
    const click = new Biquad(c.sr, 'bandpass', 2400, 1.2)
    c.mono(0, 0.7, (t) => {
      const f = 330 + 190 * Math.exp(-t / 0.012)
      let s = p1.sine(f) * decay(t, 0.11)
      s += 0.45 * p2.sine(f * 2.37) * decay(t, 0.05)
      s += 0.2 * p3.sine(f * 4.13) * decay(t, 0.025)
      s += 0.5 * click.process(noise.white()) * decay(t, 0.004)
      return Math.tanh(s * 1.6)
    })
    applyReverb(c.out, { room: 0.45, damp: 0.5, wet: 0.12 })
  },
}

export const recordScratch: BuiltinSound = {
  id: 'record-scratch',
  name: 'SCRATCH',
  description: 'Record scratch — the music stops. Awkward.',
  category: 'meme',
  duration: 1.3,
  render(c) {
    const sr = c.sr
    // 1. A short groove to scratch: kick, snare and a minor chord stab.
    const groove = new Float32Array(Math.round(sr * 2))
    const hit = (start: number, gen: (t: number) => number, dur: number) => {
      const first = Math.round(start * sr)
      for (let i = 0; i < dur * sr && first + i < groove.length; i++) groove[first + i] += gen(i / sr)
    }
    for (const beat of [0, 0.5, 1, 1.5]) {
      const k = new Osc(sr)
      hit(beat, (t) => k.sine(45 + 100 * Math.exp(-t / 0.03)) * decay(t, 0.2) * 0.9, 0.5)
    }
    for (const beat of [0.25, 0.75, 1.25, 1.75]) {
      const n = new Noise(c.rng)
      const bp = new Biquad(sr, 'bandpass', 2500, 0.8)
      hit(beat, (t) => bp.process(n.white()) * decay(t, 0.06) * 0.8, 0.3)
    }
    const chord = [note('C4'), note('Eb4'), note('G4'), note('C3')].map((f) => ({ f, o: new Osc(sr, c.rng.next()) }))
    const stab = new Biquad(sr, 'lowpass', 2200, 0.8)
    hit(0, (t) => {
      let s = 0
      for (const v of chord) s += v.o.saw(v.f)
      return stab.process(s) * 0.18 * (0.55 + 0.45 * Math.cos(TAU * 2 * t))
    }, 2)

    // 2. Turntable motion: play, grab, back-and-forth, then wind down to a stop.
    const motion = [
      [0, 1],
      [0.2, 1],
      [0.24, -2.4],
      [0.3, -2.6],
      [0.34, 3],
      [0.42, 3.2],
      [0.46, -1.8],
      [0.52, -1.5],
      [0.56, 1.2],
      [0.86, 0],
    ] as const
    let pos = 0.6 * sr
    const lowpass = new Biquad(sr, 'lowpass', 9000, 0.7)
    const noise = new Noise(c.rng)
    const needle = new Biquad(sr, 'bandpass', 3000, 0.9)
    c.mono(0, 1, (t) => {
      const rate = envSmooth(t, motion)
      pos += rate
      const i0 = Math.floor(pos)
      const frac = pos - i0
      const len = groove.length
      const a = groove[((i0 % len) + len) % len]
      const b = groove[(((i0 + 1) % len) + len) % len]
      let s = a + (b - a) * frac
      const friction = t > 0.2 && t < 0.86 ? Math.min(1, Math.abs(rate - 1) * 0.35) : 0
      s += friction * 0.25 * needle.process(noise.white())
      if (c.rng.chance(0.0006)) s += c.rng.bipolar() * 0.25
      // As the platter grinds to a halt the audio sinks below hearing (and must not leave DC behind).
      return lowpass.process(s) * smoothstep((0.9 - t) / 0.3)
    })
  },
}

export const bleep: BuiltinSound = {
  id: 'bleep',
  name: 'BLEEP',
  description: 'Censor tone. Hold the pad to bleep — it loops for as long as you hold.',
  category: 'meme',
  duration: 1,
  loudness: -18,
  loopable: true,
  render(c) {
    // Exactly 1000 cycles in one second, so the buffer loops seamlessly at any sample rate.
    const osc = new Osc(c.sr)
    c.mono(0, 1, () => osc.sine(1000))
  },
}

export const rimshot: BuiltinSound = {
  id: 'rimshot',
  name: 'BA DUM TSS',
  description: 'The comedy rimshot: ba-dum-tss.',
  category: 'meme',
  duration: 2.4,
  render(c) {
    snare(c, 0, 0.8, { tone: 230, pan: -0.1 }) // ba
    tom(c, 0.15, 0.9, 150, 105, 0.22, 0.15) // dum
    kick(c, 0.45, 0.9) // tss…
    cymbal(c, 0.45, 0.85, 0.55, { pan: 0.2 })
    applyReverb(c.out, { room: 0.4, damp: 0.5, wet: 0.1 })
  },
}
