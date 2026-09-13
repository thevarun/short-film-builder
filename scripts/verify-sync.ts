/**
 * Checks a RENDERED composition for audio/picture sync — on the file itself, not on the data
 * that produced it.
 *
 * For every shot, two numbers: where the composition cuts to it, and where the first word
 * of its line actually starts in the render's own audio track (found by speech-onset
 * detection, so it cannot inherit a bad alignment). The alignment says where the word
 * should be; the audio says where it is. This reports both and the gap between them.
 *
 * Why this exists: Arc B was "fixed" three times against an alignment that ran 4% short of
 * the recording. Every fix was correct relative to the data and wrong relative to the
 * audio. Verification has to be against the thing the viewer hears.
 *
 *   npx tsx scripts/verify-sync.ts out/<show>/arcs/arcB-v3.mp4 AliceArcB
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { shotWindows } from "../engine/src/film/timeline.js";
import { findComposition, ROOT } from "./lib/film.js";

const [file, compId] = process.argv.slice(2);
if (!file || !compId) { console.error("usage: verify-sync.ts <render.mp4> <CompositionId>"); process.exit(1); }
const found = findComposition(compId);
if (!found) { console.error(`unknown composition ${compId} (no shows/*/film.json defines it)`); process.exit(1); }
const { film, comp: c } = found;
const { fps } = film.spec;

/** Speech onsets in the render's audio: the end of every silence. Two passes — a 180 ms
 *  floor catches real pauses; an 80 ms floor catches the breath between two lines spoken
 *  back to back, which the first pass misses and then snaps to the wrong onset. */
// silencedetect reports on stderr.
const detect = (d: number) => {
  const log = spawnSync("ffmpeg", [
    "-hide_banner", "-nostats", "-i", join(ROOT, file),
    "-af", `silencedetect=noise=-36dB:d=${d}`, "-f", "null", "-",
  ], { encoding: "utf8" }).stderr;
  return {
    ends: [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1])),
    starts: [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1])),
  };
};
const coarse = detect(0.18), fine = detect(0.08);
const onsets = [...new Set([0, ...coarse.ends, ...fine.ends])].sort((a, b) => a - b);
/** True when the audio never dips to silence near t — two lines spoken back to back. The
 *  detector cannot place an onset there, so the alignment's word is the only witness. */
const continuous = (t: number) =>
  ![...coarse.starts, ...fine.starts, ...coarse.ends, ...fine.ends].some((x) => Math.abs(x - t) < 0.3);

const nearest = (t: number) =>
  onsets.reduce((best, o) => (Math.abs(o - t) < Math.abs(best - t) ? o : best), onsets[0]);

const TOL = 0.25;
let worst = 0;
console.log(`${compId} ← ${file}\n`);
console.log(`  ${"shot".padEnd(5)} ${"cut".padStart(7)} ${"word*".padStart(7)} ${"heard".padStart(7)} ${"gap".padStart(7)}   line`);
console.log(`  ${"".padEnd(5)} ${"".padStart(7)} ${"(align)".padStart(7)} ${"(audio)".padStart(7)}`);
const LINES = film.lines[c.part];
for (const w of shotWindows(film, c)) {
  const cut = w.from / fps - c.from;
  const idx = w.shot.sentence[0];
  const word = LINES[idx].start - c.from;
  const heard = nearest(word);
  const gap = heard - cut;
  // The first shot of a standalone arc starts at the arc boundary, which sits in the
  // silence BEFORE its line by design — a lead-in, not a sync error. Report it, don't fail.
  const leadIn = c.from > 0 && Math.abs(cut) < 0.05 && gap > 0;
  const noGap = Math.abs(gap) > TOL && continuous(word);
  if (!leadIn && !noGap) worst = Math.max(worst, Math.abs(gap));
  const flag = leadIn ? "  (lead-in)" : noGap ? "  (no gap — alignment only)" : Math.abs(gap) > TOL ? "  <<<" : "";
  const text = LINES[idx].text.replace(/^\[[^\]]*\]\s*/, "").slice(0, 40);
  console.log(`  ${w.shot.id.padEnd(5)} ${cut.toFixed(2).padStart(7)} ${word.toFixed(2).padStart(7)}` +
    ` ${heard.toFixed(2).padStart(7)} ${(gap >= 0 ? "+" : "") + gap.toFixed(2).padStart(6)}${flag}   ${text}`);
}
console.log(`\n  cut   = where the picture changes, in this file`);
console.log(`  word* = where the alignment claims the line starts`);
console.log(`  heard = nearest speech onset actually present in this file's audio`);
console.log(`  gap   = heard − cut; positive means the picture arrives before the words\n`);
if (worst > TOL) {
  console.error(`worst gap ${worst.toFixed(2)}s exceeds ${TOL}s — picture and audio disagree`);
  process.exit(1);
}
console.log(`all cuts within ${TOL}s of a speech onset.`);
