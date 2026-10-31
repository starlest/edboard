import { useCallback, useEffect, useState } from 'react'
import { useBoard, useSettings, useSoundboard } from '../app/hooks.ts'
import { MAX_BANK_NAME_LENGTH } from '../state/board.ts'
import { BANK_LETTERS } from '../state/types.ts'
import { Dialog } from './Dialog.tsx'

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const soundboard = useSoundboard()
  const settings = useSettings()
  const bankNames = useBoard((state) => state.bankNames)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const canSelectOutput = soundboard.engine.canSelectOutput && !!navigator.mediaDevices?.enumerateDevices

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices(all.filter((device) => device.kind === 'audiooutput' && device.deviceId !== 'default'))
  }, [])

  // Keep the list in sync with the system (devices can be plugged in while this is open).
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    let live = true
    const load = () =>
      media.enumerateDevices().then((all) => {
        if (live) setDevices(all.filter((device) => device.kind === 'audiooutput' && device.deviceId !== 'default'))
      })
    void load()
    media.addEventListener?.('devicechange', load)
    return () => {
      live = false
      media.removeEventListener?.('devicechange', load)
    }
  }, [])

  // Browsers hide device names until the page has been granted audio permission.
  const unlockNames = async () => {
    setDeviceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      for (const track of stream.getTracks()) track.stop()
      await refreshDevices()
    } catch {
      setDeviceError('Permission was not granted, so device names stay hidden.')
    }
  }

  const namesHidden = devices.length === 0 || devices.every((device) => !device.label)

  return (
    <Dialog title="Setup" onClose={onClose}>
      <section>
        <h3>Audio output</h3>
        {canSelectOutput ? (
          <div className="field">
            <div className="field__row">
              <select
                className="select"
                aria-label="Output device"
                value={settings.outputDeviceId}
                onChange={(event) => soundboard.dispatch({ type: 'update-settings', patch: { outputDeviceId: event.target.value } })}
              >
                <option value="">System default</option>
                {devices.map((device, i) => (
                  <option key={device.deviceId || i} value={device.deviceId}>
                    {device.label || `Output ${i + 1}`}
                  </option>
                ))}
              </select>
              {namesHidden && (
                <button type="button" className="btn" onClick={() => void unlockNames()}>
                  Show device names
                </button>
              )}
            </div>
            {deviceError && <p className="field__error">{deviceError}</p>}
            <p className="field__hint">
              Send Edboard to a virtual cable (VB-CABLE, VoiceMeeter, BlackHole…) to give your soundboard its own fader in OBS,
              or leave it on the default device and capture it with Desktop Audio.
            </p>
          </div>
        ) : (
          <p className="field__hint">
            This browser can't choose an output device, so Edboard plays through your system default. Chrome and Edge support
            picking a device.
          </p>
        )}
      </section>

      <section>
        <h3>Pads</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.showKeys}
            onChange={(event) => soundboard.dispatch({ type: 'update-settings', patch: { showKeys: event.target.checked } })}
          />
          <span>Show shortcut keys on the pads</span>
        </label>
      </section>

      <section>
        <h3>Bank names</h3>
        <div className="field-grid">
          {bankNames.map((name, bank) => (
            <label key={bank} className="field">
              <span className="field__label">Bank {BANK_LETTERS[bank]}</span>
              <input
                className="input"
                defaultValue={name}
                maxLength={MAX_BANK_NAME_LENGTH}
                onBlur={(event) => soundboard.dispatch({ type: 'rename-bank', bank, name: event.target.value })}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3>Reset</h3>
        <div className="field__row">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true)
                return
              }
              soundboard.engine.stopAll()
              soundboard.dispatch({ type: 'reset-board' })
              soundboard.flash('FACTORY RESET', 'Board restored to defaults')
              onClose()
            }}
          >
            {confirmReset ? 'Click again to reset everything' : 'Reset board to factory'}
          </button>
          <p className="field__hint">Restores every pad, key and setting. Your loaded audio files will be removed.</p>
        </div>
      </section>
    </Dialog>
  )
}
