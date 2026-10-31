import { applyReverb } from '../../dsp/effects.ts'
import type { EnvPoint } from '../../dsp/env.ts'
import type { BuiltinSound } from '../types.ts'
import { renderVoice } from '../voice.ts'

/*
 * Voice sounds are built with the formant synthesiser. Formant targets are
 * based on Peterson & Barney's adult male averages, nudged towards shouted
 * speech (higher F1, narrower bandwidths, pressed phonation) where it fits.
 */

export const fah: BuiltinSound = {
  id: 'fah',
  name: 'FAH!',
  description: 'The exasperated, shouted "FAAAH!" — for when the play goes horribly wrong.',
  category: 'voice',
  duration: 1.8,
  loudness: -13,
  render(c) {
    renderVoice(
      c,
      0,
      {
        f0: [
          [0, 200],
          [0.15, 212],
          [0.27, 292],
          [0.52, 284],
          [0.8, 262],
          [1.04, 196],
          [1.24, 150],
        ],
        formants: [
          [0, 400, 1000, 2300, 3300],
          [0.13, 430, 1030, 2350, 3320],
          [0.22, 870, 1240, 2620, 3500],
          [0.8, 850, 1220, 2600, 3500],
          [1.05, 770, 1180, 2550, 3450],
          [1.3, 700, 1150, 2500, 3400],
        ],
        voicing: [
          [0, 0],
          [0.12, 0],
          [0.16, 0.75],
          [0.22, 1],
          [0.78, 0.95],
          [1.0, 0.45],
          [1.18, 0.1],
          [1.3, 0],
        ],
        aspiration: [
          [0, 0],
          [0.13, 0.12],
          [0.2, 0.04],
          [0.85, 0.05],
          [1.05, 0.2],
          [1.25, 0.12],
          [1.42, 0],
        ],
        frication: [
          [0, 0],
          [0.025, 0.85],
          [0.115, 0.85],
          [0.16, 0.2],
          [0.2, 0],
        ],
        openQuotient: [
          [0, 0.45],
          [0.22, 0.38],
          [0.8, 0.42],
          [1.1, 0.65],
        ],
      },
      {
        vibratoRate: 5.3,
        vibratoDepth: [
          [0, 0],
          [0.45, 0.05],
          [0.9, 0.3],
          [1.2, 0.35],
        ],
        jitter: 0.01,
        shimmer: 0.06,
        brightness: 9000,
        fricationBand: [1100, 8500],
        fricationGain: 1,
        drive: 1.6,
        bandwidthScale: 0.85,
      },
    )
    applyReverb(c.out, { room: 0.35, damp: 0.6, wet: 0.08 })
  },
}

export const bruh: BuiltinSound = {
  id: 'bruh',
  name: 'BRUH',
  description: 'A deadpan, disappointed "bruh".',
  category: 'voice',
  duration: 1.1,
  render(c) {
    renderVoice(
      c,
      0,
      {
        f0: [
          [0, 128],
          [0.06, 124],
          [0.25, 118],
          [0.45, 105],
          [0.62, 92],
          [0.78, 85],
        ],
        formants: [
          [0, 250, 800, 2000, 3200],
          [0.05, 300, 950, 1700, 3100],
          [0.11, 380, 1080, 1480, 3000],
          [0.22, 600, 1180, 2200, 3200],
          [0.3, 650, 1200, 2400, 3300],
          [0.55, 640, 1190, 2390, 3300],
          [0.78, 600, 1150, 2350, 3300],
        ],
        voicing: [
          [0, 0],
          [0.035, 0],
          [0.05, 0.6],
          [0.1, 0.85],
          [0.3, 1],
          [0.48, 0.9],
          [0.6, 0.35],
          [0.7, 0],
        ],
        aspiration: [
          [0, 0],
          [0.45, 0.02],
          [0.58, 0.35],
          [0.72, 0.28],
          [0.86, 0],
        ],
        frication: [
          [0, 0],
          [0.033, 0],
          [0.037, 0.18],
          [0.05, 0],
        ],
        openQuotient: [
          [0, 0.5],
          [0.3, 0.5],
          [0.6, 0.75],
        ],
      },
      { vibratoDepth: 0.04, jitter: 0.015, shimmer: 0.08, brightness: 4500, fricationBand: [200, 3000] },
    )
    applyReverb(c.out, { room: 0.3, damp: 0.6, wet: 0.06 })
  },
}

export const oof: BuiltinSound = {
  id: 'oof',
  name: 'OOF',
  description: 'A short, pained "oof!" — ouch.',
  category: 'voice',
  duration: 0.8,
  render(c) {
    renderVoice(
      c,
      0,
      {
        f0: [
          [0, 172],
          [0.08, 162],
          [0.2, 136],
          [0.3, 115],
        ],
        formants: [
          [0, 460, 1020, 2300, 3200],
          [0.12, 410, 920, 2250, 3200],
          [0.25, 340, 820, 2200, 3200],
          [0.45, 340, 820, 2200, 3200],
        ],
        voicing: [
          [0, 0],
          [0.012, 0.9],
          [0.04, 1],
          [0.18, 0.85],
          [0.26, 0.2],
          [0.3, 0],
        ],
        aspiration: [
          [0, 0.1],
          [0.05, 0.03],
          [0.2, 0.05],
          [0.28, 0.1],
          [0.33, 0],
        ],
        frication: [
          [0, 0],
          [0.2, 0],
          [0.25, 0.22],
          [0.34, 0.16],
          [0.46, 0],
        ],
        openQuotient: [
          [0, 0.45],
          [0.2, 0.55],
        ],
      },
      { jitter: 0.012, brightness: 5000, fricationBand: [1200, 7500], drive: 0.8 },
    )
    applyReverb(c.out, { room: 0.3, damp: 0.6, wet: 0.06 })
  },
}

export const wow: BuiltinSound = {
  id: 'wow',
  name: 'WOW',
  description: 'An impressed, sing-song "wooow".',
  category: 'voice',
  duration: 1.2,
  render(c) {
    renderVoice(
      c,
      0,
      {
        f0: [
          [0, 175],
          [0.12, 212],
          [0.3, 266],
          [0.5, 246],
          [0.7, 192],
          [0.88, 165],
        ],
        formants: [
          [0, 300, 650, 2200, 3200],
          [0.06, 320, 700, 2250, 3200],
          [0.24, 760, 1180, 2500, 3300],
          [0.42, 740, 1150, 2480, 3300],
          [0.64, 420, 820, 2300, 3200],
          [0.8, 330, 680, 2250, 3200],
        ],
        voicing: [
          [0, 0],
          [0.03, 0.8],
          [0.12, 1],
          [0.6, 0.9],
          [0.75, 0.4],
          [0.86, 0],
        ],
        aspiration: [
          [0, 0.03],
          [0.7, 0.06],
          [0.85, 0.1],
          [0.96, 0],
        ],
        openQuotient: [
          [0, 0.5],
          [0.3, 0.45],
          [0.8, 0.6],
        ],
      },
      {
        vibratoRate: 5.5,
        vibratoDepth: [
          [0, 0],
          [0.3, 0.1],
          [0.7, 0.2],
        ],
        brightness: 6500,
        jitter: 0.01,
      },
    )
    applyReverb(c.out, { room: 0.4, damp: 0.55, wet: 0.08 })
  },
}

export const laugh: BuiltinSound = {
  id: 'laugh',
  name: 'LAUGH',
  description: 'Big belly laugh: HA HA HA HA!',
  category: 'voice',
  duration: 2.4,
  render(c) {
    // A run of breathy "ha" syllables that slow down and fall in pitch, then an exhale.
    const f0: EnvPoint[] = []
    const voicing: EnvPoint[] = []
    const aspiration: EnvPoint[] = []
    const openQuotient: EnvPoint[] = []
    let t = 0.01
    for (let k = 0; k < 7; k++) {
      const length = 0.19 + 0.014 * k
      const pitch = 290 - 13 * k
      const level = k === 0 ? 1 : 0.97 - 0.06 * k
      aspiration.push([t, 0], [t + 0.012, 0.55 * level], [t + 0.05, 0.4 * level], [t + 0.075, 0.06])
      voicing.push([t, 0], [t + 0.045, 0], [t + 0.075, level], [t + length * 0.62, level * 0.85], [t + length * 0.86, 0])
      f0.push([t + 0.04, pitch * 1.06], [t + length * 0.8, pitch * 0.8])
      openQuotient.push([t + 0.001, 0.62], [t + 0.08, 0.45], [t + length * 0.9, 0.6])
      t += length
    }
    aspiration.push([t, 0], [t + 0.05, 0.28], [t + 0.38, 0])
    renderVoice(
      c,
      0,
      {
        f0,
        formants: [
          [0, 830, 1260, 2650, 3500],
          [t, 790, 1210, 2600, 3450],
        ],
        voicing,
        aspiration,
        openQuotient,
      },
      { brightness: 7500, jitter: 0.02, shimmer: 0.08, drive: 1.2 },
    )
    applyReverb(c.out, { room: 0.35, damp: 0.6, wet: 0.08 })
  },
}
