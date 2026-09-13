# Alice in Dragonland — Audio Script, Sequences A & B

Multi-voice, ElevenLabs `text-to-dialogue/with-timestamps` (eleven_v3).
This script is the **timeline source**. Nothing gets timed until this is recorded and
measured — durations below are estimates only and will be replaced by measured audio.

Text is **pre-normalized** (no digits, no abbreviations) so alignment indices match the
script exactly. Call TTS with `apply_text_normalization: "off"`.

---

## Casting

| Role | Voice qualities needed | Voice ID |
|---|---|---|
| **NARRATOR** | Warm, unhurried, read-aloud storyteller. Adult, gentle, slight smile in the voice. Not breathy, not theatrical | _TBD_ |
| **ALICE** | Bright, quick, nine years old. Eager and fearless. A real child timbre, not an adult doing a child voice | _TBD_ |
| **PO** | Soft, round, anxious. Gentle and a little wobbly. Comic worry, never gloomy | _TBD_ |
| **ERIK** | Adult man, mid-thirties. One line only, shouted — needs to carry real alarm | _TBD_ |

Vulcan and the crew are cast at Sequence D. Total voices stay well under the ten-voice cap.

> **Test one line per voice before recording the whole script.** Child voices are the
> hardest to get right, and Alice carries the film.

---

## Sequence A — Husk Village

**A1** · *est. 11 s*
> **NARRATOR:** In the far north of Norway stood a village called Husk. Every autumn, the
> whole village came together to bring in the harvest before the snow.

**A2** · *est. 16 s*
> **NARRATOR:** Alice was nine years old. High above the village was a cave, and in that cave
> lived dragons. Earth, water, stone, crystal, light. And last of all, the king of them all:
> fire.
>
> **NARRATOR:** Alice had never seen a dragon. She wanted to more than anything.

**A3** · *est. 8 s*
> **NARRATOR:** Every year, some of the harvest went to the forest spirits. The most important
> of these were the pandas.

**A4** · *est. 10 s*
> **NARRATOR:** Every panda had a power. Po's was flying. He was shy, and frightened of very
> nearly everything, which was exactly why Alice liked him best.

## Sequence B — The Alarm and the Bargain

**B1** · *est. 4 s*
> **ERIK:** The dragons are coming!

**B2** · *est. 8 s*
> **NARRATOR:** The whole village stopped. Then it ran. Everyone ran for home — and Alice ran
> the other way.

**B3** · *est. 9 s*
> **ALICE:** Po! Can you take me in the sky to see the dragons?
>
> **PO:** Are you crazy? You're going to get eaten by them.

**B4** · *est. 12 s*
> **NARRATOR:** Alice thought for a moment.
>
> **ALICE:** If you take me, I'll give you extra juicy bamboo.
>
> **PO:** I'll take you. But only if you keep this sword with you. Just in case.

**B5** · *est. 5 s*
> **NARRATOR:** So Alice climbed on. And they flew.

---

## Runtime note

Estimated A + B ≈ **83 seconds**, against the 67 seconds budgeted in the beat sheet.

The overrun is almost entirely beat A2, and it is deliberate. The list of dragon
types — *"earth, water, stone, crystal, light, and last but not the least the king of all
dragons FIRE"* — is one of the most characterful things in your niece's original text, and
compressing it to "dragons lived there" would cut the best line in her opening. I would rather
the film land at about **3:15 than 3:00** and keep her voice intact.

If you want the hard 3:00 back, the cheapest cut is A1 down to one sentence and A3 folded into
A4. Say the word.

## Author's verbatim lines preserved here

- *"The dragons are coming!"*
- *"can you take me in the sky to see the dragons?"*
- *"Are you crazy? You're going to get eaten by them."*
- *"I will take you but only if you keep this sword with you just in case."* (contracted to
  "I'll take you" for spoken rhythm — say the word if you want it exactly as written)

## Production settings

- Model: `eleven_v3` via `text-to-dialogue/with-timestamps`
- `apply_text_normalization: "off"`
- Pronunciation dictionary: add **Husk** and **Po** as aliases, both casings, before recording
- Output: `cache/alice-in-dragonland/audio/` (gitignored); alignment JSON is committed
