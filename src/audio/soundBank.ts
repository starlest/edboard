import { loadStoredFile, saveFile } from '../state/fileStore.ts'
import type { SoundSource } from '../state/types.ts'
import { BuiltinRenderer } from './builtinRenderer.ts'
import { findStart, levelGain, measureLoudness } from './dsp/loudness.ts'
import { dbToGain } from './dsp/math.ts'
import { DEFAULT_LOUDNESS, PEAK_CEILING, type RenderedSound } from './synth/render.ts'

export type SoundStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface LoadedSound {
  buffer: AudioBuffer
  /** Gain that levels the clip to the house loudness (built-ins are pre-levelled: 1). */
  levelGain: number
  /** Leading silence to skip, in seconds. */
  offset: number
}

interface Entry {
  status: SoundStatus
  sound?: LoadedSound
  error?: string
}

export const sourceKey = (source: SoundSource): string =>
  source.kind === 'builtin' ? `builtin:${source.id}` : `file:${source.fileId}`

/** Longest stretch of a custom file analysed for levelling (keeps huge files cheap). */
const MAX_ANALYSIS_SECONDS = 180

/** Holds decoded audio for every sound source, built-in or user-supplied. */
export class SoundBank {
  private readonly context: BaseAudioContext
  private readonly entries = new Map<string, Entry>()
  private readonly listeners = new Set<() => void>()
  private renderer: BuiltinRenderer | null = null

  constructor(context: BaseAudioContext) {
    this.context = context
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private set(key: string, entry: Entry): void {
    this.entries.set(key, entry)
    for (const listener of [...this.listeners]) listener()
  }

  status(key: string): SoundStatus {
    return this.entries.get(key)?.status ?? 'idle'
  }

  errorMessage(key: string): string | undefined {
    return this.entries.get(key)?.error
  }

  get(source: SoundSource): LoadedSound | undefined {
    return this.entries.get(sourceKey(source))?.sound
  }

  /** Renders the given built-in sounds in the background (first id first). */
  renderBuiltins(ids: readonly string[]): void {
    const pending = ids.filter((id) => this.status(`builtin:${id}`) === 'idle')
    if (pending.length === 0) return
    for (const id of pending) this.set(`builtin:${id}`, { status: 'loading' })
    this.renderer ??= new BuiltinRenderer(this.context.sampleRate, {
      onRendered: (sound) => this.set(`builtin:${sound.id}`, { status: 'ready', sound: this.wrapRendered(sound) }),
      onError: (id, error) => this.set(`builtin:${id}`, { status: 'error', error }),
    })
    this.renderer.enqueue(pending)
  }

  private wrapRendered(sound: RenderedSound): LoadedSound {
    const buffer = this.context.createBuffer(2, Math.max(1, sound.left.length), sound.sampleRate)
    buffer.copyToChannel(sound.left as Float32Array<ArrayBuffer>, 0)
    buffer.copyToChannel(sound.right as Float32Array<ArrayBuffer>, 1)
    return { buffer, levelGain: 1, offset: 0 }
  }

  /** Loads (and decodes) a custom file from the library, if not already loaded. */
  async loadFile(fileId: string): Promise<void> {
    const key = `file:${fileId}`
    if (this.status(key) === 'loading' || this.status(key) === 'ready') return
    this.set(key, { status: 'loading' })
    try {
      const stored = await loadStoredFile(fileId)
      if (!stored) throw new Error('The audio file is missing from this browser.')
      this.set(key, { status: 'ready', sound: this.analyse(await this.decode(stored.data)) })
    } catch (error) {
      this.set(key, { status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  /** Decodes, analyses and stores a user's audio file. Throws if it is not playable audio. */
  async importFile(file: File): Promise<{ fileId: string; name: string; duration: number }> {
    const data = await file.arrayBuffer()
    // Decode first so unsupported files are rejected before anything is stored.
    const buffer = await this.decode(data)
    const stored = await saveFile(file, data)
    this.set(`file:${stored.id}`, { status: 'ready', sound: this.analyse(buffer) })
    return { fileId: stored.id, name: file.name, duration: buffer.duration }
  }

  private async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    try {
      // decodeAudioData detaches its input, so hand it a copy.
      return await this.context.decodeAudioData(data.slice(0))
    } catch {
      throw new Error("That file isn't audio this browser can play (try MP3, WAV, OGG or M4A).")
    }
  }

  private analyse(buffer: AudioBuffer): LoadedSound {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch))
    const sr = buffer.sampleRate
    const start = Math.min(findStart(channels, -60), buffer.length)
    const end = Math.min(buffer.length, start + MAX_ANALYSIS_SECONDS * sr)
    const stats = measureLoudness(channels, sr, start, end)
    return {
      buffer,
      levelGain: levelGain(stats, { targetLufs: DEFAULT_LOUDNESS, ceiling: PEAK_CEILING, maxGain: dbToGain(18) }),
      offset: Math.max(0, start - Math.round(0.005 * sr)) / sr,
    }
  }

  dispose(): void {
    this.renderer?.dispose()
    this.renderer = null
  }
}
