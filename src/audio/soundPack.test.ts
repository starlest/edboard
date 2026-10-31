import { describe, expect, it } from 'vitest'
import { buildSoundPack, packIdFromPath } from './soundPack.ts'

describe('sound pack', () => {
  it('derives the sound id from the file name', () => {
    expect(packIdFromPath('/sounds/fah.mp3')).toBe('fah')
    expect(packIdFromPath('/sounds/Air_Horn.MP3')).toBe('air-horn')
    expect(packIdFromPath('/sounds/vine boom.wav')).toBe('vine-boom')
  })

  it('maps files onto built-in sounds and reports the ones that match nothing', () => {
    const known = new Set(['fah', 'laugh'])
    const pack = buildSoundPack(
      {
        '/sounds/fah.mp3': '/assets/fah-123.mp3',
        '/sounds/fah.wav': '/assets/fah-456.wav',
        '/sounds/laugh.ogg': '/assets/laugh-789.ogg',
        '/sounds/random.mp3': '/assets/random.mp3',
      },
      (id) => known.has(id),
    )
    expect([...pack.sounds]).toEqual([
      ['fah', '/assets/fah-123.mp3'],
      ['laugh', '/assets/laugh-789.ogg'],
    ])
    expect(pack.unknown).toEqual(['/sounds/random.mp3'])
  })

  it('is empty when the folder has no audio', () => {
    expect(buildSoundPack({}, () => true).sounds.size).toBe(0)
  })
})
