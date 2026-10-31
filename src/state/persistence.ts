import { sanitizeBoard } from './board.ts'
import { defaultBoard } from './defaults.ts'
import type { BoardState } from './types.ts'

export const STORAGE_KEY = 'edboard:board:v1'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/** The browser's localStorage, or null where it is unavailable (privacy modes, sandboxed frames). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadBoard(storage: ReadableStorage | null): BoardState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (raw) return sanitizeBoard(JSON.parse(raw))
  } catch {
    // Corrupt or inaccessible storage: fall back to the factory board.
  }
  return defaultBoard()
}

export function saveBoard(storage: WritableStorage | null, state: BoardState): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
