import { useRef, type CSSProperties } from 'react'
import { useAudioState, useFrame, useSoundboard } from '../app/hooks.ts'
import './LedMeter.css'

const SEGMENTS = 16
const FLOOR_DB = -42
const RELEASE_PER_SECOND = 1.4
const PEAK_HOLD_MS = 900

/** Stereo LED ladder meter with peak hold, driven straight from the output analysers. */
export function LedMeter() {
  const { engine } = useSoundboard()
  const running = useAudioState() === 'running'
  const bars = useRef<(HTMLDivElement | null)[]>([null, null])
  const state = useRef({
    raw: [0, 0] as [number, number],
    level: [0, 0],
    peak: [0, 0],
    peakAt: [0, 0],
    last: 0,
  })

  useFrame((now) => {
    const s = state.current
    const dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 0
    s.last = now
    engine.readLevels(s.raw)
    for (let ch = 0; ch < 2; ch++) {
      const db = 20 * Math.log10(Math.max(s.raw[ch], 1e-6))
      const target = Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB))
      s.level[ch] = target > s.level[ch] ? target : Math.max(target, s.level[ch] - dt * RELEASE_PER_SECOND)
      if (s.level[ch] >= s.peak[ch]) {
        s.peak[ch] = s.level[ch]
        s.peakAt[ch] = now
      } else if (now - s.peakAt[ch] > PEAK_HOLD_MS) {
        s.peak[ch] = Math.max(s.level[ch], s.peak[ch] - dt * RELEASE_PER_SECOND)
      }
      const el = bars.current[ch]
      if (!el) continue
      el.style.setProperty('--level', String(Math.round(s.level[ch] * SEGMENTS) / SEGMENTS))
      el.style.setProperty('--peak', String(Math.ceil(s.peak[ch] * SEGMENTS - 0.001) / SEGMENTS))
    }
  }, running)

  return (
    <div className="meter" aria-hidden="true">
      <div className="meter__scale silk">
        <span>0</span>
        <span>-12</span>
        <span>-24</span>
        <span>-42</span>
      </div>
      {(['L', 'R'] as const).map((name, ch) => (
        <div key={name} className="meter__channel">
          <div
            ref={(el) => {
              bars.current[ch] = el
            }}
            className="meter__bar"
            style={{ '--segments': SEGMENTS } as CSSProperties}
          >
            <div className="meter__lit" />
            <div className="meter__peak" />
          </div>
          <span className="silk meter__name">{name}</span>
        </div>
      ))}
    </div>
  )
}
