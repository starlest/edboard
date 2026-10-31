import { TAU, note } from '../../dsp/math.ts'
import { Osc } from '../../dsp/osc.ts'
import type { BuiltinSound } from '../types.ts'

export const coin: BuiltinSound = {
  id: 'coin',
  name: 'COIN',
  description: '8-bit coin pickup.',
  category: 'retro',
  duration: 0.8,
  render(c) {
    const osc = new Osc(c.sr)
    const low = note('B5')
    const high = note('E6')
    c.mono(0, 0.6, (t) => {
      const first = t < 0.075
      return osc.square(first ? low : high) * (first ? 1 : Math.exp(-(t - 0.075) / 0.16)) * 0.6
    })
  },
}

export const powerUp: BuiltinSound = {
  id: 'power-up',
  name: 'POWER UP',
  description: '8-bit power-up arpeggio.',
  category: 'retro',
  duration: 1,
  render(c) {
    const steps = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].map(note)
    const stepLength = 0.055
    const run = steps.length * stepLength
    const lead = new Osc(c.sr)
    const sub = new Osc(c.sr)
    c.mono(0, 0.85, (t) => {
      const f = steps[Math.min(steps.length - 1, Math.floor(t / stepLength))] * (1 + 0.01 * Math.sin(TAU * 18 * t))
      const amp = t < run ? 1 : Math.exp(-(t - run) / 0.15)
      return (lead.square(f, 0.25) * 0.55 + sub.tri(f / 2) * 0.35) * amp
    })
  },
}

export const gameOver: BuiltinSound = {
  id: 'game-over',
  name: 'GAME OVER',
  description: '8-bit descending game-over jingle.',
  category: 'retro',
  duration: 2.2,
  render(c) {
    const melody: readonly (readonly [string, number, number])[] = [
      ['C5', 0, 0.18],
      ['G4', 0.2, 0.18],
      ['Eb4', 0.4, 0.18],
      ['D4', 0.6, 0.14],
      ['Db4', 0.76, 0.14],
      ['C4', 0.92, 0.9],
    ]
    melody.forEach(([name, start, length], i) => {
      const last = i === melody.length - 1
      const lead = new Osc(c.sr)
      const bass = new Osc(c.sr)
      const f = note(name)
      c.mono(start, length + 0.05, (t) => {
        const vibrato = last ? 1 + 0.015 * Math.sin(TAU * 6 * t) * Math.min(1, t / 0.3) : 1
        const sustain = last ? Math.exp(-Math.min(t, length) / 0.6) : 1
        const release = t < length ? 1 : Math.max(0, 1 - (t - length) / 0.05)
        const attack = Math.min(1, t / 0.003)
        return (lead.square(f * vibrato) * 0.5 + bass.tri((f / 2) * vibrato) * 0.4) * sustain * release * attack
      })
    })
  },
}
