# Sound pack

Audio files in this folder replace Edboard's built-in sounds **for everyone who opens your deployment**, on every device. Name a file after the sound it replaces and it is picked up automatically at build time.

## Included

| File | Replaces | Source |
| --- | --- | --- |
| `fah.mp3` | FAH! | ["Fahhh" on Myinstants](https://www.myinstants.com/en/instant/fahhh-42300/) |
| `laugh.mp3` | LAUGH | ["Rizzbot laugh" on Myinstants](https://www.myinstants.com/en/instant/rizzbot-laugh-66507/) |
| `wow.mp3` | ANIME WOW (the `wow` sound) | ["Anime Wow" on Myinstants](https://www.myinstants.com/en/instant/anime-wow/) |

The FAH and laugh clips are trimmed where the sound ends (with a short fade): the originals carry a hum and a stray tone/thump after the shout and the laugh. The anime wow is used as-is (its tail is the effect's own echo).

Delete a file to go back to Edboard's synthesised version of that sound.

## Adding a sound

1. Rename your clip to the sound's id, e.g. `fah.mp3` or `laugh.mp3`. MP3, WAV, OGG, Opus, M4A, AAC, FLAC and WebM all work, and capitals, spaces and underscores in the name are fine (`Air_Horn.MP3` → `air-horn`).
2. Put it in this folder. On GitHub: open the `sounds` folder → **Add file → Upload files** → commit.
3. Deploy (Vercel redeploys on its own after the commit).

Edboard trims leading silence and levels the clip to the same loudness as the other built-in sounds. If a file can't be decoded, the synthesised sound is used instead. Your own pad edits still win: a pad you've loaded a file onto in the browser keeps that file.

Only add audio you have the right to publish — everything in this folder is served publicly with your site.

## Sound ids

Every built-in sound can be replaced; "Default board" marks the ones on the factory pads. The rest can be put on any pad from the pad editor.

| Id | Sound | Default board |
| --- | --- | --- |
| `fah` | FAH! | yes |
| `laugh` | LAUGH | yes |
| `bruh` | BRUH | yes |
| `oof` | OOF |  |
| `wow` | WOW | yes |
| `air-horn` | AIR HORN | yes |
| `vine-boom` | VINE BOOM | yes |
| `sad-trombone` | SAD TROMBONE | yes |
| `rimshot` | BA DUM TSS | yes |
| `bonk` | BONK |  |
| `record-scratch` | SCRATCH |  |
| `bleep` | BLEEP |  |
| `applause` | APPLAUSE |  |
| `crickets` | CRICKETS | yes |
| `drum-roll` | DRUM ROLL |  |
| `dun-dun-dun` | DUN DUN DUN |  |
| `victory` | VICTORY |  |
| `wrong` | WRONG |  |
| `correct` | CORRECT |  |
| `laser` | LASER |  |
| `explosion` | EXPLOSION |  |
| `boing` | BOING |  |
| `whoosh` | WHOOSH |  |
| `cha-ching` | CHA-CHING |  |
| `heartbeat` | HEARTBEAT |  |
| `alarm` | ALARM |  |
| `countdown` | COUNTDOWN |  |
| `suspense` | SUSPENSE |  |
| `slide-whistle` | SLIDE WHISTLE |  |
| `gong` | GONG |  |
| `coin` | COIN |  |
| `power-up` | POWER UP |  |
| `game-over` | GAME OVER |  |
