import { DEVICE_SIZE, useAudioState, useSettings, useSoundboard, type Layout } from '../app/hooks.ts'
import type { Settings } from '../state/types.ts'
import { BankSelector } from './BankSelector.tsx'
import { HwButton } from './HwButton.tsx'
import { Knob } from './Knob.tsx'
import { formatPitch } from './format.ts'
import { Lcd } from './Lcd.tsx'
import { LedMeter } from './LedMeter.tsx'
import { PadGrid } from './PadGrid.tsx'
import './Device.css'

interface DeviceProps {
  layout: Layout
  scale: number
  editMode: boolean
  onToggleEdit(): void
  onEditPad(pad: number): void
  onOpenSettings(): void
  onOpenHelp(): void
}

const percent = (value: number) => `${Math.round(value * 100)}%`

function Screw({ corner }: { corner: string }) {
  return <span className={`screw screw--${corner}`} aria-hidden="true" />
}

export function Device({ layout, scale, editMode, onToggleEdit, onEditPad, onOpenSettings, onOpenHelp }: DeviceProps) {
  const soundboard = useSoundboard()
  const settings = useSettings()
  const powered = useAudioState() === 'running'
  const size = DEVICE_SIZE[layout]

  const change = (patch: Partial<Settings>, title: string, detail: string) => {
    soundboard.dispatch({ type: 'update-settings', patch })
    soundboard.flash(title, detail, 900)
  }

  return (
    <div
      className={`device device--${layout}`}
      style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
    >
      <Screw corner="tl" />
      <Screw corner="tr" />
      <Screw corner="bl" />
      <Screw corner="br" />

      <header className="device__header">
        <div className="brand">
          <span className="brand__stripes" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <h1 className="brand__name">EDBOARD</h1>
          <span className="brand__model">ED-64</span>
          <span className="brand__tagline silk">Stream sound sampler</span>
        </div>
        <div className="power" title={powered ? 'Audio is running' : 'Audio starts on your first pad press'}>
          <span className={powered ? 'led led--green is-on' : 'led led--amber is-blink'} />
          <span className="silk">{powered ? 'POWER' : 'STANDBY'}</span>
        </div>
      </header>

      <section className="device__lcd">
        <Lcd />
      </section>

      <section className="device__knobs" aria-label="Master section">
        <Knob
          label="MASTER"
          value={settings.masterVolume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          format={percent}
          onChange={(v) => change({ masterVolume: v }, 'MASTER', percent(v))}
        />
        <Knob
          label="PITCH"
          value={settings.pitch}
          min={-12}
          max={12}
          step={1}
          defaultValue={0}
          bipolar
          format={(v) => `${formatPitch(v)} semitones`}
          onChange={(v) => change({ pitch: v }, 'PITCH', `${formatPitch(v)} ST · SPEED ${Math.round(Math.pow(2, v / 12) * 100)}%`)}
        />
        <Knob
          label="ECHO"
          value={settings.echo}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0}
          format={(v) => (v === 0 ? 'off' : percent(v))}
          onChange={(v) => change({ echo: v }, 'ECHO', v === 0 ? 'OFF' : percent(v))}
        />
        <LedMeter />
      </section>

      <section className="device__banks">
        <BankSelector />
      </section>

      <section className="device__functions" aria-label="Functions">
        <HwButton
          label="CUT OTHERS"
          led={settings.solo ? 'on' : 'off'}
          pressed={settings.solo}
          title="Solo: playing a pad stops every other sound"
          onPress={() => change({ solo: !settings.solo }, 'SOLO', settings.solo ? 'OFF · sounds can overlap' : 'ON · one sound at a time')}
        >
          SOLO
        </HwButton>
        <HwButton
          label="LIMITER"
          led={settings.limiter ? 'on' : 'off'}
          ledColor="green"
          pressed={settings.limiter}
          title="Output limiter: keeps stacked sounds from clipping your stream"
          onPress={() => change({ limiter: !settings.limiter }, 'LIMITER', settings.limiter ? 'OFF' : 'ON · no clipping')}
        >
          LIM
        </HwButton>
        <HwButton
          label="EDIT PADS"
          led={editMode ? 'blink' : 'off'}
          pressed={editMode}
          title="Edit mode: click a pad to change its sound, name, key, colour and mode"
          onPress={onToggleEdit}
        >
          EDIT
        </HwButton>
        <HwButton label="SETTINGS" title="Output device, bank names and more" onPress={onOpenSettings}>
          SETUP
        </HwButton>
        <HwButton label="HELP" title="Shortcuts and tips" onPress={onOpenHelp}>
          ?
        </HwButton>
        <HwButton variant="stop" label="ESC · STOP ALL" title="Stop every sound (Esc)" onPress={() => soundboard.stopAll()}>
          STOP
        </HwButton>
      </section>

      <section className="device__pads">
        <PadGrid editMode={editMode} onEdit={onEditPad} />
      </section>

      <footer className="device__footer silk">
        <span className="for-mouse">
          <b>CLICK / KEY</b> play
        </span>
        <span className="for-mouse">
          <b>RIGHT-CLICK</b> edit pad
        </span>
        <span className="for-mouse">
          <b>DROP AUDIO</b> on a pad to load it
        </span>
        <span className="for-mouse">
          <b>PG UP/DN</b> bank
        </span>
        <span className="for-touch">
          <b>TAP</b> play
        </span>
        <span className="for-touch">
          <b>EDIT + TAP</b> change a pad
        </span>
        <span className="for-touch">
          <b>EMPTY PAD</b> tap to load audio
        </span>
      </footer>
    </div>
  )
}
