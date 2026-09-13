# Music

One instrumental cue, composed with **ElevenLabs Music** (`POST /v1/music`, `music_v1`,
`force_instrumental: true`) by `scripts/compose-music.ts`. Chosen over library music
because the credits were already there, it needs no attribution line in a gift film, and the
brief could be written for exactly this job — a bed that sits under five voices.

| | |
|---|---|
| Cue | `underscore` — requested 262 s; sound runs 8.0 s → 249.9 s (mp3 44.1 kHz 128 kbps) |
| Cache | `cache/alice-in-dragonland/music/underscore.mp3` (+ hash-named archive) |
| Brief | piano and soft strings, a hint of Nordic fiddle and harp; slow, sparse, no percussion, no swells; resolved final chord |

## How it is mixed (`engine/src/film/Film.tsx` + `timeline.ts`, `AliceFilm`)

- **0.13** under narration — present, never competing. The narration is its own track and is
  never ducked; the cue simply stays low.
- **0.42** under the title card and **0.6** under the end card, where nobody speaks; a
  one-second ease at each boundary.
- 2 s fade in, 1.5 s fade out.
- **The cue's final chord lands on the end card.** A composed take resolves on a chord and
  then decays into silence. Pinning the *end of the decay* to the end of the film (the first
  attempt) left the Fin card at −58 dBFS — the faint tail plus a long fade-out. So
  `compose-music.ts` measures two points and writes them to `audio/music-underscore.json`:
  `soundEndSec` (where sound stops) and `landingSec` (the last moment the cue is still above
  −30 dB — where the chord lands). `AliceFilm` pins `landingSec` 1.5 s before the film ends, so the
  last strong bars play under "Fin", and trims the front of the cue to fit (10.3 s for this
  take, under the 2 s fade-in). Measured on v5: title card −27.5 dBFS, Fin card −31 dBFS. The
  fade-out is 1.5 s; the chord's own decay carries the card. A cue too short for this
  alignment would start late — that is a brief to recompose, never a loop.

## If the cue is ever replaced

Re-run `compose-music.ts` with a new brief name in `BRIEFS`; the old take stays in the
archive. Library fallbacks that were considered: Pixabay Music (no attribution) and Kevin
MacLeod / incompetech (CC BY — would need a credit on the Fin card).
