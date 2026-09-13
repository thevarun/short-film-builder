# Animating a story — the pipeline

How _Alice in Dragonland_ was made, written so the next story follows the same road without
re-learning it. Each stage has a **gate**: nothing downstream starts until the gate passes.
The gates exist because every expensive mistake on Alice came from skipping one.

The single rule underneath everything: **audio is the timeline, and the recording is the
ruler — not any API's description of it.** Every timestamp in the film is measured from the
mp3 that actually plays.

---

## The road, stage by stage

| #   | Stage                | Produces                                                                                                     | Gate                                                                                                                               |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Read & cast**      | `character-bible.md` — every character, canonical heights, style anchor, proportion rules _by subject class_ | Author's intent confirmed; style anchor image locked                                                                               |
| 2   | **Character sheets** | `art/characters/*.png`                                                                                       | Each sheet approved on model; adults generated fresh, never edited from a child sheet                                              |
| 3   | **Beat sheet**       | `beat-sheet.md` — beats, verbatim lines, runtime budget, the governing "no damage" rule                      | Runtime and adaptation decisions agreed                                                                                            |
| 4   | **Location bible**   | `art/locations/*.png` — one master plate per place, colour-temperature progression                           | Plates approved                                                                                                                    |
| 5   | **Audio script**     | `audio-script-*.md` + `audio/script-*.json` — pre-normalised text, audio tags, casting                       | Voices auditioned (`voice-audition.ts`) and chosen; script read once for line changes                                              |
| 6   | **Record → align**   | `cache/audio/*.mp3`, `audio/*.sentences.json`, `*.timings.json`                                              | **Listen to the take.** Runtime accepted. `record-dialogue` → `force-align` → `split-sentences` → `align-sentences`, in that order |
| 7   | **Shot plan**        | `shot-plan-*.md` — shots cut to sentence spans, live vs 2.5D, transitions, the paintings needed              | Plan confirmed before any plate is painted                                                                                         |
| 8   | **Plates**           | `art/shots/*.png`                                                                                            | **Plate audit**: props from a later beat, characters not yet introduced, legibility at the framing, nothing burning                |
| 9   | **Shot specs**       | `motion/motion-*.json` — action, camera, constraints, per-shot negatives, chains                             | `check-retime` passes; `animate-shots` fail-fast guards pass                                                                       |
| 10  | **Generate**         | `cache/motion/*.mp4` (lite tier; hash archives)                                                              | Every clip reviewed as a **contact strip** (`build-strips`), against the rules in step 8                                           |
| 11  | **Compose & render** | `<Id>Arc*` → `<Id><Part>` → `<Id>Film` (all from `film.json`), `out/<show>/…`                                | `verify-sync` and `verify-picture` pass on the _rendered file_                                                                     |
| 12  | **Finish**           | title/end cards, composed underscore, mix levels measured                                                    | Levels measured with `volumedetect`; the user watches the whole thing                                                              |

Roughly: **a day per sequence** once the pipeline existed, plus the pipeline itself.

**Explainer shows (a geography series, not included here) ride the same road with a different step 8–10.** Instead
of plates and Veo clips, shots are _component shots_: `film.json` names a component from the
show's pack (`engine/src/packs/<slug>/` — map-focus, title-card, stat-sprint, speaker-card)
and the props it needs; stats, pins and captions appear on the spoken word via word anchors
(`word-cues.ts` → `audio/<part>.words.json`). The audio road is identical (`script-to-dialogue`
→ `record-dialogue` → `force-align` → `split-sentences` → `align-sentences` → `word-cues`),
and the renders go through the same `verify-sync` / `verify-picture` gates. The first 90 s of
an episode was the vertical slice that proved it.

---

## What we learned — the tricks that changed the outcome

### Timing

- **Cut to sentences, never to fractions of a beat.** Splitting a beat into equal thirds put a
  dragon on screen under "had never seen a dragon". Derive a sentences file from the alignment
  and index every shot into it.
- **A sentence starts at its first spoken character.** Audio tags (`[alarmed]`) occupy real
  time in `eleven_v3` output; chaining starts to previous ends put shots a second early.
- **Force-align the saved mp3.** The dialogue API's own alignment ran 4% short of the audio on
  AB (3.4 s by the end) and 0.4% on CDE. Three rounds of "fixes" verified against that ruler
  were all wrong. `force-align.ts` is not optional.
- **Snap starts to measured pauses.** Forced alignment stretches short openers ("And", "No")
  back into the silence before them. `align-sentences` moves any start that lands in a pause
  forward to where speech resumes.
- **A shot runs until the next shot's line starts.** Trailing pauses stay on the outgoing
  image; nothing opens a hole.
- **Arc boundaries sit in measured silence**, derived from the sentences, never hardcoded. An
  arc's held tail is _silent_ — trim the audio at both ends or the next arc's line plays under
  the fade.
- **Retime guard 0.5×–1.3×.** Beyond that a clip reads as slow-motion or a rushed cut. Trim
  from the front when the shot's value is its ending.
- **Closing shots hold a frame, never stretch.** Extract the last frame and freeze.

### Prompting Veo (see the `video-shot-prompts` skill for the full craft)

- One action and one camera move per clip; timestamp prompting is the sanctioned exception.
- Camera movement scales with re-staging risk: **lock off in a crowd**. A pull-back through
  a frame the model has to invent gave us two Pos and a burning tail.
- Constraints, not description: _"she remains seated on his back for the entire shot."_
- Affirmative phrasing in the body; bans only in `negativePrompt`. Writing "NO FIRE" in the
  body made the fire bigger. Twice.
- **A constraint cannot delete what the first frame contains.** Fix the plate.
- Never label the shot or quote dialogue in the prompt; it gets painted into the frame.
- Per-shot negative prompts: a show-wide ban on locomotion is right for tableaux and wrong
  for a chase.
- Chain depth ≤ 2, then reset to an approved painting via `lastFrame`.

### Reviewing

- **Strips, not playback.** Six frames side by side surfaced every defect the eye missed in
  motion: swords that shouldn't exist yet, duplicated characters, a face that flashed red.
- **Verify against the artifact the viewer gets.** `verify-sync` reads speech onsets from the
  render's own audio; `verify-picture` scans its frames for black. Both would have failed
  every broken cut we shipped; every check we had before them was looking at data, not at
  the film.
- The plate audit before generation is cheaper than the four re-rolls it prevents.

### Pipeline hygiene

- **Hash-keyed, immutable archives** of every paid output. A re-draft never destroys a take.
- **Fail fast before spending.** A missing keyframe once crashed a run three clips in — after
  two had been billed.
- Lite tier was good enough for the whole film. Final tier was never needed.
- Detach long generations with `nohup`; the tool's 10-minute cap kills them otherwise.
- zsh does not word-split unquoted variables; loops that "work in bash" silently do nothing.
- Version plates (`-v2`, `-v3`), never overwrite — the old plate is the record of what a
  shipped clip was made from.

### Music and cards

- A composed cue's _last strong moment_ is pinned to the end card; its faint decay is not.
  Measure it (`compose-music.ts` writes `landingSec`), never eyeball it.
- Under narration the bed sits around 0.13 (−21 dBFS mixed); under cards 0.4–0.6.
- Title type: a two-layer treatment (solid extrusion behind a gradient face) reads as
  lettering; a gradient alone floats on a painted sky.

---

## Scripts, in the order you use them

```
doctor.ts                tools, keys, permissions, Vertex access — before anything else
voice-audition.ts        audition candidates per role
script-to-dialogue.ts    episode script.md -> record-dialogue part files (explainer shows)
record-dialogue.ts       one continuous multi-voice take
force-align.ts           TRUE timestamps for the saved mp3
split-sentences.ts       sentence list from the script
align-sentences.ts       times each sentence; snaps starts to measured onsets; owns totalSec
word-cues.ts             per-word timings for component shots' anchors (explainer shows)
link-show.ts             once per show: makes art/ and cache/ reachable by the engine
check-retime.ts          every shot within 0.5x–1.3x; the music cue long enough to land
animate-shots.ts         Veo, tiered, cached, archived, chained; fail-fast guards
build-strips.ts          contact strips for review
extract-tail-frames.ts   hold frames for closing shots
compose-music.ts         instrumental underscore; measures where it lands
build-storyboard.ts      the shot book
verify-sync.ts           cuts vs speech onsets, on the render
verify-picture.ts        black frames, on the render
```
