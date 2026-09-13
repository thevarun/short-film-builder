/**
 * Re-derives sentence spans from the measured ElevenLabs alignment.
 *
 * The sentences file was originally built by chaining each sentence's start to the previous
 * sentence's end. That is only correct when speech is continuous. On `eleven_v3` an audio
 * tag — `[alarmed]`, `[sly]`, `[breathless, excited]` — occupies real characters in the
 * alignment stream, so a tagged line's speech begins up to a second after the previous line
 * ended. Chaining put the shot on screen before its line was spoken; "I'll take you" was a
 * full second out.
 *
 * This finds each sentence's first SPOKEN character in the alignment and takes its real
 * time. Sentence text is preserved exactly, tags included — only the timings are rewritten.
 *
 *   npx tsx scripts/align-sentences.ts <show> <part>
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [show, part] = process.argv.slice(2);
if (!show || !part) { console.error("usage: align-sentences.ts <show> <part>"); process.exit(1); }

type Sentence = { start: number; end: number; text: string; speaker?: string; beat?: string };
const alignment = JSON.parse(readFileSync(
  join(ROOT, "cache", show, "audio", `${part}.alignment.json`), "utf8",
)) as {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

const stream = alignment.characters.join("");
const starts = alignment.character_start_times_seconds;
const ends = alignment.character_end_times_seconds;

const showFile = join(ROOT, "shows", show, "audio", `${part}.sentences.json`);
const sentences = JSON.parse(readFileSync(showFile, "utf8")) as Sentence[];

/** The spoken part of a line — everything after a leading `[tag]`. */
const spoken = (text: string) =>
  text.startsWith("[") ? text.slice(text.indexOf("]") + 1).trim() : text;

// Measured pauses in the recording. Forced alignment can stretch a short unstressed word
// ("And", "So") back into the silence before it, putting a sentence start half a second
// early. When a start lands inside a real pause, the word begins where the pause ends.
const mp3 = join(ROOT, "cache", show, "audio", `${part}.mp3`);
const det = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mp3,
  "-af", "silencedetect=noise=-36dB:d=0.08", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const pauseStarts = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const pauseEnds = [...det.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const pauses = pauseStarts.map((a, i) => [a, pauseEnds[i] ?? Infinity] as const);
const snapToOnset = (t: number) => {
  const inside = pauses.find(([a, b]) => a <= t && t < b);
  return inside && inside[1] - t < 0.8 ? inside[1] : t;
};

let cursor = 0;
let moved = 0;
const fixed = sentences.map((s, i) => {
  const probe = spoken(s.text);
  const at = stream.indexOf(probe, cursor);
  if (at < 0) throw new Error(`sentence ${i} not found in the alignment: ${probe.slice(0, 60)}`);
  cursor = at + probe.length;
  const start = snapToOnset(starts[at]);
  const end = ends[cursor - 1];
  const drift = start - s.start;
  if (Math.abs(drift) > 0.05) {
    moved++;
    console.log(
      `${String(i).padStart(2)} ${s.start.toFixed(2)} -> ${start.toFixed(2)}` +
      ` (${drift >= 0 ? "+" : ""}${drift.toFixed(2)}s)  ${probe.slice(0, 48)}`,
    );
  }
  // Keep whatever else the splitter recorded (speaker, beat) — only the timing is ours.
  return { ...s, start, end };
});

const json = `${JSON.stringify(fixed, null, 2)}\n`;
writeFileSync(showFile, json);

// The recording's total length comes from the audio file, never from an API's alignment —
// AB's came back 3.4s short and CDE's 0.5s short. Whoever derives the sentences owns this.
const timingsFile = join(ROOT, "shows", show, "audio", `${part}.timings.json`);
const timings = JSON.parse(readFileSync(timingsFile, "utf8")) as { totalSec: number };
const measured = Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
  join(ROOT, "cache", show, "audio", `${part}.mp3`),
]).toString().trim());
if (Math.abs(timings.totalSec - measured) > 0.01) {
  console.log(`totalSec ${timings.totalSec} -> ${measured.toFixed(2)} (measured from the mp3)`);
  timings.totalSec = Number(measured.toFixed(2));
  writeFileSync(timingsFile, `${JSON.stringify(timings, null, 2)}\n`);
}
console.log(`\n${moved} of ${fixed.length} sentence starts corrected -> ${showFile}`);
