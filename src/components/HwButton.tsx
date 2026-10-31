import type { ReactNode } from 'react'
import './HwButton.css'

export type LedState = 'off' | 'on' | 'blink'
export type LedColor = 'amber' | 'green' | 'red'

interface HwButtonProps {
  /** Silkscreen legend printed under the button. */
  label: string
  /** Text printed on the button cap. */
  children: ReactNode
  led?: LedState
  ledColor?: LedColor
  /** Extra LED (e.g. bank activity) shown next to the main one. */
  activity?: boolean
  variant?: 'default' | 'stop' | 'bank'
  pressed?: boolean
  title?: string
  onPress(): void
}

/** Rubber hardware button with a status LED. */
export function HwButton({
  label,
  children,
  led,
  ledColor = 'amber',
  activity,
  variant = 'default',
  pressed,
  title,
  onPress,
}: HwButtonProps) {
  return (
    <div className={`hw hw--${variant}`}>
      <div className="hw__leds" aria-hidden="true">
        {led !== undefined && <span className={`led led--${ledColor} is-${led}`} />}
        {activity !== undefined && <span className={`led led--green led--small is-${activity ? 'on' : 'off'}`} />}
      </div>
      <button
        type="button"
        className="hw__button"
        aria-pressed={pressed}
        title={title}
        onPointerDown={(event) => {
          // Fire on press like real hardware, but keep keyboard/assistive "click" working.
          if (event.pointerType === 'mouse' && event.button !== 0) return
          event.preventDefault()
          onPress()
        }}
        onClick={(event) => {
          if (event.detail === 0) onPress()
        }}
      >
        <span className="hw__cap">{children}</span>
      </button>
      <span className="hw__label silk">{label}</span>
    </div>
  )
}
