/**
 * Sound pack: audio files in the project's `sounds/` folder that are named
 * after a built-in sound (e.g. `sounds/fah.mp3`, `sounds/air-horn.wav`)
 * replace that built-in sound for everyone who opens this deployment.
 *
 * Files are discovered at build time, so adding one is just: drop it in
 * `sounds/`, commit, deploy.
 */
import { getBuiltin } from './synth/library.ts'

const files = import.meta.glob<string>(
  '/sounds/*.{mp3,MP3,wav,WAV,ogg,OGG,oga,opus,m4a,M4A,aac,flac,FLAC,webm}',
  { eager: true, query: '?url', import: 'default' },
)

/** `sounds/Air_Horn.mp3` → `air-horn` */
export function packIdFromPath(path: string): string {
  const name = path.split('/').pop() ?? ''
  return name
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

export interface SoundPack {
  /** Built-in sound id → URL of the replacement audio file. */
  sounds: Map<string, string>
  /** Files whose names don't match any built-in sound. */
  unknown: string[]
}

export function buildSoundPack(found: Record<string, string>, isBuiltin: (id: string) => boolean): SoundPack {
  const sounds = new Map<string, string>()
  const unknown: string[] = []
  for (const path of Object.keys(found).sort()) {
    const id = packIdFromPath(path)
    if (!isBuiltin(id)) unknown.push(path)
    else if (!sounds.has(id)) sounds.set(id, found[path])
  }
  return { sounds, unknown }
}

const pack = buildSoundPack(files, (id) => getBuiltin(id) !== undefined)

if (pack.unknown.length > 0) {
  console.warn(
    `Edboard sound pack: ignoring ${pack.unknown.join(', ')} — name files after a built-in sound id, e.g. sounds/fah.mp3 (see sounds/README.md).`,
  )
}

export const SOUND_PACK: ReadonlyMap<string, string> = pack.sounds

/** Whether this deployment replaces the built-in sound with a file from `sounds/`. */
export const hasPackSound = (id: string): boolean => SOUND_PACK.has(id)
