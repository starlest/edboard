export const TAU = Math.PI * 2

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)

export const dbToGain = (db: number): number => Math.pow(10, db / 20)

const LN2_OVER_12 = Math.LN2 / 12

/** Frequency ratio for a pitch offset in semitones. */
export const semis = (semitones: number): number => Math.exp(semitones * LN2_OVER_12)

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export const smoothstep = (x: number): number => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Converts a note name such as `A4`, `C#5` or `Bb3` to a frequency in Hz. */
export function note(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!match) throw new Error(`Invalid note name: ${name}`)
  const [, letter, accidental, octave] = match
  const offset = NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  return midiToFreq(12 * (Number(octave) + 1) + offset)
}
