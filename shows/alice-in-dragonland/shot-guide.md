# Alice in Dragonland — Shot Production Guide

Written after the Sequence A test batch. These rules exist because each one was learned by
getting a shot wrong first.

---

## The continuity checklist

**Append this block verbatim to every shot prompt.** The character sheets do not encode
costume completeness or scale, so the model silently drops them. Four of four test shots lost
at least one item before this checklist existed.

> CONTINUITY REQUIREMENTS — verify every one of these appears:
> - **Alice** wears ALL of: white blouse, green embroidered bodice, ankle-length black skirt
>   with red-and-white folk trim, belt pouch, buckled shoes, single dark braid,
>   **rust-orange half-cloak clasped at one shoulder**, and **one wooden-handled sword in a
>   leather scabbard across her back** (until beat D4, after which the sword is gone forever).
> - **Po** has ALL of: cream-and-charcoal panda markings, **defined green moss across his
>   shoulders**, **two clearly glowing gold leaf-shaped spirit wings**, a soft gold aura.
>   He is **1.5× Alice's height** — head and shoulders above her, big enough to ride.
> - **Erik** has ALL of: moss-green gambeson, brown leather chest-guard with brass studs,
>   rust-orange cloak, brass spyglass, signal horn across the chest, spear. Adult
>   proportions, ~8 heads tall.
> - **Vulcan** is **8× Alice's height**. **Crew dragons** are 4× Alice's height.
> - All adult humans use realistic adult proportions. Only children and creatures use
>   large-head picture-book proportions.

## Input images per shot

Three input slots, and all three matter. Standard allocation:

| Slot | Use |
|---|---|
| 1 | The location plate for this beat |
| 2 | The primary character's sheet |
| 3 | The secondary character's sheet — **or `scale-sheet-v2.png` when two characters of very different sizes share the frame** |

Any shot pairing a human with a dragon must spend slot 3 on the scale sheet. Without it the
dragons shrink toward human size every time.

## Rules learned from the test batch

1. **State scale numerically, never descriptively.** "A head taller" produced a panda twice
   Alice's height. "The top of her head reaches his chin" worked. Give the model a geometric
   relationship it can measure, not an adjective.
2. **Magic markers fade.** Po's glowing wings and moss came out almost invisible in two of two
   shots that didn't explicitly demand them. Always call them out as *clearly visible* and
   *distinctly glowing*.
3. **Editing an existing shot is better than regenerating it** when the composition is right
   and only details are wrong — the reverse of the character-sheet rule, where editing
   inherited bad anatomy. Compose first, correct second.
4. **Background plates get rearranged.** The model treats a plate as a strong suggestion, not
   a matte. Village layouts shifted between the plate and A1. Acceptable — palette, style and
   mood carried perfectly, which is what actually matters for continuity — but do not expect
   pixel-locked backgrounds.
5. **Verify at full resolution.** Missing swords and cloaks are invisible in a thumbnail.
6. **Never put the shot label or quoted dialogue in the prompt.** Starting a prompt with
   `SHOT B3 — "Are you crazy?..."` made the model paint that exact caption across the bottom
   of the frame. Describe the moment; never name it. Every prompt ends with the no-text block
   below.
7. **Name characters by description, not by name.** "Alice" and "Po" invite the model to
   invent its own idea of those characters; "the girl" and "the panda" plus the reference
   image keep it locked to the sheets.
8. **State the framing explicitly, in shot-language.** "A wide establishing shot" of a
   character moment buries the character. Say *"she fills the left half of the frame, seen
   from the shins up."* B2 had to be redone for exactly this.

## The no-text block

Append verbatim to every shot prompt:

> CRITICAL: NO WRITING OF ANY KIND. No caption, subtitle, title, dialogue, letters, words,
> numbers, signature, border or frame. Pure illustration, edge to edge.

And in the negative prompt: `text, caption, subtitle, title, words, letters, numbers,
writing, signature, watermark, label, border, frame, speech bubble`.

## Chaining

After the first shot in a location, use the **previous approved shot** as input slot 1 rather
than the raw plate. It carries location, palette, style *and* the established characters in
one image, which frees the other two slots and keeps continuity tighter than the plate alone.
Sequence B was built this way: B3 → B4 → B5 each chained off its predecessor.

## Beat → plate → cast map

| Beat | Plate | Characters | Notes |
|---|---|---|---|
| A1 | 01 village | villagers, Erik (distant) | Erik is the only one not celebrating |
| A2 | 04 cave | Alice | Vulcan's eye only, never a full dragon |
| A3 | 03 grove | villagers, 4 pandas | ritual, reverent |
| A4 | 03 grove | Alice, Po, 3 pandas, villagers | **the friendship shot** |
| B1 | 02 watchtower | Erik | the shout |
| B2 | 01 village | villagers, Alice | Alice runs against the crowd |
| B3–B4 | 03 grove | Alice, Po | the bargain |
| B5 | 03 → 05 | Alice, Po | takeoff |
| C1 | 05 → 06 | Alice, Po | wonder, then dread |
| C2 | 06 | Alice, Po | "trust me" |
| C3 | 06 | Vulcan (fierce) | **scale sheet required** |
| C4 | 06 | Vulcan, crew | chase reads as play on rewatch |
| C5 | 07 high sky | Alice, Po | the fall |
| D1–D2 | 07 | Alice, Po, Vulcan, crew | the catch |
| D3–D4 | 07 | Alice, Vulcan | **state switch inside D4** |
| D5–D7 | 07 | Alice, Vulcan (friendly), crew | light warms through these |
| E1–E3 | 01 village | everyone | warmest grade of the film |

## Plate audit — run before generating any sequence

Keyframes get painted beat by beat, and a plate painted for a late beat will happily be
reused as the first frame of an early one. Arc B shipped with Alice carrying Po's sword from
0:57, nineteen seconds before he gives it to her, in four separate plates. The prompts for
those shots explicitly banned a weapon; it made no difference, because a constraint governs
what Veo *does*, not what it was handed.

Before generating, open each plate for the sequence and check:

- **Props that belong to a later beat.** Does anyone hold, wear or carry something they have
  not been given yet in the narration? Cross-check against the sentence that introduces it.
- **Characters who have not arrived yet.** Same rule — a character visible before the line
  that names them is the Arc A version of this mistake.
- **Legibility at the framing chosen.** If the beat is an action performed by a crowd, the
  figures must be big enough to read it. A distant panorama plays as ambient bustle no matter
  what the prompt asks for.
- **Damage.** The governing rule for this show is that nothing burns and nothing is broken.

Fix a bad plate with an edit-mode repaint that names the one element to remove and lists
everything that must stay identical. Version it (`-v2`, `-v3`) rather than overwriting — the
old plate is the only record of what a shipped clip was made from.
