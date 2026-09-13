/**
 * Splits a recorded script into the sentence list that shots are cut to.
 *
 * Output has the shape `align-sentences.ts` expects: one entry per sentence, in recording
 * order, text preserved exactly (audio tags included). Timings are placeholders until
 * `align-sentences.ts` fills them from the forced alignment — never cut to this file
 * before that has run.
 *
 * A line may hold several sentences ("Po! Can you take me…") and each becomes its own
 * entry, because the whole point of sentence-cutting is that a shot can change between
 * them. A leading audio tag stays attached to the first sentence of its line.
 *
 *   npx tsx scripts/split-sentences.ts <show> <part>
 *   -> shows/<show>/audio/<part>.sentences.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [show, part] = process.argv.slice(2);
if (!show || !part) { console.error("usage: split-sentences.ts <show> <part>"); process.exit(1); }
const AUDIO = join(ROOT, "shows", show, "audio");

interface Script { beats: { id: string; lines: { speaker: string; text: string }[] }[] }
const script = JSON.parse(readFileSync(join(AUDIO, `script-${part}.json`), "utf8")) as Script;

/** Split at sentence-ending punctuation, keeping the punctuation with its sentence. */
function sentences(text: string): string[] {
  const tag = text.match(/^\[[^\]]*\]\s*/)?.[0] ?? "";
  const body = text.slice(tag.length);
  const parts = body.match(/[^.!?]+[.!?]+(?:["”']+)?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [body];
  return parts.map((s, i) => (i === 0 ? tag + s : s));
}

const out = script.beats.flatMap((b) => b.lines.flatMap((l) =>
  sentences(l.text).map((text) => ({ start: 0, end: 0, text, speaker: l.speaker, beat: b.id })),
));

const dest = join(AUDIO, `${part}.sentences.json`);
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.length} sentences -> ${relative(ROOT, dest)}`);

for (const s of out) console.log(`  ${s.beat.padEnd(3)} ${s.speaker.padEnd(8)} ${s.text.slice(0, 70)}`);
