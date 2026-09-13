/**
 * Re-aligns a recording against its transcript with ElevenLabs forced alignment, replacing
 * the alignment the dialogue API returned at recording time.
 *
 * Why: the dialogue API's alignment for AB ended at 85.92s, but the mp3 it came with is
 * 89.36s long. Every timestamp was ~4% short, so every cut drifted earlier and earlier —
 * two seconds by the end of Sequence A, three and a half by the end of B. Forced alignment
 * measures the audio we actually have, so its timestamps are true by construction.
 *
 * Outputs (all under cache/, gitignored):
 *   <part>.forced-alignment.raw.json   the API response, untouched
 *   <part>.alignment.json              same shape the rest of the pipeline reads
 * The recording-time alignment is preserved as <part>.alignment.dialogue-api.json.
 *
 *   npx tsx scripts/force-align.ts <show> <part>
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = join(ROOT, ".env");
if (!process.env.ELEVENLABS_API_KEY && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY not set."); process.exit(1); }

const [show, part] = process.argv.slice(2);
if (!show || !part) { console.error("usage: force-align.ts <show> <part>"); process.exit(1); }
const AUDIO_DIR = join(ROOT, "cache", show, "audio");
const mp3 = join(AUDIO_DIR, `${part}.mp3`);
const alignmentFile = join(AUDIO_DIR, `${part}.alignment.json`);
const original = join(AUDIO_DIR, `${part}.alignment.dialogue-api.json`);

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

// The transcript is whatever was sent to TTS, minus the audio tags — `[alarmed]` steers the
// performance but is never spoken, and forced alignment must only see spoken text.
if (!existsSync(original)) copyFileSync(alignmentFile, original);
const sent = JSON.parse(readFileSync(original, "utf8")) as Alignment;
const text = sent.characters.join("").replace(/\[[^\]]*\]\s*/g, "");

const realDuration = Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3,
]).toString().trim());
const claimed = sent.character_end_times_seconds.at(-1) ?? 0;
console.log(`recording ${realDuration.toFixed(2)}s · dialogue-API alignment ends ${claimed.toFixed(2)}s` +
  ` · ratio ${(realDuration / claimed).toFixed(4)}`);

const form = new FormData();
form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), `${part}.mp3`);
form.append("text", text);

const res = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
  method: "POST",
  headers: { "xi-api-key": API_KEY },
  body: form,
});
if (!res.ok) {
  console.error(`forced-alignment ${res.status}: ${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}
const raw = (await res.json()) as {
  characters: { text: string; start: number; end: number }[];
  words: { text: string; start: number; end: number; loss: number }[];
  loss: number;
};
writeFileSync(join(AUDIO_DIR, `${part}.forced-alignment.raw.json`), JSON.stringify(raw));

const forced: Alignment = {
  characters: raw.characters.map((c) => c.text),
  character_start_times_seconds: raw.characters.map((c) => c.start),
  character_end_times_seconds: raw.characters.map((c) => c.end),
};
writeFileSync(alignmentFile, JSON.stringify(forced));

const last = forced.character_end_times_seconds.at(-1) ?? 0;
console.log(`forced alignment: ${raw.characters.length} chars, ${raw.words.length} words,` +
  ` ends ${last.toFixed(2)}s, loss ${raw.loss.toFixed(3)}`);
console.log(`-> ${alignmentFile}`);
if (Math.abs(realDuration - last) > 1.5) {
  console.warn(`WARNING: alignment ends ${(realDuration - last).toFixed(2)}s before the audio does — check the transcript`);
}
