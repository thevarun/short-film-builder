# Alice in Dragonland — retrospective

3:55 finished film. 24 beats, 41 shots (39 live, 2 held paintings), 5 voices, 46 approved
plates, one composed cue. Built across three working sessions between 2026-07-20 and
2026-09-12; the film itself took roughly a session per two sequences once the pipeline
existed.

## What it cost

Counted from the immutable archives and cache, priced at published list rates
(Gemini API pricing page, ElevenLabs API pricing, 2026-09). Google Cloud ran on credits and
ElevenLabs on plan credits, so the cash figure is smaller than the list figure.

| Service | Usage | List price | Estimate |
|---|---|---|---|
| **Veo 3.1 Lite** (1080p) | 66 archived takes, 380 s of video | $0.08 / s | **$30** |
| **Veo 3.1 standard** (pre-tier smoke and directed tests) | ~6 takes, ~45 s | $0.40 / s | **$18** |
| **Gemini 3 Pro Image** (Nano Banana Pro, 2K) | 69 kept plates + ~10 rejected/overwritten ≈ 80 generations | $0.134 / image | **$10** |
| **ElevenLabs dialogue** (eleven_v3) | 2,852 chars across two takes + ~2,000 chars of auditions | $0.10 / 1K chars | **$0.50** |
| **Eleven Music** | 8.4 min composed (two takes) | $0.15 / min | **$1.25** |
| **Forced alignment** | 218 s of audio | Scribe rate, $0.22 / h | **$0.01** |
| | | | **≈ $60 at list** |

**Cash out of pocket: close to zero** — Veo and Gemini on Google Cloud credits, ElevenLabs on
plan credits (the dialogue and music together were well under one month's allowance).

**Claude Code** is the line I cannot see. This ran on a subscription, so the marginal cost is
flat; if it had been API-billed, the session transcript (48 MB, hundreds of turns, with
images and tool output) would have been the largest item by a wide margin — plausibly in the
low hundreds of dollars. The honest summary: the *media* cost about sixty dollars; the
*direction* was the expensive part, and it was prepaid.

Where the media money went: about **a third of the Veo spend was re-rolls** — 66 takes for
39 shots. Most were early (Arc A's prompt-craft learning) and every Arc B/C/D/E re-roll traced
to a rule that is now written down.

## What went wrong, once each

| Failure | Root cause | Now guarded by |
|---|---|---|
| Alice named with no Alice on screen; dragon under "never seen a dragon" | Beats split into equal fractions | Sentence-cut shots (`split-sentences`, `align-sentences`) |
| Every Arc B cut 2–4 s early, three "fixes" in a row | Dialogue-API alignment 4% short of the mp3 | `force-align.ts`; `verify-sync.ts` on the render |
| Alice carrying the sword 19 s before she's given it | Painted into four plates; constraints can't remove it | Plate audit in `shot-guide.md`; skill rule |
| Two Pos and a burning tail | Pull-back through a frame Veo had to invent | Locked camera in crowds; painted wides |
| Fire got *bigger* after banning it | Negation in the prompt body | Affirmative body; bans in `negativePrompt` only |
| Black second at 0:19, flickers at 0:35 and 1:03 | `trimAfter` applied without dividing by playback rate | `trimAfter` removed; `verify-picture.ts` |
| Silent end card, three times | Pinned the cue's decay, then its end, instead of its landing | `compose-music` measures `landingSec` |
| A2a at 2.4×, A4b at 1.64× | No guard on derived timings | `check-retime.ts` |
| Erik drawn as a child through three rounds | Style anchor said "large heads, small bodies" for *everyone* | Proportion rules by subject class |
| Generation crashed three clips in | Missing keyframe in a spec | Fail-fast guards in `animate-shots` |

## What worked first time

C3 (the eye), C5b (the fall out of frame), D2a (the catch), B5a/B5b (the mount and the
flight) — the four shots the film hangs on. 17 of 21 Sequence C/D/E clips passed on the
first roll, against roughly half in Arc A. The difference was the skill and the plate audit.
