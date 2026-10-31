import { BANK_A_KEYS, BANK_B_KEYS } from '../state/defaults.ts'
import { keyLabel } from '../state/keys.ts'
import { Dialog } from './Dialog.tsx'

function KeyBlock({ keys, caption }: { keys: readonly string[]; caption: string }) {
  return (
    <figure className="keymap__block" style={{ margin: 0 }}>
      {keys.map((code) => (
        <kbd key={code}>{keyLabel(code)}</kbd>
      ))}
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export function HelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="Quick reference" onClose={onClose}>
      <section>
        <h3>Play</h3>
        <p>
          Click or tap a pad, or press its key. The keyboard is laid out like the pads: bank A sits under your left hand, bank B
          under your right. Keys work for every bank, whichever bank is on screen.
        </p>
        <div className="keymap" style={{ marginTop: 12 }}>
          <KeyBlock keys={BANK_A_KEYS} caption="Bank A — Memes" />
          <KeyBlock keys={BANK_B_KEYS} caption="Bank B — SFX" />
        </div>
      </section>

      <section>
        <h3>Keys &amp; controls</h3>
        <dl className="help-grid">
          <dt>
            <kbd>Esc</kbd>
          </dt>
          <dd>Stop every sound (panic button)</dd>
          <dt>
            <kbd>Page Up</kbd> <kbd>Page Down</kbd>
          </dt>
          <dd>Switch bank</dd>
          <dt>Right-click a pad</dt>
          <dd>Edit its sound, name, key, colour and play mode (or press EDIT, then click a pad)</dd>
          <dt>Drop audio files</dt>
          <dd>onto a pad to load them — several files fill the next empty pads</dd>
          <dt>EDIT mode</dt>
          <dd>Drag one pad onto another to swap them</dd>
          <dt>Knobs</dt>
          <dd>Drag up/down, scroll, or use arrow keys. Double-click resets. Hold Shift for fine control.</dd>
          <dt>SOLO</dt>
          <dd>One sound at a time: each new pad cuts the others</dd>
          <dt>LIM</dt>
          <dd>Output limiter so stacked sounds never clip your stream</dd>
        </dl>
      </section>

      <section>
        <h3>Streaming tips</h3>
        <p>
          <strong>OBS:</strong> Edboard plays through your computer's speakers, so <em>Desktop Audio</em> picks it up. For its own
          fader, choose a virtual cable in SETUP and add it as an Audio Input Capture. You can also dock Edboard inside OBS via{' '}
          <em>Docks → Custom Browser Docks</em>.
        </p>
        <p style={{ marginTop: 8 }}>
          Shortcuts only work while the Edboard window has focus. Everything — your pads, keys and audio files — is saved in this
          browser.
        </p>
      </section>
    </Dialog>
  )
}
