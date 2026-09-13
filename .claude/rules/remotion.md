---
paths:
  - "engine/**"
---

# Remotion compositions

- A story film is data, never code: `shows/<slug>/film.json` (schema `schemas/film.ts`) is loaded by `src/film/registry.ts` and becomes `<Id>Arc<X>`, `<Id><Part>`, `<Id>Film`, `<Id>Title`, `<Id>Credits`. Add shots to the JSON; touch `src/film/` only for behaviour every show should get.
- A **component shot** (`"component": "map-focus", "props": {...}`) renders a show-pack React component from `src/packs/<slug>/` in the same sentence window a clip would fill. Anything inside it that should appear on a spoken word names a word anchor (`"anchor": "Thirty-eight"`, optional `occurrence`), resolved against `audio/<part>.words.json` (`word-cues`, run after `align-sentences`) — never a hand-written time. Missing words file = the film refuses to load.
- Show-specific visuals live in the pack, never in `src/film/`; packs read colours from `brands/<slug>/brand.json`. Maps come only from `assets/maps/india-states.svg` (GoI borders) served via `engine/public/assets`.
- `music.underArcs: true` plays the underscore in standalone arc/part renders (slice reviews). It masks the speech onsets `verify-sync` listens for — its check then falls back to alignment-only, which the output says.
- Never pass `trimAfter` to `OffthreadVideo` together with a `playbackRate` below 1 — it is applied in composition frames without dividing by the rate, and the clip goes black for the rest of its window. The Sequence length already bounds the clip.
- A closing shot **holds** its own last frame (`hold`, from `extract-tail-frames`); it is never stretched to fill the tail.
- An arc composition trims its audio at **both** ends (`audioEnd`): the recording is one take, and a tail without an end plays the next arc's line under the fade.
- `shotWindows` clamps the first shot to the composition start; a boundary measured from audio and a sentence start are a few frames apart.
- Every render is checked on the file: `npx tsx scripts/verify-sync.ts <mp4> <Comp>` (cuts vs speech onsets) and `npx tsx scripts/verify-picture.ts <mp4> --comp <Comp>` (black frames; a `*Film` comp allows its end cards to be dark). The `remotion render` hook runs both.
- Music: pin the cue's measured `landingSec` 1.5 s before the film ends; the fade-out takes only the decay.
