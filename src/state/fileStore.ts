/**
 * Custom audio files live in IndexedDB (localStorage is far too small for
 * audio). Pads reference them by id.
 */

export interface StoredFile {
  id: string
  name: string
  type: string
  data: ArrayBuffer
  added: number
}

const DB_NAME = 'edboard'
const DB_VERSION = 1
const STORE = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser.'))
        return
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the sound library.'))
      request.onblocked = () => reject(new Error('The sound library is blocked by another Edboard tab.'))
    }).catch((error: unknown) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = work(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(request ? request.result : undefined)
        tx.onerror = () => reject(tx.error ?? new Error('Sound library transaction failed.'))
        tx.onabort = () => reject(tx.error ?? new Error('Sound library transaction was aborted.'))
      }),
  )
}

export function newFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function saveFile(file: File, data: ArrayBuffer): Promise<StoredFile> {
  const record: StoredFile = { id: newFileId(), name: file.name, type: file.type, data, added: Date.now() }
  await run('readwrite', (store) => store.put(record))
  return record
}

export async function loadStoredFile(id: string): Promise<StoredFile | undefined> {
  return run<StoredFile>('readonly', (store) => store.get(id) as IDBRequest<StoredFile>)
}

export async function deleteFiles(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await run('readwrite', (store) => {
    for (const id of ids) store.delete(id)
  })
}

export async function listFileIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  return (keys ?? []).map(String)
}

/** Deletes stored files that no pad references any more. */
export async function pruneFiles(referenced: ReadonlySet<string>): Promise<number> {
  const orphans = (await listFileIds()).filter((id) => !referenced.has(id))
  await deleteFiles(orphans)
  return orphans.length
}
