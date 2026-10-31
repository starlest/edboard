const cache = new WeakMap<AudioBuffer, Map<string, Float32Array>>()

/**
 * Peak amplitude per display column (all channels), normalised so the
 * loudest column is 1. Cached per buffer.
 */
export function waveformPeaks(buffer: AudioBuffer, columns: number, offsetSeconds = 0): Float32Array {
  const key = `${columns}:${offsetSeconds.toFixed(4)}`
  let byKey = cache.get(buffer)
  if (!byKey) {
    byKey = new Map()
    cache.set(buffer, byKey)
  }
  const hit = byKey.get(key)
  if (hit) return hit

  const peaks = new Float32Array(Math.max(0, columns))
  const start = Math.min(buffer.length, Math.floor(offsetSeconds * buffer.sampleRate))
  const length = buffer.length - start
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch))
  let loudest = 0
  for (let c = 0; c < columns; c++) {
    const from = start + Math.floor((c * length) / columns)
    const to = start + Math.floor(((c + 1) * length) / columns)
    // Long files: sample a few hundred points per column rather than every sample.
    const stride = Math.max(1, Math.floor((to - from) / 400))
    let max = 0
    for (const data of channels) {
      for (let i = from; i < to; i += stride) {
        const v = Math.abs(data[i])
        if (v > max) max = v
      }
    }
    peaks[c] = max
    if (max > loudest) loudest = max
  }
  if (loudest > 0) for (let c = 0; c < columns; c++) peaks[c] /= loudest
  byKey.set(key, peaks)
  return peaks
}
