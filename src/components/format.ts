/** `83.25` → `1:23.3` */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${(safe - minutes * 60).toFixed(1).padStart(4, '0')}`
}

/** `3` → `+3`, `0` → `±0` */
export function formatPitch(semitones: number): string {
  return semitones === 0 ? '±0' : `${semitones > 0 ? '+' : ''}${semitones}`
}
