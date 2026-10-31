import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import './Knob.css'

const SWEEP = 135 // degrees either side of 12 o'clock
const DRAG_RANGE = 180 // pixels of vertical travel for the full range

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  defaultValue: number
  /** Keyboard / wheel step. */
  step: number
  /** Value arc grows from 12 o'clock (for ± controls like pitch). */
  bipolar?: boolean
  format(value: number): string
  onChange(value: number): void
}

function polar(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180
  return [50 + radius * Math.sin(rad), 50 - radius * Math.cos(rad)]
}

function arc(from: number, to: number, radius: number): string {
  if (Math.abs(to - from) < 0.01) return ''
  const [a0, a1] = from < to ? [from, to] : [to, from]
  const [x0, y0] = polar(a0, radius)
  const [x1, y1] = polar(a1, radius)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const TICKS = Array.from({ length: 11 }, (_, i) => -SWEEP + (i * 2 * SWEEP) / 10)

export function Knob({ label, value, min, max, defaultValue, step, bipolar = false, format, onChange }: KnobProps) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; y: number; value: number } | null>(null)
  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  })

  const clampSnap = (v: number) => {
    const snapped = Math.round((v - min) / step) * step + min
    return Math.min(max, Math.max(min, Number(snapped.toFixed(6))))
  }
  const set = (v: number) => {
    const next = clampSnap(v)
    if (next !== latest.current.value) latest.current.onChange(next)
  }

  // Wheel needs a non-passive native listener to stop the page from scrolling.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const direction = event.deltaY < 0 || event.deltaX > 0 ? 1 : -1
      const next = Math.min(max, Math.max(min, latest.current.value + direction * step))
      if (next !== latest.current.value) latest.current.onChange(Number(next.toFixed(6)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [min, max, step])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, y: event.clientY, value }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== event.pointerId) return
    const fine = event.shiftKey ? 0.2 : 1
    set(d.value + ((d.y - event.clientY) / DRAG_RANGE) * (max - min) * fine)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === event.pointerId) drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = step * Math.max(1, Math.round((max - min) / step / 10))
    const moves: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    set(moves[event.key])
  }

  const ratio = (value - min) / (max - min)
  const angle = -SWEEP + ratio * 2 * SWEEP
  const origin = bipolar ? -SWEEP + ((0 - min) / (max - min)) * 2 * SWEEP : -SWEEP

  return (
    <div className="knob">
      <div
        ref={root}
        className="knob__control"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        title={`${label}: ${format(value)} — drag, scroll or use arrow keys. Double-click to reset.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={() => set(defaultValue)}
      >
        <svg className="knob__scale" viewBox="0 0 100 100" aria-hidden="true">
          {TICKS.map((tick) => {
            const [x0, y0] = polar(tick, 46)
            const [x1, y1] = polar(tick, 49.5)
            return <line key={tick} x1={x0} y1={y0} x2={x1} y2={y1} className="knob__tick" />
          })}
          <path d={arc(-SWEEP, SWEEP, 42)} className="knob__track" />
          <path d={arc(origin, angle, 42)} className="knob__value" />
        </svg>
        <div className="knob__body" aria-hidden="true">
          <div className="knob__rotor" style={{ transform: `rotate(${angle}deg)` }}>
            <div className="knob__grip" />
            <div className="knob__cap" />
            <div className="knob__pointer" />
          </div>
          <div className="knob__sheen" />
        </div>
      </div>
      <span className="knob__label silk">{label}</span>
    </div>
  )
}
