import { AudioEngine } from '../audio/engine.ts'
import { SoundBank, sourceKey } from '../audio/soundBank.ts'
import { BUILTIN_SOUNDS } from '../audio/synth/library.ts'
import { boardReducer, MAX_LABEL_LENGTH, referencedFiles, type BoardAction } from '../state/board.ts'
import { pruneFiles } from '../state/fileStore.ts'
import { isTypingTarget, STOP_ALL_KEY } from '../state/keys.ts'
import { browserStorage, loadBoard, saveBoard } from '../state/persistence.ts'
import { createStore, type Store } from '../state/store.ts'
import type { BoardState, PadColor, PadConfig, Settings, SoundSource } from '../state/types.ts'
import { BANK_COUNT, BANK_LETTERS, PAD_COLORS, PAD_COUNT, padName, PADS_PER_BANK, padSlot } from '../state/types.ts'

/** Pseudo pad used for auditioning sounds in the editor. */
export const PREVIEW_PAD = -1

export interface DisplayMessage {
  title: string
  detail?: string
}

export interface DisplayState {
  /** Pad shown on the LCD (last played / selected). */
  pad: number
  /** Temporary message (knob turned, error, …), or null. */
  message: DisplayMessage | null
}

export type ImportResult = { pad: number; ok: true; label: string } | { pad: number; ok: false; error: string }

/** "my_cool-sound.mp3" → "MY COOL SOUND" */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (base || 'SOUND').toUpperCase().slice(0, MAX_LABEL_LENGTH)
}

const FRESH_COLORS: readonly PadColor[] = PAD_COLORS.filter((c) => c !== 'white')

/**
 * The soundboard "brain": owns the board state, the audio engine and the
 * sound bank, and turns pad presses into sound according to each pad's mode.
 * UI components read from it through the hooks in `hooks.ts`.
 */
export class Soundboard {
  readonly store: Store<BoardState, BoardAction>
  readonly engine: AudioEngine
  readonly sounds: SoundBank

  private readonly pressCounts = new Map<number, number>()
  private readonly pressListeners = new Set<() => void>()
  private readonly heldKeys = new Map<string, number>()
  private keyMap: Map<string, number> | null = null
  private display: DisplayState
  private readonly displayListeners = new Set<() => void>()
  private messageTimer: ReturnType<typeof setTimeout> | undefined
  /** Files saved but not yet referenced by a pad: never prune these. */
  private readonly pendingFiles = new Set<string>()
  private pruneTimer: ReturnType<typeof setTimeout> | undefined
  /** When true (a dialog is open), keyboard shortcuts are ignored. */
  private keyboardLocked = false

  constructor() {
    const storage = browserStorage()
    this.store = createStore(boardReducer, loadBoard(storage))
    this.engine = new AudioEngine()
    this.sounds = new SoundBank(this.engine.context)
    this.display = { pad: this.state.bank * PADS_PER_BANK, message: null }

    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let previous = this.state
    this.store.subscribe(() => {
      const next = this.state
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => saveBoard(storage, this.state), 250)
      if (next.pads !== previous.pads) {
        this.keyMap = null
        this.schedulePrune()
      }
      if (next.settings !== previous.settings) this.applySettings(next.settings, previous.settings)
      previous = next
    })
    this.applySettings(this.state.settings)
    this.loadSounds()
    this.schedulePrune()
  }

  get state(): BoardState {
    return this.store.getState()
  }

  dispatch = (action: BoardAction): void => {
    this.store.dispatch(action)
  }

  // ---------------------------------------------------------------- sounds

  private loadSounds(): void {
    const { pads, bank } = this.state
    // Visible bank first, then the rest of the board, then the remaining library (for previews).
    const ordered = [...pads.slice(bank * PADS_PER_BANK, (bank + 1) * PADS_PER_BANK), ...pads]
    const ids = new Set<string>()
    for (const pad of ordered) {
      if (pad.source?.kind === 'builtin') ids.add(pad.source.id)
      else if (pad.source?.kind === 'file') void this.sounds.loadFile(pad.source.fileId)
    }
    for (const sound of BUILTIN_SOUNDS) ids.add(sound.id)
    this.sounds.renderBuiltins([...ids])
  }

  private applySettings(next: Settings, prev?: Settings): void {
    if (prev?.masterVolume !== next.masterVolume) this.engine.setMasterVolume(next.masterVolume)
    if (prev?.pitch !== next.pitch) this.engine.setPitch(next.pitch)
    if (prev?.echo !== next.echo) this.engine.setEcho(next.echo)
    if (prev?.limiter !== next.limiter) this.engine.setLimiter(next.limiter)
    if ((prev?.outputDeviceId ?? '') !== next.outputDeviceId) {
      void this.engine.setOutputDevice(next.outputDeviceId).then((ok) => {
        if (!ok && next.outputDeviceId) this.flash('OUTPUT UNAVAILABLE', 'Playing through the default device')
      })
    }
  }

  private schedulePrune(): void {
    clearTimeout(this.pruneTimer)
    this.pruneTimer = setTimeout(() => {
      const keep = referencedFiles(this.state)
      for (const id of this.pendingFiles) keep.add(id)
      void pruneFiles(keep).catch(() => undefined)
    }, 3000)
  }

  /**
   * Imports audio files onto pads: the first file goes to `pad`, the rest
   * fill the following empty pads.
   */
  async importFiles(files: readonly File[], pad: number): Promise<ImportResult[]> {
    const targets = [pad]
    for (let step = 1; step < PAD_COUNT && targets.length < files.length; step++) {
      const candidate = (pad + step) % PAD_COUNT
      if (!this.state.pads[candidate].source) targets.push(candidate)
    }
    const results: ImportResult[] = []
    for (let i = 0; i < files.length && i < targets.length; i++) {
      const target = targets[i]
      const file = files[i]
      this.flash('LOADING…', file.name)
      try {
        const { fileId, name } = await this.sounds.importFile(file)
        this.pendingFiles.add(fileId)
        const wasEmpty = !this.state.pads[target].source
        const label = labelFromFileName(name)
        this.engine.stopPad(target, 0.05)
        this.dispatch({
          type: 'update-pad',
          pad: target,
          patch: {
            source: { kind: 'file', fileId, name },
            label,
            autoLevel: true,
            ...(wasEmpty ? { color: FRESH_COLORS[padSlot(target) % FRESH_COLORS.length], mode: 'oneshot' as const } : {}),
          },
        })
        this.pendingFiles.delete(fileId)
        results.push({ pad: target, ok: true, label })
      } catch (error) {
        results.push({ pad: target, ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
    const loaded = results.filter((r) => r.ok)
    const failed = results.find((r): r is Extract<ImportResult, { ok: false }> => !r.ok)
    const skipped = files.length - targets.length
    if (failed) this.flash('LOAD FAILED', failed.error, 4000)
    else if (skipped > 0) this.flash('BOARD FULL', `Loaded ${loaded.length}, no empty pad for ${skipped} more`, 4000)
    else if (loaded.length === 1) this.flash('LOADED', `${padName(loaded[0].pad)} · ${loaded[0].label}`)
    else if (loaded.length > 1) this.flash('LOADED', `${loaded.length} sounds`)
    if (loaded.length > 0) this.focus(loaded[0].pad)
    return results
  }

  /** Saves a file to the library without assigning it (used by the pad editor's draft). */
  async importDraftFile(file: File): Promise<{ source: SoundSource; label: string; duration: number }> {
    const { fileId, name, duration } = await this.sounds.importFile(file)
    this.pendingFiles.add(fileId)
    // The draft may be cancelled; give the user a while before the file becomes prunable.
    setTimeout(() => {
      this.pendingFiles.delete(fileId)
      this.schedulePrune()
    }, 10 * 60_000)
    return { source: { kind: 'file', fileId, name }, label: labelFromFileName(name), duration }
  }

  // ---------------------------------------------------------------- playing

  /** Gain for a pad's sound: pad volume × loudness levelling for custom files. */
  private gainFor(config: Pick<PadConfig, 'volume' | 'autoLevel'>, source: SoundSource, levelGain: number): number {
    return config.volume * (source.kind === 'file' && config.autoLevel ? levelGain : 1)
  }

  press(pad: number): void {
    this.engine.resume()
    this.changePressed(pad, 1)
    this.focus(pad)
    const config = this.state.pads[pad]
    if (!config?.source) {
      this.flash('EMPTY PAD', `${padName(pad)} · drop an audio file on it`)
      return
    }
    const sound = this.sounds.get(config.source)
    if (!sound) {
      const key = sourceKey(config.source)
      const status = this.sounds.status(key)
      if (status === 'error') this.flash('SOUND ERROR', this.sounds.errorMessage(key), 3500)
      else this.flash('LOADING…', config.label || padName(pad))
      if (config.source.kind === 'file' && status === 'idle') void this.sounds.loadFile(config.source.fileId)
      return
    }
    if (this.state.settings.solo) this.engine.stopOthers(pad)
    const play = (loop: boolean) =>
      this.engine.play({
        pad,
        buffer: sound.buffer,
        gain: this.gainFor(config, config.source!, sound.levelGain),
        loop,
        offset: sound.offset,
      })
    switch (config.mode) {
      case 'oneshot':
        this.engine.stopPad(pad, 0.012)
        play(false)
        break
      case 'overlap':
        play(false)
        break
      case 'hold':
        this.engine.stopPad(pad, 0.012)
        play(true)
        break
      case 'toggle':
      case 'loop':
        if (this.engine.isPlaying(pad)) this.engine.stopPad(pad, 0.05)
        else play(config.mode === 'loop')
        break
    }
  }

  release(pad: number): void {
    this.changePressed(pad, -1)
    if (this.state.pads[pad]?.mode === 'hold' && !this.isPressed(pad)) this.engine.stopPad(pad, 0.04)
  }

  stopAll(): void {
    this.engine.resume()
    this.engine.stopAll()
    this.flash('STOP ALL', 'Every sound cut')
  }

  /** Plays a sound in the editor without touching any pad. */
  preview(source: SoundSource, config: Pick<PadConfig, 'volume' | 'autoLevel'>): boolean {
    this.engine.resume()
    this.engine.stopPad(PREVIEW_PAD, 0.02)
    const sound = this.sounds.get(source)
    if (!sound) return false
    this.engine.play({
      pad: PREVIEW_PAD,
      buffer: sound.buffer,
      gain: this.gainFor(config, source, sound.levelGain),
      loop: false,
      offset: sound.offset,
    })
    return true
  }

  stopPreview(): void {
    this.engine.stopPad(PREVIEW_PAD, 0.05)
  }

  // ---------------------------------------------------------------- pressed state

  private changePressed(pad: number, delta: number): void {
    const count = Math.max(0, (this.pressCounts.get(pad) ?? 0) + delta)
    if (count === 0) this.pressCounts.delete(pad)
    else this.pressCounts.set(pad, count)
    for (const listener of [...this.pressListeners]) listener()
  }

  isPressed(pad: number): boolean {
    return (this.pressCounts.get(pad) ?? 0) > 0
  }

  subscribePressed = (listener: () => void): (() => void) => {
    this.pressListeners.add(listener)
    return () => {
      this.pressListeners.delete(listener)
    }
  }

  // ---------------------------------------------------------------- keyboard

  /** Pauses shortcuts (e.g. while a dialog is open and the user is typing). */
  setKeyboardLocked(locked: boolean): void {
    this.keyboardLocked = locked
    if (locked) this.releaseAllKeys()
  }

  padForKey(code: string): number {
    if (!this.keyMap) {
      this.keyMap = new Map()
      this.state.pads.forEach((pad, index) => {
        if (pad.key) this.keyMap!.set(pad.key, index)
      })
    }
    return this.keyMap.get(code) ?? -1
  }

  handleKeyDown = (event: KeyboardEvent): void => {
    if (this.keyboardLocked || event.defaultPrevented) return
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return
    if (event.code === STOP_ALL_KEY) {
      event.preventDefault()
      this.stopAll()
      return
    }
    const pad = this.padForKey(event.code)
    if (pad < 0) {
      if (event.code === 'PageUp' || event.code === 'PageDown') {
        event.preventDefault()
        this.stepBank(event.code === 'PageUp' ? -1 : 1)
      }
      return
    }
    event.preventDefault()
    if (event.repeat || this.heldKeys.has(event.code)) return
    this.heldKeys.set(event.code, pad)
    this.press(pad)
  }

  handleKeyUp = (event: KeyboardEvent): void => {
    const pad = this.heldKeys.get(event.code)
    if (pad === undefined) return
    this.heldKeys.delete(event.code)
    this.release(pad)
  }

  /** Window lost focus: key-up events will never arrive, so let go of everything. */
  releaseAllKeys = (): void => {
    const pads = [...this.heldKeys.values()]
    this.heldKeys.clear()
    for (const pad of pads) this.release(pad)
  }

  // ---------------------------------------------------------------- banks

  selectBank(bank: number): void {
    this.dispatch({ type: 'select-bank', bank })
    this.focus(bank * PADS_PER_BANK)
    const pads = this.state.pads.slice(bank * PADS_PER_BANK, (bank + 1) * PADS_PER_BANK)
    const loaded = pads.filter((pad) => pad.source).length
    const name = this.state.bankNames[bank]
    const label = name === `BANK ${BANK_LETTERS[bank]}` ? '' : `${name} · `
    this.flash(`BANK ${BANK_LETTERS[bank]}`, loaded ? `${label}${loaded}/16 PADS LOADED` : `${label}EMPTY · DROP AUDIO ON A PAD`)
  }

  stepBank(delta: number): void {
    this.selectBank((this.state.bank + delta + BANK_COUNT) % BANK_COUNT)
  }

  /** Whether any pad in the bank is currently sounding (for the bank LEDs). */
  bankActive(bank: number): boolean {
    for (let slot = 0; slot < PADS_PER_BANK; slot++) if (this.engine.isPlaying(bank * PADS_PER_BANK + slot)) return true
    return false
  }

  // ---------------------------------------------------------------- display

  getDisplay = (): DisplayState => this.display

  subscribeDisplay = (listener: () => void): (() => void) => {
    this.displayListeners.add(listener)
    return () => {
      this.displayListeners.delete(listener)
    }
  }

  private setDisplay(next: DisplayState): void {
    this.display = next
    for (const listener of [...this.displayListeners]) listener()
  }

  focus(pad: number): void {
    if (pad !== this.display.pad && pad >= 0) this.setDisplay({ ...this.display, pad })
  }

  /** Shows a temporary message on the LCD. */
  flash(title: string, detail?: string, ms = 1600): void {
    clearTimeout(this.messageTimer)
    this.setDisplay({ ...this.display, message: { title, detail } })
    this.messageTimer = setTimeout(() => this.setDisplay({ ...this.display, message: null }), ms)
  }
}
