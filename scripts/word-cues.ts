/**
 * Derives per-word timings from the forced alignment, so component shots can anchor a
 * visual to the spoken word ("38,852 km²" appears on "Thirty-eight", not at a guessed second).
 *
 * Words are whitespace-delimited runs of the aligned characters, punctuation kept (matching
 * normalises it away). Each word is tagged with the sentence it falls in, by start time.
 *
 * Run after `align-sentences`:
 *   npx tsx scripts/word-cues.ts <show> <part>
 *   -> shows/<show>/audio/<part>.words.json   (COMMITTED — part of the timeline)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [show, part] = process.argv.slice(2);
if (!show || !part) { console.error("usage: word-cues.ts <show> <part>"); process.exit(1); }

const al = JSON.parse(readFileSync(join(ROOT, "cache", show, "audio", `${part}.alignment.json`), "utf8")) as {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};
const sentences = JSON.parse(
  readFileSync(join(ROOT, "shows", show, "audio", `${part}.sentences.json`), "utf8"),
) as { start: number; end: number }[];

const sentenceAt = (t: number): number => {
  const inside = sentences.findIndex((s) => t >= s.start - 0.02 && t <= s.end + 0.05);
  if (inside >= 0) return inside;
  let last = 0;
  sentences.forEach((s, i) => { if (s.start <= t) last = i; });
  return last;
};

const words: { word: string; start: number; end: number; sentence: number }[] = [];
let cur = "";
let start = 0;
let end = 0;
const flush = () => {
  if (cur) words.push({ word: cur, start: +start.toFixed(3), end: +end.toFixed(3), sentence: sentenceAt(start) });
  cur = "";
};
// Sentence starts, measured: a word that straddles one ("Anamudi.Bottom-left" — the aligner
// joins lines without a space) is split where the next sentence's speech begins.
const boundaries = sentences.map((s) => s.start).sort((a, b) => a - b);
let nextBoundary = 0;
al.characters.forEach((ch, i) => {
  if (/\s/.test(ch)) { flush(); return; }
  const t = al.character_start_times_seconds[i];
  while (nextBoundary < boundaries.length && boundaries[nextBoundary] <= t - 0.02) nextBoundary++;
  if (cur && nextBoundary < boundaries.length && Math.abs(boundaries[nextBoundary] - t) < 0.02 && start < boundaries[nextBoundary] - 0.02) flush();
  if (!cur) start = t;
  cur += ch;
  end = al.character_end_times_seconds[i];
});
if (cur) words.push({ word: cur, start: +start.toFixed(3), end: +end.toFixed(3), sentence: sentenceAt(start) });

const dest = join(ROOT, "shows", show, "audio", `${part}.words.json`);
writeFileSync(dest, JSON.stringify(words, null, 2) + "\n");
console.log(`${words.length} words across ${sentences.length} sentences -> ${dest.replace(ROOT + "/", "")}`);
