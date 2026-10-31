import { useCallback, useEffect, useState } from 'react'
import { DEVICE_SIZE, SoundboardContext, useFitToWindow, useSoundboard } from './app/hooks.ts'
import type { Soundboard } from './app/soundboard.ts'
import { Device } from './components/Device.tsx'
import { HelpDialog } from './components/HelpDialog.tsx'
import { PadEditor } from './components/PadEditor.tsx'
import { SettingsDialog } from './components/SettingsDialog.tsx'
import './App.css'

type OpenDialog = { kind: 'pad'; pad: number } | { kind: 'settings' } | { kind: 'help' } | null

function Studio() {
  const soundboard = useSoundboard()
  const { layout, scale } = useFitToWindow()
  const [editMode, setEditMode] = useState(false)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [draggingFiles, setDraggingFiles] = useState(false)

  // Shortcuts are paused while a dialog is open (so typing a pad name doesn't fire sounds).
  useEffect(() => {
    soundboard.setKeyboardLocked(dialog !== null)
  }, [soundboard, dialog])

  useEffect(() => {
    const unlockAudio = () => soundboard.engine.resume()
    window.addEventListener('keydown', soundboard.handleKeyDown)
    window.addEventListener('keyup', soundboard.handleKeyUp)
    window.addEventListener('blur', soundboard.releaseAllKeys)
    // Any gesture may start audio (browsers keep it suspended until then).
    for (const type of ['pointerdown', 'pointerup', 'keydown'] as const) window.addEventListener(type, unlockAudio, true)
    return () => {
      window.removeEventListener('keydown', soundboard.handleKeyDown)
      window.removeEventListener('keyup', soundboard.handleKeyUp)
      window.removeEventListener('blur', soundboard.releaseAllKeys)
      for (const type of ['pointerdown', 'pointerup', 'keydown'] as const) window.removeEventListener(type, unlockAudio, true)
    }
  }, [soundboard])

  // Highlight drop targets while files are dragged over the window, and stop
  // the browser from navigating to a file dropped outside a pad.
  useEffect(() => {
    let depth = 0
    const isFileDrag = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files')
    const onEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      depth++
      setDraggingFiles(true)
    }
    const onLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDraggingFiles(false)
    }
    const onOver = (event: DragEvent) => {
      if (isFileDrag(event)) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      depth = 0
      setDraggingFiles(false)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const toggleEdit = useCallback(() => {
    const next = !editMode
    setEditMode(next)
    soundboard.flash(next ? 'EDIT MODE' : 'PLAY MODE', next ? 'Click a pad to edit · drag to swap' : 'Pads play sounds', 2200)
  }, [soundboard, editMode])

  const editPad = useCallback((pad: number) => setDialog({ kind: 'pad', pad }), [])
  const closeDialog = useCallback(() => setDialog(null), [])
  const size = DEVICE_SIZE[layout]

  return (
    <main className={`stage${draggingFiles ? ' is-dragging-files' : ''}`}>
      <div className="stage__frame" style={{ width: size.width * scale, height: size.height * scale }}>
        <Device
          layout={layout}
          scale={scale}
          editMode={editMode}
          onToggleEdit={toggleEdit}
          onEditPad={editPad}
          onOpenSettings={() => setDialog({ kind: 'settings' })}
          onOpenHelp={() => setDialog({ kind: 'help' })}
        />
      </div>
      {dialog?.kind === 'pad' && <PadEditor key={dialog.pad} pad={dialog.pad} onClose={closeDialog} />}
      {dialog?.kind === 'settings' && <SettingsDialog onClose={closeDialog} />}
      {dialog?.kind === 'help' && <HelpDialog onClose={closeDialog} />}
    </main>
  )
}

export function App({ soundboard }: { soundboard: Soundboard }) {
  return (
    <SoundboardContext.Provider value={soundboard}>
      <Studio />
    </SoundboardContext.Provider>
  )
}
