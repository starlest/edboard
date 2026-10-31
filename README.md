# EDBOARD

**A hardware-style soundboard for streamers.** Click a pad or hit a shortcut to fire a sound on stream — FAH!, a laugh, air horn, vine boom and more are built in, and you can drop your own clips onto any pad.

![EDBOARD — a sampler-style soundboard with glowing pads, an amber LCD, knobs and LED meters](docs/edboard.jpg)

It looks and behaves like a piece of studio gear: rubber pads that press down and light up while their sound plays, an amber LCD with a live waveform and playhead, a master section with knurled knobs and LED level meters, bank buttons with activity LEDs, and a big red panic button.

## Features

- **64 pads in 4 banks** (4 × 4 grid, like an MPC / SP-404). The factory board starts with 8 sounds on bank A; every other pad is yours to fill.
- **33 built-in sounds, no samples shipped.** Every built-in sound is synthesised in code at start-up (a formant voice synthesiser does the "FAH!", "LAUGH", "BRUH", "OOF" and "WOW"), so there is no licensed audio in the repo and nothing to download.
- **Sound pack:** put an audio file named after a built-in sound in [`sounds/`](sounds/README.md) (e.g. `sounds/fah.mp3`) and it replaces that sound for everyone who opens your deployment.
- **Keyboard shortcuts laid out like the pads.** Bank A sits under your left hand (`1-4 / Q-R / A-F / Z-V`), bank B under your right (`5-8 / T-I / G-K / B-,`). Shortcuts work for every bank, whichever one is on screen, and can be re-bound to any key (numpad and F13–F24 for macro keyboards / Stream Deck included).
- **Your own sounds.** Drop MP3 / WAV / OGG / M4A / FLAC files on a pad (several files fill the next empty pads), or load them in the pad editor. Leading silence is trimmed and clips are loudness-levelled so nothing blows out your stream (switchable per pad).
- **Play modes per pad:** one-shot (re-press restarts), overlap (spam-friendly), hold (plays while held — perfect for the censor BLEEP), toggle, and loop.
- **Master section:** volume, vari-speed **pitch** (±12 semitones, chipmunk to demon), **echo** send, **SOLO** (one sound at a time), output **limiter**, stereo LED meters, and **STOP / Esc** to kill everything.
- **Output device routing** (Chrome / Edge): send the board to a virtual cable so it gets its own fader in OBS.
- **Everything is saved in your browser** — pads, keys, settings (localStorage) and your audio files (IndexedDB).
- **Scales like hardware:** landscape on desktops, a portrait unit on phones and tablets (multi-touch works), small enough for an OBS dock.

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (static files in `dist/`, works from any sub-path, e.g. GitHub Pages):

```bash
npm run build
npm run preview
```

### Deploying

Edboard is a static site, so any static host works. On **Vercel**, import the repo and deploy the branch that contains the app (Vercel's production domain builds `main`). `vercel.json` pins the build (`npm run build` → `dist/`), so it builds correctly even if the project was created with the "Other" framework preset.

## Using it on stream

1. Open Edboard in your browser (or in OBS: **Docks → Custom Browser Docks**, paste the URL).
2. Sounds play through your default speakers, so OBS's **Desktop Audio** picks them up — no setup needed.
3. Want a separate fader for the soundboard? Press **SETUP** and choose a virtual audio cable (VB-CABLE, VoiceMeeter, BlackHole…) as the output, then add that cable to OBS as an **Audio Input Capture**.

> Keyboard shortcuts only work while the Edboard window has focus — browsers can't listen to keys while you're in a game. Click the board (or its OBS dock) first.

## Controls

| Action | How |
| --- | --- |
| Play a pad | Click / tap it, or press its key |
| Stop everything | **STOP** or `Esc` |
| Switch bank | **A B C D** buttons or `Page Up` / `Page Down` |
| Edit a pad (sound, name, key, colour, mode, volume) | Right-click it, or press **EDIT** then click it |
| Load your own sound | Drop an audio file on a pad, or use the pad editor |
| Swap two pads | **EDIT** mode, then drag one pad onto another |
| Knobs | Drag up/down, scroll, or arrow keys · double-click to reset · Shift for fine control |

## Default board

| Bank A | | | |
| --- | --- | --- | --- |
| `1` FAH! | `2` LAUGH | `3` AIR HORN | `4` VINE BOOM |
| `Q` BRUH | `W` SAD TROMBONE | `E` BA DUM TSS | `R` CRICKETS |
| `A` · | `S` · | `D` · | `F` · |
| `Z` · | `X` · | `C` · | `V` · |

The empty pads already have shortcuts (bank B too: `5-8 / T-I / G-K / B-,`). Fill them by dropping audio files on them, or pick any of the 33 built-in sounds in the pad editor: voices (FAH!, LAUGH, BRUH, OOF, WOW), meme classics (air horn, vine boom, sad trombone, ba-dum-tss, bonk, record scratch, censor bleep), stage & game show (applause, crickets, drum roll, dun-dun-dun, victory fanfare, wrong buzzer, correct ding), sound effects (laser, explosion, boing, whoosh, cha-ching, heartbeat, alarm, countdown, suspense riser, slide whistle, gong) and 8-bit (coin, power-up, game over).

The built-in sounds are original synthesised takes on the classics, not the original meme recordings.

## Sound pack: make your own clips the default

Want the exact meme clip — say, the original "FAH" — on every device that opens your site? Add it to the repo:

1. Name the file after the sound it replaces: `fah.mp3`, `laugh.mp3`, `air-horn.wav`… (ids are listed in [`sounds/README.md`](sounds/README.md)).
2. Put it in the `sounds/` folder (on GitHub: open `sounds` → **Add file → Upload files**) and commit.
3. Redeploy. The file is bundled at build time, trimmed and loudness-levelled like the other sounds, and replaces the synthesised version for everyone.

Only add audio you have the right to publish: files in `sounds/` are served publicly with your site. A clip you drop onto a pad in the browser stays private to that browser.

## How it works

```
src/
  audio/
    dsp/           Sample-level DSP: oscillators, filters, envelopes, Freeverb, BS.1770 loudness
    synth/         Built-in sound recipes, formant voice synth, render worker
    engine.ts      Web Audio playback: voices → echo → master → limiter → meters
    soundBank.ts   Decoded buffers for built-in and user sounds (+ levelling, silence trim)
  state/           Board model, reducer, persistence, IndexedDB file store, key labels
  app/             Soundboard controller (play modes, shortcuts, LCD messages) and React hooks
  components/      The hardware: Device, Pad, Lcd, Knob, LedMeter, HwButton, dialogs
```

- Built-in sounds are plain TypeScript functions that write samples into a buffer. They render deterministically in a pool of Web Workers at the audio device's sample rate, are levelled to −14 LUFS (momentary max), and then play as ordinary `AudioBuffer`s — so they start instantly.
- Pads trigger on `pointerdown` / `keydown` (not on release) for the lowest latency.
- To add a built-in sound, write a recipe in `src/audio/synth/sounds/` and register it in `src/audio/synth/library.ts`. Sound-pack files (`sounds/`) are found by `import.meta.glob` in `src/audio/soundPack.ts`.

## Development

```bash
npm test           # unit tests (Vitest) — DSP, every built-in sound, sound pack, board state
npm run lint       # oxlint
npm run typecheck  # tsc
```
