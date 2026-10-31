import type { RenderContext } from '../dsp/buffer.ts'
import { type EnvPoint, env, envSmooth } from '../dsp/env.ts'
import { Biquad, OnePole, Resonator } from '../dsp/filters.ts'
import { TAU, semis } from '../dsp/math.ts'
import { Noise } from '../dsp/noise.ts'
import { polyBlep } from '../dsp/osc.ts'

/** `[time, F1, F2, F3, F4]` — formant targets in Hz. */
export type FormantFrame = readonly [number, number, number, number, number]

/**
 * Keyframed articulation for the formant synthesiser. Each track is
 * interpolated independently, so consonant/vowel transitions can overlap
 * the way real speech does.
 */
export interface VoiceScore {
  /** Fundamental frequency (Hz). */
  f0: readonly EnvPoint[]
  formants: readonly FormantFrame[]
  /** Voicing amplitude 0..1. */
  voicing: readonly EnvPoint[]
  /** Breath noise fed through the vocal tract 0..1. */
  aspiration?: readonly EnvPoint[]
  /** Frication noise (f, s, bursts) that bypasses the vocal tract 0..1. */
  frication?: readonly EnvPoint[]
  /** Glottal open quotient: ~0.35 pressed/shouted … ~0.8 breathy. */
  openQuotient?: readonly EnvPoint[]
}

export interface VoiceStyle {
  vibratoRate?: number
  /** Vibrato depth in semitones (constant or keyframed). */
  vibratoDepth?: number | readonly EnvPoint[]
  /** Period-to-period pitch jitter (relative std-dev). */
  jitter?: number
  /** Period-to-period amplitude shimmer (relative std-dev). */
  shimmer?: number
  /** Cut-off of the source tilt filter in Hz — higher is brighter / more pressed. */
  brightness?: number
  /** Band-limits of the frication noise. */
  fricationBand?: readonly [number, number]
  fricationGain?: number
  /** Output saturation (0 = clean). */
  drive?: number
  /** Multiplier on formant bandwidths (<1 = more resonant). */
  bandwidthScale?: number
  gain?: number
  pan?: number
}

const F5 = 4300

/**
 * Cascade formant synthesiser in the spirit of Klatt (1980): a band-limited
 * KLGLOTT88 glottal pulse train (plus aspiration noise) drives five two-pole
 * resonators; frication noise is mixed in parallel.
 */
export function renderVoice(c: RenderContext, start: number, score: VoiceScore, style: VoiceStyle = {}): void {
  const {
    vibratoRate = 5.2,
    vibratoDepth = 0,
    jitter = 0.008,
    shimmer = 0.04,
    brightness = 6000,
    fricationBand = [1200, 8000],
    fricationGain = 1,
    drive = 0,
    bandwidthScale = 1,
    gain = 1,
    pan = 0,
  } = style
  const sr = c.sr
  const rng = c.rng
  const noise = new Noise(rng)
  const resonators = [0, 1, 2, 3, 4].map(() => new Resonator(sr))
  const tilt = new OnePole(sr, brightness)
  const aspirationColour = new OnePole(sr, 5500)
  const fricHigh = new Biquad(sr, 'highpass', fricationBand[0], 0.7)
  const fricLow = new Biquad(sr, 'lowpass', fricationBand[1], 0.7)

  const tracks = [1, 2, 3, 4].map((k) => score.formants.map((frame) => [frame[0], frame[k]] as const))
  const aspiration = score.aspiration ?? [[0, 0]]
  const frication = score.frication ?? [[0, 0]]
  const openQuotient = score.openQuotient ?? [[0, 0.5]]
  const vibratoTrack: readonly EnvPoint[] = typeof vibratoDepth === 'number' ? [[0, vibratoDepth]] : vibratoDepth
  const end = Math.max(
    score.f0[score.f0.length - 1][0],
    score.voicing[score.voicing.length - 1][0],
    aspiration[aspiration.length - 1][0],
    frication[frication.length - 1][0],
  )
  // Slow random drift so long vowels do not sound like a held synth note.
  const driftPhase = [rng.next() * TAU, rng.next() * TAU]

  let phase = 0
  let periodPitch = 1
  let periodAmp = 1
  let av = 0
  let ah = 0
  let af = 0
  let oq = 0.5
  let counter = 0

  c.mono(
    start,
    end + 0.05,
    (t) => {
      if ((counter++ & 15) === 0) {
        av = env(t, score.voicing)
        ah = env(t, aspiration)
        af = env(t, frication)
        oq = Math.min(0.85, Math.max(0.3, env(t, openQuotient)))
        // Breathier phonation widens F1 (more glottal losses).
        const b1 = (60 + 90 * (oq - 0.4)) * bandwidthScale
        const bandwidths = [b1, 90 * bandwidthScale, 150 * bandwidthScale, 250 * bandwidthScale, 320]
        for (let k = 0; k < 4; k++) resonators[k].set(envSmooth(t, tracks[k]), bandwidths[k])
        resonators[4].set(F5, bandwidths[4])
      }

      const vibrato = env(t, vibratoTrack) * Math.sin(TAU * vibratoRate * t)
      const drift = 0.06 * Math.sin(TAU * 0.7 * t + driftPhase[0]) + 0.04 * Math.sin(TAU * 1.9 * t + driftPhase[1])
      const freq = env(t, score.f0) * semis(vibrato + drift) * periodPitch
      const dt = freq / sr

      // KLGLOTT88 glottal flow derivative, normalised so the closing peak is -1,
      // with PolyBLEP smoothing the abrupt return to zero at glottal closure.
      let pulse = 0
      if (phase < oq) pulse = (2 * oq * phase - 3 * phase * phase) / (oq * oq)
      let sinceClosure = phase - oq
      if (sinceClosure < 0) sinceClosure += 1
      pulse += 0.5 * polyBlep(sinceClosure, dt)
      const open = phase < oq

      phase += dt
      if (phase >= 1) {
        phase -= Math.floor(phase)
        periodPitch = 1 + jitter * Math.max(-2.5, Math.min(2.5, rng.gauss()))
        periodAmp = 1 + shimmer * Math.max(-2.5, Math.min(2.5, rng.gauss()))
      }

      const breath = aspirationColour.lowpass(noise.white()) * ah * (open ? 1 : 0.4)
      let x = tilt.lowpass(pulse) * av * periodAmp + breath * 2.5
      for (let k = 0; k < 5; k++) x = resonators[k].process(x)
      x *= 0.12

      const fric = fricLow.process(fricHigh.process(noise.white())) * af * fricationGain * 0.3
      let y = x + fric
      if (drive > 0) y = Math.tanh(y * drive) / Math.tanh(drive)
      return y * gain
    },
    { pan },
  )
}
