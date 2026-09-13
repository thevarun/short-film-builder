---
name: video-shot-prompts
description: Rules for writing AI video-generation shot prompts (Veo image-to-video). Use when authoring or revising a shot's action/camera direction or a motion spec, and when generated clips go wrong — drifting off-model, re-staging the scene mid-clip, ignoring an instruction, or coming out as an animated still.
when_to_use: "Example triggers: 'write the Veo prompt for this shot', 'the clip changed location halfway through', 'the character went off-model', 'this feels like a moving painting', 'how do I join these two clips', editing shows/*/motion/motion-*.json"
---

# Video Shot Prompts

**Goal:** Write an image-to-video prompt that produces the shot you intended, on the first
or second try, without the cast drifting off-model.

Rules here were learned by getting shots wrong on *Alice in Dragonland* and cross-checked
against Google's Veo guidance. Sources are in `research-notes.md`.

---

## Division of labour

`scripts/animate-shots.ts` is the authority on **hard constraints** — clip durations, model
tiers, auth, chaining mechanics, caching. It validates and fails fast. Don't restate those
values as prose here; they will drift from the code.

This skill owns **craft**: what to put in the prompt and why.

---

## The rules

**Prompt what changes, not what's there.** The source image already carries subject, setting,
costume, palette and lighting. Re-describing them is generally unnecessary and can confuse the
model. Write the action and the camera; let the image do the rest.

*Narrow exception:* a few low-salience details do drop out across shots — a sword hilt, a moss
patch, small wings. Name **those specific items**, not the whole design.

**Reach for reference images before re-description.** Veo accepts up to three reference images
for character/object/scene consistency. That's the intended fix for identity drift.
Re-description is the fallback, not the first move.

**One action and one camera move per clip.** Six to eight seconds holds exactly that. A
three-beat arc plus a compound camera move is what makes the model re-stage the scene: it
invents everything entering frame, and the set, the crowd and the character designs all change
mid-clip. If a beat needs more, it needs more clips — or timestamp prompting (below).

**Camera movement scales with re-staging risk.** In a crowded frame — a village, a festival, an
ensemble — lock the camera off or push in almost imperceptibly. Save real movement for simple
frames: sky, a cave mouth, a two-shot. A large move through a busy set is the single most
reliable way to lose the scene.

**Phrase constraints affirmatively.** "A calm, gentle expression with a soft closed mouth"
holds; "never angry, never snarling" tends to surface the thing it forbids. Adjectives near
aggression — *alarmed, appalled, recoiling* — drift toward anger unless the positive is stated.

Keep the comma-separated ban list for the `negativePrompt` **parameter**, where that shape is
correct. The affirmative rule is about the prompt body.

**Restate physical relationships as requirements.** Description does not survive; constraints
do. "The girl on his back" was mentioned once and she detached mid-flight and flew alongside
him. Write it as a rule: *"She remains seated on his back for the entire shot and never
separates from him."* Same for blocking — *"Nobody walks or changes position; feet stay planted
and only heads, arms and wings move."*

**State completion, not just intent.** "She offers him the bamboo" gives you eight seconds of
offering. If the exchange must land, say so: *"By the end the bamboo is in his paws and her
hands are empty."*

**Never label the shot or quote dialogue in the prompt.** Opening with `SHOT B3 — "Are you
crazy?"` gets that caption painted across the bottom of the frame. Describe the moment; never
name it. Every prompt ends with an explicit no-text block, and `text, caption, subtitle,
words, letters, watermark, border` goes in the negative prompt.

**A constraint cannot delete what the first frame contains.** Constraints govern what the
model *does*; they have no power over what it was handed. A prompt reading *"no sword and no
weapon of any kind appears in this shot"* lost to a sword painted into the source plate, in
five clips out of five. If a prop, a character or a piece of set is wrong, fix the painting —
an edit-mode repaint that touches only that element — and regenerate. Before generating a
sequence, audit each plate for props that belong to a *later* beat: art gets painted
beat-by-beat and it is easy to hand a character the thing they have not been given yet.

**Give framing in shot language.** "A wide establishing shot" of a character moment buries the
character. Say *"she fills the left half of the frame, seen from the shins up."*

---

## Camera vocabulary the model responds to

Movement: `dolly` · `tracking shot` · `crane shot` · `aerial view` · `slow pan` · `POV shot`
Composition: `wide shot` · `medium shot` · `close-up` · `extreme close-up` · `low angle` · `two-shot`
Lens: `shallow depth of field` · `wide-angle lens` · `soft focus` · `deep focus`

Prefer these over improvised phrasing — they're terms the model was trained on.

---

## Prompt shape

For image-to-video the full five-part anatomy (cinematography, subject, action, context,
style) collapses to two, because the last three come from the image:

```
ACTION      what changes from the first second to the last
CAMERA      one move, in the vocabulary above
CONSTRAINTS physical relationships, blocking, emotional range, items that must persist
NO-TEXT     explicit block forbidding captions and lettering
```

`scripts/animate-shots.ts` assembles these from `action`, `camera` and `constraints` fields, appends
the show's style suffix, and sends `negativePrompt` separately.

---

## Joining shots

Ranked by how invisible the seam is:

1. **Frame-exact chaining** — extract the previous clip's actual final frame and use it as the
   next clip's first frame. The seam is literally the same image, so it needs **no crossfade**.
   Cap at two or three links: drift compounds, and each clip inherits the last one's errors.
   Reset to a painted keyframe at every new location.
2. **First-and-last-frame** — give both ends; the model invents the move between two approved
   compositions. Google's documented technique for controlled transitions.
3. **Eyeline match** — a character looks off-frame, the next shot travels where they looked.
   Free, and it makes a cut feel motivated.
4. **Deliberate hard cut** — where contrast is the point, a clean cut beats any blend.

Two rules that chaining can't rescue: never flip direction of travel across a chained join,
and never chain a locked-off shot into a fast push. The seam will match and still jolt.

---

## When one action isn't enough

**Timestamp prompting** assigns actions to time segments inside a single generation:

```
[00:00-00:02] Medium shot, she lifts her head and looks up
[00:02-00:05] Crane up and right, the village falling away below
[00:05-00:08] The cave mouth fills frame, smoke drifting from it
```

This is the sanctioned way to exceed one action — not a licence to ignore the rule. Use it for
a deliberately multi-beat shot, not to cram a sequence into one clip.

---

## Failure signatures

| What you see | Cause | Fix |
|---|---|---|
| Scene cuts to a different place mid-clip | Camera move too large for a busy frame | Lock the camera off; split the shot |
| Character loses props, moss, wings, costume | Low-salience detail not named | Reference images; name the specific items |
| Gentle character reads as angry | Negation in the body ("never angry") | State the positive expression |
| Two characters separate who shouldn't | Relationship described, not required | Write it as a rule that holds throughout |
| Caption burned into the frame | Shot label or quoted dialogue in the prompt | Describe, don't name; no-text block |
| Looks like a moving painting | Prompt suppressed camera movement | Give it one real move |
| Streaks or scratch lines across surfaces | Motion words like "ripple" on large areas | "sways gently"; ban streaks and trails |
| Ending feels rushed | Clip retimed far from 1× to fill its window | `npx tsx scripts/check-retime.ts` |
| A banned prop is in the clip anyway | It was painted into the first frame | Repaint the plate; the constraint cannot win |
| Two of a character who should be one | A camera move widened into space the model had to invent | Paint the wide; lock the camera; cut instead of chaining |
| A ban in the prompt body made the thing appear | Negation surfaces its object — "no fire" puts fire in mind | Describe the wanted frame in the body; bans go only in `negativePrompt` |
| Crowd action is unreadable | Plate too wide — figures too small to see act | Repaint closer, not a different direction |

---

## Show-specific material

Per-show rules live with the show, not here:

- `shows/<slug>/shot-guide.md` — continuity checklist, beat→plate→cast map
- `shows/<slug>/transitions.md` — that show's join map
- `shows/<slug>/motion-plan.md` — which shots are live vs. 2.5D, and why

---

## Test prompts

Should handle:
- "Write the Veo prompt for beat C3 — Vulcan sees them"
- "This clip cut to a different location halfway through"
- "Po came out angry instead of shy"
- "How do I make these two shots join seamlessly?"
- "Why does this feel like an animated still rather than a shot?"

Should not trigger:
- "Write the narration for Sequence C" — script writing
- "Render Arc B and compress it" — Remotion and ffmpeg
