# Research notes — video-shot-prompts

Techniques surveyed while authoring this skill, with verdicts and sources. Kept so a future
reader can see which rules came from Google's guidance, which were measured here, and what
was considered and passed over.

## Sources

- [Ultimate prompting guide for Veo 3.1](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1) — prompt anatomy, camera vocabulary, negative-prompt phrasing, first/last frame, timestamp prompting
- [Introducing Veo 3.1 (Gemini API)](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/) — reference images for cross-shot consistency
- [Best practices for Veo on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/best-practice)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills) — description/`when_to_use` authoring, progressive disclosure

## Adopted

| Technique | Origin | Note |
|---|---|---|
| Prompt anatomy collapses to action + camera for image-to-video | Google | Independently matches what we derived by failure |
| Don't re-describe what the source image already carries | Google | Softened with a narrow exception for low-salience props |
| Reference images (up to 3) for character consistency | Google | The intended fix for identity drift; not yet used on this show |
| Affirmative phrasing for constraints in the prompt body | Google | Corrects our earlier negation-heavy constraint blocks |
| Camera vocabulary (dolly/tracking/crane/aerial/pan/POV) | Google | Replaces improvised phrasing |
| First-and-last-frame interpolation | Google | Already implemented as `lastFrame` |
| Timestamp prompting for multi-beat shots | Google | The sanctioned exception to one-action-per-clip |
| Frame-exact tail chaining | Measured here | No official precedent found; worked on Arc A. Google's documented alternatives for the same job are first/last-frame and reference images |
| Restate physical relationships as requirements | Measured here | Description didn't survive; a rider detached from her mount mid-flight |
| Never label the shot or quote dialogue | Measured here | The model painted a shot slug into the frame |
| Camera movement scales with re-staging risk | Measured here | A compound move through a crowded grove re-staged the whole scene |

## Evidence behind the measured rules

All from *Alice in Dragonland*, Sequences A and B:

- **Costume drop-out** — 4 of 4 shots in the Sequence A test batch lost at least one item
  before an explicit continuity checklist existed (cloak and sword gone entirely; moss and
  wings faded to near-invisible).
- **Scene re-staging** — a wide → push → pan → settle across a crowded grove replaced the
  villagers, three background characters and the set with an empty simplified forest by the
  fourth frame.
- **Emotion drift** — "alarmed", "appalled", "recoils" produced a snarling, brow-down
  expression on a character written as timid.
- **Relationship loss** — "the girl on his back", stated once as description, ended with her
  detached and flying independently alongside him.
- **Burned-in caption** — a prompt opening `SHOT B3 — "Are you crazy?..."` painted that exact
  text across the bottom of the frame.
- **Motion streaks** — "the fields ripple" produced diagonal scratch-like artifacts across
  large grass areas.

## Considered, not adopted

- **Audio directives** (`SFX:`, quoted dialogue, ambient noise) — Veo can generate audio, but
  narration comes from ElevenLabs and `generateAudio` is always false here. Irrelevant while
  that holds.
- **A separate `references/` split** — content fits in one file well under the ~500-line
  guidance. Splitting would add indirection without reducing context cost.
