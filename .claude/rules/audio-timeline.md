---
paths:
  - "scripts/**"
  - "shows/**/audio/**"
  - "shows/**/motion/**"
---

# Audio is the timeline

- The API's returned alignment is **not** the timeline; the saved mp3 is. `record-dialogue` → `force-align` → `split-sentences` → `align-sentences`, in that order, before anything is cut. (AB's dialogue-API alignment ran 4% short of its audio.)
- A sentence starts at its first *spoken* character. Audio tags (`[alarmed]`) occupy real time; `align-sentences` also snaps a start that lands inside a measured pause forward to where speech resumes (forced alignment stretches "And", "No" back into silence).
- A shot runs from its line's start to the *next shot's* line start. Trailing pauses belong to the outgoing image.
- Arc boundaries are the middle of the measured silence between two lines, derived from the sentences — never a literal.
- `totalSec` in `*.timings.json` is the mp3's `ffprobe` duration; `align-sentences` owns it.
- Retime guard: every clip plays between 0.5× and 1.3× (`check-retime`). Trim from the front when a shot's value is its ending.
- Veo shot specs: one action and one camera move per clip; constraints not description; affirmative body, bans only in `negativePrompt`; per-shot negatives for shots whose content is locomotion. Details in the `video-shot-prompts` skill.
- Any shot that needs a first frame must have `keyframe` or `chainFrom`; `animate-shots` refuses to start otherwise.
