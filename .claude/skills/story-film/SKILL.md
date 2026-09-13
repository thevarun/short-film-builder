---
name: story-film
description: Animate a written story into a narrated film — cast, beats, plates, one continuous voice take, force-aligned timeline, Veo shots cut to sentences, reviewed strips, verified renders. Run at the start of a new story and resume at any stage.
when_to_use: "/story-film <path-to-story> [show-slug]; 'animate this story', 'make a film from my niece's story', 'continue the film at the shot plan stage'"
disable-model-invocation: true
---

# Story → Film

Turn `$ARGUMENTS` (a story file, optionally a show slug) into a finished film under
`shows/<slug>/`, following `docs/animated-story-pipeline.md`. Twelve stages; each ends at a
**gate the user passes explicitly** before the next begins. Every expensive mistake on the
first film came from skipping one.

## Stance

- The author's words are the script. Adapt narration; never cut a verbatim line without asking.
- Review before spend. Plates are painted only after the shot plan is confirmed; clips are generated only after the plate audit; nothing is rendered "final" until the checks pass on the file.
- Show evidence, not assertions: strips for clips, `verify-sync` and `verify-picture` output for renders, `volumedetect` numbers for the mix.
- Use lite tier throughout unless the user asks otherwise; it was enough for a whole film.

## Stages

0. **Doctor** → `npx tsx scripts/doctor.ts` prints no ✗. Keys are the user's to paste; tell them the page, never the value. Gate: green.
1. **Read & cast** → `character-bible.md`. Canonical heights; proportion rules *by subject class*; a locked style anchor. Gate: intent confirmed.
2. **Character sheets** → `art/characters/`. Generate adults fresh (edit mode inherits child anatomy). Gate: each approved.
3. **Beat sheet** → `beat-sheet.md` with verbatim lines, runtime budget, the governing world rule. Gate: runtime and adaptation agreed.
4. **Location bible** → `art/locations/`, one master plate per place. Gate: approved.
5. **Audio script** → `audio-script-*.md` + `audio/script-*.json`, pre-normalised, with audio tags. Audition new voices with `voice-audition.ts`. Gate: cast chosen, script read once.
6. **Record & align** → `record-dialogue` → `force-align` → `split-sentences` → `align-sentences`. Gate: **the user listens to the take** and accepts the runtime.
7. **Shot plan** → `shot-plan-*.md`: shots cut to sentence spans, live vs 2.5D, joins, plates needed. Gate: confirmed.
8. **Plates** → `art/shots/`, in story order, each referencing the last. Then the **plate audit**: props from a later beat, characters not yet introduced, legibility, nothing that breaks the world rule. Gate: audit clean.
9. **Shot specs** → `motion/motion-*.json` per the `video-shot-prompts` skill, and the cut in `film.json` (schema `schemas/film.ts`; `link-show` once). Gate: `check-retime <slug>` passes.
10. **Generate** → `animate-shots` (detach with `nohup` for more than a few clips). Review **every** clip as a strip (`build-strips`) against the audit rules; re-roll what fails, fixing the plate when the plate is the cause. Gate: strips reviewed.
11. **Compose & render** → `<Id>Arc<X>`, then `<Id><Part>`, then `<Id>Film`, all from `film.json`. Gate: `verify-sync` and `verify-picture` pass on each render.
12. **Finish** → `cards` and `music` in `film.json` (title, Fin, credits), `compose-music` long enough to land under the credits (`check-retime` says), mix levels measured. Gate: the user watches the whole film.

## When resuming

Read `shows/<slug>/` first: which artifacts exist tells you the stage. Re-run the gate for the
last completed stage rather than trusting it.

## References

- Process and learnings: `docs/animated-story-pipeline.md`
- Prompt craft: the `video-shot-prompts` skill
- Worked example, with costs and post-mortems: `shows/alice-in-dragonland/retrospective.md`
