import { Biquad } from './filters.ts'
import { dbToGain } from './math.ts'

export interface LoudnessStats {
  /** Absolute sample peak (linear). */
  peak: number
  /** Maximum momentary (400 ms) K-weighted loudness in LUFS. */
  lufs: number
}

/**
 * Measures loudness following ITU-R BS.1770 K-weighting with 400 ms momentary
 * windows (100 ms hop). The loudest window is what a listener perceives as
 * "how loud this sound hits", which is what we level soundboard clips by.
 */
export function measureLoudness(
  channels: readonly Float32Array[],
  sampleRate: number,
  start = 0,
  end = channels[0]?.length ?? 0,
): LoudnessStats {
  const length = Math.max(0, end - start)
  const block = Math.max(1, Math.round(sampleRate * 0.1))
  const blocks = Math.max(1, Math.ceil(length / block))
  const energy = new Float64Array(blocks)
  let peak = 0

  for (const channel of channels) {
    const shelf = new Biquad(sampleRate, 'highshelf', 1500, Math.SQRT1_2, 4)
    const highpass = new Biquad(sampleRate, 'highpass', 38, 0.5)
    for (let i = 0; i < length; i++) {
      const x = channel[start + i]
      const ax = x < 0 ? -x : x
      if (ax > peak) peak = ax
      const y = highpass.process(shelf.process(x))
      energy[(i / block) | 0] += y * y
    }
  }

  let maxEnergy = 0
  for (let b = 0; b < blocks; b++) {
    let sum = 0
    for (let k = 0; k < 4 && b + k < blocks; k++) sum += energy[b + k]
    if (sum > maxEnergy) maxEnergy = sum
  }
  const meanSquare = maxEnergy / (block * 4)
  return { peak, lufs: meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity }
}

export interface LevelOptions {
  targetLufs: number
  /** Peak ceiling (linear). */
  ceiling: number
  /** Max amount of peak overshoot (dB) to tame with the soft limiter instead of turning down. */
  limitDb?: number
  maxGain?: number
}

/** Gain that brings a clip to the target loudness without pushing peaks past the ceiling (+ limiter headroom). */
export function levelGain(stats: LoudnessStats, options: LevelOptions): number {
  const { targetLufs, ceiling, limitDb = 0, maxGain = 64 } = options
  if (!(stats.peak > 0) || !Number.isFinite(stats.lufs)) return 1
  const loudnessGain = dbToGain(targetLufs - stats.lufs)
  const peakGain = (ceiling * dbToGain(limitDb)) / stats.peak
  return Math.min(loudnessGain, peakGain, maxGain)
}

/**
 * Applies gain and a soft knee limiter in place so that no sample exceeds
 * `ceiling`. Below the knee the signal is untouched.
 */
export function applyGainWithLimiter(
  channels: readonly Float32Array[],
  gain: number,
  ceiling: number,
  kneeRatio = 0.7,
): void {
  const knee = ceiling * kneeRatio
  const range = ceiling - knee
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i] * gain
      const ax = x < 0 ? -x : x
      if (ax <= knee) {
        channel[i] = x
      } else {
        const limited = knee + range * Math.tanh((ax - knee) / range)
        channel[i] = x < 0 ? -limited : limited
      }
    }
  }
}

/** Index of the first sample louder than `thresholdDb`, or `length` if none. */
export function findStart(channels: readonly Float32Array[], thresholdDb = -60): number {
  const threshold = dbToGain(thresholdDb)
  const length = channels[0]?.length ?? 0
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      const x = channel[i]
      if (x > threshold || x < -threshold) return i
    }
  }
  return length
}

/** Index just past the last sample louder than `thresholdDb` (0 if silent). */
export function findEnd(channels: readonly Float32Array[], thresholdDb = -60): number {
  const threshold = dbToGain(thresholdDb)
  const length = channels[0]?.length ?? 0
  for (let i = length - 1; i >= 0; i--) {
    for (const channel of channels) {
      const x = channel[i]
      if (x > threshold || x < -threshold) return i + 1
    }
  }
  return 0
}
