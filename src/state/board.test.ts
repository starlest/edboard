import { describe, expect, it } from 'vitest'
import { getBuiltin } from '../audio/synth/library.ts'
import { labelFromFileName } from '../app/soundboard.ts'
import { boardReducer, referencedFiles, sanitizeBoard } from './board.ts'
import { BANK_A_KEYS, BANK_B_KEYS, defaultBoard } from './defaults.ts'
import { isBindable, keyLabel } from './keys.ts'
import { loadBoard, saveBoard, STORAGE_KEY } from './persistence.ts'
import { PAD_COUNT, padName } from './types.ts'

describe('default board', () => {
  const board = defaultBoard()

  it('has 4 banks of 16 pads with FAH! on the first pad', () => {
    expect(board.pads).toHaveLength(PAD_COUNT)
    expect(board.pads[0]).toMatchObject({ label: 'FAH!', key: 'Digit1', source: { kind: 'builtin', id: 'fah' } })
    expect(board.bank).toBe(0)
  })

  it('fills banks A and B with valid built-in sounds and leaves C and D empty', () => {
    for (let pad = 0; pad < 32; pad++) {
      const source = board.pads[pad].source
      expect(source?.kind).toBe('builtin')
      if (source?.kind === 'builtin') expect(getBuiltin(source.id), source.id).toBeDefined()
    }
    for (let pad = 32; pad < PAD_COUNT; pad++) expect(board.pads[pad].source).toBeNull()
  })

  it('maps the keyboard like the pad grid, with no duplicate shortcuts', () => {
    expect(board.pads.slice(0, 16).map((p) => p.key)).toEqual([...BANK_A_KEYS])
    expect(board.pads.slice(16, 32).map((p) => p.key)).toEqual([...BANK_B_KEYS])
    const keys = board.pads.map((p) => p.key).filter(Boolean)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses hold mode for the censor bleep', () => {
    expect(board.pads[15]).toMatchObject({ label: 'BLEEP', mode: 'hold' })
  })
})

describe('boardReducer', () => {
  const board = defaultBoard()

  it('moves a shortcut to its new pad, taking it from the old one', () => {
    const next = boardReducer(board, { type: 'update-pad', pad: 0, patch: { key: 'KeyW' } })
    expect(next.pads[0].key).toBe('KeyW')
    expect(next.pads[5].key).toBeNull() // BRUH lost W
    expect(board.pads[5].key).toBe('KeyW') // original untouched (immutable)
  })

  it('rejects unbindable keys and clamps values', () => {
    const next = boardReducer(board, { type: 'update-pad', pad: 0, patch: { key: 'Escape', volume: 9 } })
    expect(next.pads[0].key).toBe('Digit1')
    expect(next.pads[0].volume).toBe(1.5)
  })

  it('swaps pad contents but keeps shortcuts on their physical positions', () => {
    const next = boardReducer(board, { type: 'swap-pads', a: 0, b: 1 })
    expect(next.pads[0]).toMatchObject({ label: 'AIR HORN', key: 'Digit1' })
    expect(next.pads[1]).toMatchObject({ label: 'FAH!', key: 'Digit2' })
  })

  it('clears and resets pads without losing their shortcut', () => {
    const custom = boardReducer(board, { type: 'update-pad', pad: 0, patch: { key: 'KeyP', label: 'MINE' } })
    const cleared = boardReducer(custom, { type: 'clear-pad', pad: 0 })
    expect(cleared.pads[0]).toMatchObject({ source: null, label: '', key: 'KeyP' })
    const reset = boardReducer(cleared, { type: 'reset-pad', pad: 0 })
    expect(reset.pads[0]).toMatchObject({ label: 'FAH!', key: 'KeyP' })
  })

  it('ignores out-of-range banks and pads', () => {
    expect(boardReducer(board, { type: 'select-bank', bank: 7 })).toBe(board)
    expect(boardReducer(board, { type: 'select-bank', bank: 0 })).toBe(board)
    expect(boardReducer(board, { type: 'update-pad', pad: 99, patch: { label: 'X' } })).toBe(board)
    expect(boardReducer(board, { type: 'select-bank', bank: 2 }).bank).toBe(2)
  })

  it('cleans bank names and clamps settings', () => {
    const renamed = boardReducer(board, { type: 'rename-bank', bank: 2, name: '  my clips and more  ' })
    expect(renamed.bankNames[2]).toBe('MY CLIPS AND')
    expect(boardReducer(board, { type: 'rename-bank', bank: 2, name: '   ' }).bankNames[2]).toBe('BANK C')
    const settings = boardReducer(board, { type: 'update-settings', patch: { masterVolume: 3, pitch: 40.4, echo: -1 } }).settings
    expect(settings).toMatchObject({ masterVolume: 1, pitch: 12, echo: 0 })
  })

  it('lists custom files referenced by pads', () => {
    const next = boardReducer(board, {
      type: 'update-pad',
      pad: 40,
      patch: { source: { kind: 'file', fileId: 'abc', name: 'laugh.mp3' } },
    })
    expect([...referencedFiles(next)]).toEqual(['abc'])
  })
})

describe('sanitizeBoard', () => {
  it('falls back to the factory board for garbage', () => {
    expect(sanitizeBoard(null)).toEqual(defaultBoard())
    expect(sanitizeBoard('nope')).toEqual(defaultBoard())
    expect(sanitizeBoard({ pads: 'x', settings: 5 })).toEqual(defaultBoard())
  })

  it('keeps valid data and repairs the rest', () => {
    const raw = {
      bank: 1,
      bankNames: ['FUNNY', 42],
      pads: [
        { label: 'MINE', color: 'neon', key: 'KeyQ', volume: 'loud', mode: 'loop', source: { kind: 'builtin', id: 'gone' } },
        { key: 'KeyQ' },
      ],
      settings: { masterVolume: 0.5, solo: 'yes' },
    }
    const board = sanitizeBoard(raw)
    expect(board.bank).toBe(1)
    expect(board.bankNames.slice(0, 2)).toEqual(['FUNNY', 'SFX'])
    expect(board.pads[0]).toMatchObject({ label: 'MINE', color: 'red', key: 'KeyQ', volume: 1, mode: 'loop', source: null })
    expect(board.pads[1].key).toBeNull() // duplicate shortcut dropped
    expect(board.pads[4].key).toBeNull() // factory KeyQ (A05) already taken by pad 0
    expect(board.settings).toMatchObject({ masterVolume: 0.5, solo: false })
  })
})

describe('persistence', () => {
  it('round-trips through storage and survives corrupt or failing storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const board = boardReducer(defaultBoard(), { type: 'update-pad', pad: 3, patch: { label: 'SAD' } })
    expect(saveBoard(storage, board)).toBe(true)
    expect(loadBoard(storage).pads[3].label).toBe('SAD')

    store.set(STORAGE_KEY, '{not json')
    expect(loadBoard(storage)).toEqual(defaultBoard())
    expect(loadBoard(null)).toEqual(defaultBoard())
    const failing = {
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(saveBoard(failing, board)).toBe(false)
  })
})

describe('keys and labels', () => {
  it('labels physical keys like keycaps', () => {
    expect(keyLabel('KeyQ')).toBe('Q')
    expect(keyLabel('Digit7')).toBe('7')
    expect(keyLabel('Numpad3')).toBe('NUM3')
    expect(keyLabel('Comma')).toBe(',')
    expect(keyLabel('F13')).toBe('F13')
    expect(keyLabel('Space')).toBe('SPACE')
  })

  it('keeps Escape, Tab and modifiers out of reach', () => {
    expect(isBindable('KeyA')).toBe(true)
    expect(isBindable('Escape')).toBe(false)
    expect(isBindable('Tab')).toBe(false)
    expect(isBindable('ShiftLeft')).toBe(false)
  })

  it('names pads like hardware', () => {
    expect(padName(0)).toBe('A01')
    expect(padName(17)).toBe('B02')
    expect(padName(63)).toBe('D16')
  })

  it('turns file names into pad labels', () => {
    expect(labelFromFileName('my_cool-sound.mp3')).toBe('MY COOL SOUND')
    expect(labelFromFileName('.wav')).toBe('SOUND')
    expect(labelFromFileName('a'.repeat(40) + '.ogg')).toHaveLength(24)
  })
})
