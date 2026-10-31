import { useCallback, useEffect, useRef } from 'react'
import { useAudioState, useBoard, useDisplay, useFrame, useLoadingCount, usePad, usePadLit, useSettings, useSoundboard, useSoundStatus } from '../app/hooks.ts'
import { BUILTIN_SOUNDS } from '../audio/synth/library.ts'
import { waveformPeaks } from '../audio/waveform.ts'
import { keyLabel } from '../state/keys.ts'
import { padBank, padName, type PlayMode } from '../state/types.ts'
import { formatPitch, formatTime } from './format.ts'
import './Lcd.css'

const MODE_NAMES: Record<PlayMode, string> = {
  oneshot: 'ONE-SHOT',
  overlap: 'POLY',
  hold: 'HOLD',
  toggle: 'TOGGLE',
  loop: 'LOOP',
}

const BUILTIN_KEYS = BUILTIN_SOUNDS.map((sound) => `builtin:${sound.id}`)

const LCD_BRIGHT = '#ffc266'
const LCD_MID = 'rgba(255, 181, 74, 0.42)'
const LCD_FAINT = 'rgba(255, 181, 74, 0.16)'

/** Backlit dot-matrix style display: current pad, waveform with playhead, status flags and messages. */
export function Lcd() {
  const soundboard = useSoundboard()
  const { pad, message } = useDisplay()
  const config = usePad(pad)
  const settings = useSettings()
  const bankName = useBoard((state) => state.bankNames[padBank(pad)])
  const lit = usePadLit(pad)
  const status = useSoundStatus(config.source)
  const audioState = useAudioState()
  const loading = useLoadingCount(BUILTIN_KEYS)
  const canvas = useRef<HTMLCanvasElement>(null)
  const clock = useRef<HTMLSpanElement>(null)

  const sound = config.source && status === 'ready' ? soundboard.sounds.get(config.source) : undefined
  const duration = sound ? sound.buffer.duration - sound.offset : 0

  const draw = useCallback(
    (progress: number | null) => {
      const el = canvas.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (el.width !== width || el.height !== height) {
        el.width = width
        el.height = height
      }
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      const unit = width / 120 // ~120 "dots" across, whatever the zoom
      const bar = Math.max(1, unit * 0.68)
      const columns = Math.floor(width / unit)
      if (!sound) {
        ctx.fillStyle = LCD_FAINT
        for (let c = 0; c < columns; c++) ctx.fillRect(c * unit, height / 2 - bar / 2, bar, bar)
        return
      }
      const peaks = waveformPeaks(sound.buffer, columns, sound.offset)
      const played = progress === null ? -1 : progress * columns
      for (let c = 0; c < columns; c++) {
        const amp = Math.max(bar / height, peaks[c]) * (height - 2)
        const dots = Math.max(1, Math.round(amp / unit))
        ctx.fillStyle = c <= played ? LCD_BRIGHT : LCD_MID
        // Draw as stacked dots so it reads like an LCD matrix.
        const top = height / 2 - (dots * unit) / 2
        for (let d = 0; d < dots; d++) ctx.fillRect(c * unit, top + d * unit, bar, bar)
      }
      if (progress !== null) {
        ctx.fillStyle = LCD_BRIGHT
        ctx.fillRect(Math.min(columns - 1, Math.floor(played)) * unit, 0, bar, height)
      }
    },
    [sound],
  )

  const writeClock = useCallback(
    (progress: number | null) => {
      if (clock.current) clock.current.textContent = `${formatTime((progress ?? 0) * duration)} / ${formatTime(duration)}`
    },
    [duration],
  )

  useEffect(() => {
    if (lit) return
    draw(null)
    writeClock(null)
    const redraw = () => draw(null)
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [draw, writeClock, lit])

  useFrame(() => {
    const progress = soundboard.engine.progress(pad)
    draw(progress)
    writeClock(progress)
  }, lit)

  let statusText: string | null = null
  if (loading > 0) statusText = `LOADING SOUNDS ${BUILTIN_KEYS.length - loading}/${BUILTIN_KEYS.length}`
  else if (audioState !== 'running') statusText = 'STANDBY · PRESS ANY PAD'

  const title = status === 'error' ? 'SOUND ERROR' : config.label || (config.source ? padName(pad) : '— EMPTY —')

  return (
    <div className="lcd">
      <div className="lcd__screen">
        <div className="lcd__row">
          <span>
            {padName(pad)} · {bankName}
          </span>
          <span>KEY {config.key ? keyLabel(config.key) : '—'}</span>
          <span>{MODE_NAMES[config.mode]}</span>
        </div>
        <div className={`lcd__title${title.length > 13 ? ' is-long' : ''}`}>{title}</div>
        <canvas ref={canvas} className="lcd__wave" />
        <div className="lcd__row lcd__row--status">
          {statusText ? <span className="lcd__blink">{statusText}</span> : <span ref={clock} />}
          <span className="lcd__flags">
            <span className={settings.solo ? 'is-on' : ''}>SOLO</span>
            <span className={settings.limiter ? 'is-on' : ''}>LIM</span>
            <span className={settings.echo > 0 ? 'is-on' : ''}>ECHO</span>
            <span className={settings.pitch !== 0 ? 'is-on' : ''}>PIT{formatPitch(settings.pitch)}</span>
          </span>
        </div>
        {message && (
          <div className="lcd__message">
            <div className="lcd__message-title">{message.title}</div>
            {message.detail && <div className="lcd__message-detail">{message.detail}</div>}
          </div>
        )}
        <div className="sr-only" role="status" aria-live="polite">
          {message ? `${message.title}. ${message.detail ?? ''}` : ''}
        </div>
      </div>
    </div>
  )
}
