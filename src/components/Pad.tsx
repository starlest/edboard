import { memo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react'
import { useBoard, useFrame, usePad, usePadLit, usePadPressed, useSoundboard, useSoundStatus } from '../app/hooks.ts'
import { keyLabel } from '../state/keys.ts'
import { padName, type PlayMode } from '../state/types.ts'
import './Pad.css'

export const PAD_DRAG_TYPE = 'application/x-edboard-pad'

const MODE_BADGE: Record<PlayMode, string | null> = {
  oneshot: null,
  overlap: 'POLY',
  hold: 'HOLD',
  toggle: 'TOGGLE',
  loop: 'LOOP',
}

/** Picks the biggest legend size at which the label's longest word still fits on the pad. */
function sizeClass(label: string): string {
  const longest = Math.max(...label.split(/[\s-]+/).map((word) => word.length))
  if (label.length <= 5) return 'pad--xl'
  if (longest <= 8 && label.length <= 10) return 'pad--lg'
  if (longest <= 10 && label.length <= 16) return 'pad--md'
  return 'pad--sm'
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')
const hasPad = (event: DragEvent) => event.dataTransfer.types.includes(PAD_DRAG_TYPE)

interface PadProps {
  pad: number
  editMode: boolean
  onEdit(pad: number): void
}

export const Pad = memo(function Pad({ pad, editMode, onEdit }: PadProps) {
  const soundboard = useSoundboard()
  const config = usePad(pad)
  const lit = usePadLit(pad)
  const pressed = usePadPressed(pad)
  const status = useSoundStatus(config.source)
  const showKeys = useBoard((state) => state.settings.showKeys)
  const button = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Set<number>())
  const [dropping, setDropping] = useState(false)

  // Drive the progress strip straight from the audio clock while the pad sounds.
  useFrame(() => {
    const progress = soundboard.engine.progress(pad)
    button.current?.style.setProperty('--progress', progress === null ? '0' : progress.toFixed(4))
  }, lit)

  const empty = !config.source
  const label = config.label || (empty ? '' : padName(pad))
  const key = config.key ? keyLabel(config.key) : null
  const badge = MODE_BADGE[config.mode]

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (editMode || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault() // keep focus/selection from stealing the press
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.add(event.pointerId)
    soundboard.press(pad)
  }

  const endPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    soundboard.release(pad)
  }

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (editMode) {
      onEdit(pad)
    } else if (event.detail === 0) {
      // Keyboard activation (Enter/Space on a focused pad).
      soundboard.press(pad)
      soundboard.release(pad)
    } else if (empty) {
      onEdit(pad)
    }
  }

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    onEdit(pad)
  }

  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event) && !hasPad(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = hasFiles(event) ? 'copy' : 'move'
    setDropping(true)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDropping(false)
    const from = event.dataTransfer.getData(PAD_DRAG_TYPE)
    if (from !== '') {
      const source = Number(from)
      if (source !== pad) {
        soundboard.engine.stopPad(source, 0.05)
        soundboard.engine.stopPad(pad, 0.05)
        soundboard.dispatch({ type: 'swap-pads', a: source, b: pad })
        soundboard.flash('PADS SWAPPED', `${padName(source)} ⇄ ${padName(pad)}`)
      }
      return
    }
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/i.test(file.name))
    if (files.length > 0) void soundboard.importFiles(files, pad)
    else if (event.dataTransfer.files.length > 0) soundboard.flash('NOT AUDIO', 'Drop MP3, WAV, OGG, M4A or FLAC files')
  }

  const classes = [
    'pad',
    `c-${config.color}`,
    sizeClass(label || 'EMPTY'),
    lit && 'is-lit',
    pressed && 'is-pressed',
    empty && 'is-empty',
    status === 'loading' && 'is-loading',
    status === 'error' && 'is-error',
    editMode && 'is-editing',
    dropping && 'is-drop-target',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="pad-well">
      <button
        ref={button}
        type="button"
        className={classes}
        aria-label={`${padName(pad)} ${label || 'empty pad'}${key ? `, shortcut ${key}` : ''}${editMode ? ', edit' : ''}`}
        aria-pressed={config.mode === 'toggle' || config.mode === 'loop' ? lit : undefined}
        draggable={editMode && !empty}
        onPointerDown={onPointerDown}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragStart={(event) => {
          event.dataTransfer.setData(PAD_DRAG_TYPE, String(pad))
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        <span className="pad__light" aria-hidden="true" />
        <span className="pad__face" aria-hidden="true">
          <span className="pad__top">
            <span className={`pad__key${key ? '' : ' is-unset'}`}>{showKeys ? (key ?? '·') : ''}</span>
            <span className="pad__num">{padName(pad)}</span>
          </span>
          <span className="pad__label">{status === 'error' ? 'ERROR' : label || 'EMPTY'}</span>
          <span className="pad__bottom">
            {badge && <span className="pad__badge">{badge}</span>}
            {editMode && <span className="pad__edit">EDIT</span>}
          </span>
          <span className="pad__progress" />
        </span>
      </button>
    </div>
  )
})
