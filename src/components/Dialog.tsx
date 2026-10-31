import { useEffect, useId, useRef, type ReactNode } from 'react'
import './Dialog.css'

interface DialogProps {
  title: ReactNode
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Close when clicking the dimmed backdrop (off for editors with unsaved input). */
  dismissOnBackdrop?: boolean
}

/** Modal panel built on the native <dialog> element (focus trapping and Esc handling for free). */
export function Dialog({ title, onClose, children, footer, className = '', dismissOnBackdrop = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog__panel">
        <header className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="dialog__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </div>
    </dialog>
  )
}
