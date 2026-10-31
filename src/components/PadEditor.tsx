import { useRef, useState, type KeyboardEvent } from 'react'
import { useBoard, usePad, useSoundboard, useSoundStatus } from '../app/hooks.ts'
import { hasPackSound } from '../audio/soundPack.ts'
import { BUILTIN_SOUNDS, getBuiltin } from '../audio/synth/library.ts'
import type { SoundCategory } from '../audio/synth/types.ts'
import { MAX_LABEL_LENGTH, MAX_PAD_VOLUME } from '../state/board.ts'
import { defaultPad } from '../state/defaults.ts'
import { isBindable, keyLabel } from '../state/keys.ts'
import { PAD_COLORS, padName, PLAY_MODES, type PadConfig, type PlayMode, type SoundSource } from '../state/types.ts'
import { Dialog } from './Dialog.tsx'

const CATEGORY_NAMES: Record<SoundCategory, string> = {
  voice: 'Voices',
  meme: 'Meme classics',
  stage: 'Stage & game show',
  sfx: 'Sound effects',
  retro: 'Retro 8-bit',
}

const MODE_INFO: Record<PlayMode, { name: string; description: string }> = {
  oneshot: { name: 'One-shot', description: 'Plays to the end. Press again to restart.' },
  overlap: { name: 'Overlap', description: 'Every press layers another copy.' },
  hold: { name: 'Hold', description: 'Plays (looping) only while held down.' },
  toggle: { name: 'Toggle', description: 'Press to start, press again to stop.' },
  loop: { name: 'Loop', description: 'Loops until you press it again.' },
}

function sourceName(source: SoundSource | null): string {
  if (!source) return ''
  if (source.kind === 'builtin') return getBuiltin(source.id)?.name ?? ''
  return source.name
}

interface KeyCaptureProps {
  value: string | null
  onChange(code: string | null): void
}

function KeyCapture({ value, onChange }: KeyCaptureProps) {
  const [capturing, setCapturing] = useState(false)
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return
    event.preventDefault()
    event.stopPropagation()
    if (event.code === 'Escape') setCapturing(false)
    else if (event.code === 'Backspace' || event.code === 'Delete') {
      onChange(null)
      setCapturing(false)
    } else if (isBindable(event.code)) {
      onChange(event.code)
      setCapturing(false)
    }
  }
  return (
    <button
      type="button"
      className={`keycap-input${capturing ? ' is-capturing' : ''}`}
      aria-label={capturing ? 'Press the key to use, Backspace to clear, Escape to cancel' : `Shortcut: ${value ? keyLabel(value) : 'none'}. Click to change.`}
      onClick={() => setCapturing(true)}
      onKeyDown={onKeyDown}
      onBlur={() => setCapturing(false)}
    >
      {capturing ? 'Press a key…' : value ? keyLabel(value) : 'None'}
    </button>
  )
}

interface PadEditorProps {
  pad: number
  onClose(): void
}

export function PadEditor({ pad, onClose }: PadEditorProps) {
  const soundboard = useSoundboard()
  const original = usePad(pad)
  const pads = useBoard((state) => state.pads)
  const [draft, setDraft] = useState<PadConfig>(original)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const status = useSoundStatus(draft.source)
  const factory = defaultPad(pad)

  const update = (patch: Partial<PadConfig>) => setDraft((current) => ({ ...current, ...patch }))

  /** The label follows the chosen sound's name, unless the user typed their own. */
  const labelFor = (nextName: string) => {
    const following = !draft.label || draft.label.toUpperCase() === sourceName(draft.source).toUpperCase()
    return following ? nextName.toUpperCase().slice(0, MAX_LABEL_LENGTH) : draft.label
  }

  const chooseSound = (value: string) => {
    setError(null)
    if (value === '') {
      update({ source: null })
    } else if (value.startsWith('builtin:')) {
      const sound = getBuiltin(value.slice('builtin:'.length))
      if (sound) update({ source: { kind: 'builtin', id: sound.id }, label: labelFor(sound.name) })
    }
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const imported = await soundboard.importDraftFile(file)
      update({ source: imported.source, label: labelFor(imported.label), autoLevel: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const save = () => {
    const changedSound = JSON.stringify(draft.source) !== JSON.stringify(original.source) || draft.mode !== original.mode
    if (changedSound) soundboard.engine.stopPad(pad, 0.05)
    soundboard.stopPreview()
    soundboard.dispatch({ type: 'update-pad', pad, patch: draft })
    soundboard.focus(pad)
    soundboard.flash('SAVED', `${padName(pad)} · ${draft.label || (draft.source ? sourceName(draft.source) : 'EMPTY')}`)
    onClose()
  }

  const close = () => {
    soundboard.stopPreview()
    onClose()
  }

  const conflict = draft.key ? pads.findIndex((p, i) => i !== pad && p.key === draft.key) : -1
  const selectValue = draft.source?.kind === 'builtin' ? `builtin:${draft.source.id}` : draft.source?.kind === 'file' ? 'file' : ''
  const categories = (Object.keys(CATEGORY_NAMES) as SoundCategory[]).map((category) => ({
    category,
    sounds: BUILTIN_SOUNDS.filter((sound) => sound.category === category),
  }))

  return (
    <Dialog
      className={`c-${draft.color}`}
      dismissOnBackdrop={false}
      title={
        <>
          <span className="dot" aria-hidden="true" />
          Pad {padName(pad)}
        </>
      }
      onClose={close}
      footer={
        <>
          {factory.source && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDraft({ ...factory, key: draft.key })}
              title="Restore this pad's factory sound, name, colour and mode"
            >
              Factory sound
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => setDraft({ ...draft, source: null, label: '' })}>
            Clear pad
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={importing}>
            Save
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="pad-name">
          Name
        </label>
        <input
          id="pad-name"
          className="input input--name"
          value={draft.label}
          maxLength={MAX_LABEL_LENGTH}
          placeholder={sourceName(draft.source) || 'Pad name'}
          onChange={(event) => update({ label: event.target.value.toUpperCase() })}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pad-sound">
          Sound
        </label>
        <div className="field__row">
          <select id="pad-sound" className="select" value={selectValue} onChange={(event) => chooseSound(event.target.value)}>
            <option value="">— No sound —</option>
            {draft.source?.kind === 'file' && (
              <optgroup label="Your file">
                <option value="file">{draft.source.name || 'Custom audio'}</option>
              </optgroup>
            )}
            {categories.map(({ category, sounds }) => (
              <optgroup key={category} label={CATEGORY_NAMES[category]}>
                {sounds.map((sound) => (
                  <option key={sound.id} value={`builtin:${sound.id}`}>
                    {sound.name} — {hasPackSound(sound.id) ? `your sound-pack file (sounds/${sound.id})` : sound.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={!draft.source || status !== 'ready'}
            onClick={() => draft.source && soundboard.preview(draft.source, draft)}
            title="Preview"
          >
            ▶ Preview
          </button>
        </div>
        <div className="field__row">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={importing}>
            {importing ? 'Loading…' : 'Load audio file…'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm"
            hidden
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          <p className="field__hint">MP3, WAV, OGG, M4A, FLAC… or drop a file straight onto the pad.</p>
        </div>
        {error && <p className="field__error">{error}</p>}
        {draft.source?.kind === 'file' && (
          <label className="check">
            <input type="checkbox" checked={draft.autoLevel} onChange={(event) => update({ autoLevel: event.target.checked })} />
            <span>Auto-level loudness (so quiet and loud clips sit at the same volume)</span>
          </label>
        )}
      </div>

      <div className="field-grid">
        <div className="field">
          <span className="field__label">Shortcut key</span>
          <div className="field__row">
            <KeyCapture value={draft.key} onChange={(key) => update({ key })} />
            {draft.key && (
              <button type="button" className="btn btn--ghost" onClick={() => update({ key: null })}>
                Remove
              </button>
            )}
          </div>
          <p className="field__hint">
            {conflict >= 0
              ? `Currently on ${padName(conflict)} ${pads[conflict].label ? `(${pads[conflict].label})` : ''} — saving moves it here.`
              : 'Click, then press any key. Works while this window is focused.'}
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pad-volume">
            Volume <span className="pill">{Math.round(draft.volume * 100)}%</span>
          </label>
          <div className="field__row">
            <input
              id="pad-volume"
              className="range"
              type="range"
              min={0}
              max={MAX_PAD_VOLUME * 100}
              step={1}
              value={Math.round(draft.volume * 100)}
              onChange={(event) => update({ volume: Number(event.target.value) / 100 })}
            />
          </div>
        </div>
      </div>

      <div className="field">
        <span className="field__label" id="pad-color-label">
          Pad colour
        </span>
        <div className="swatches" role="radiogroup" aria-labelledby="pad-color-label">
          {PAD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={draft.color === color}
              aria-label={color}
              className={`swatch c-${color}`}
              onClick={() => update({ color })}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label" id="pad-mode-label">
          Play mode
        </span>
        <div className="modes" role="radiogroup" aria-labelledby="pad-mode-label">
          {PLAY_MODES.map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={draft.mode === mode} className="mode" onClick={() => update({ mode })}>
              <strong>{MODE_INFO[mode].name}</strong>
              <span>{MODE_INFO[mode].description}</span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
