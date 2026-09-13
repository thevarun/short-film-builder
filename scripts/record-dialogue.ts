/**
 * Records a multi-voice dialogue script as ONE continuous take and derives per-beat
 * timings from the returned character alignment.
 *
 * Run: npx tsx scripts/record-dialogue.ts <show> <part>
 *   e.g. npx tsx scripts/record-dialogue.ts <show> AB
 *
 * Why one take: eleven_v3 has no request-ID stitching, so rendering beat-by-beat lets
 * tone and energy drift between shots. One call keeps a single performance; beat
 * boundaries are recovered from the alignment instead.
 *
 * Outputs:
 *   cache/<show>/audio/<part>.mp3                 (gitignored)
 *   cache/<show>/audio/<part>.alignment.json      (gitignored, raw)
 *   shows/<show>/audio/<part>.timings.json        (COMMITTED — the timeline)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
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

const show = process.argv[2];
if (!show) { console.error("usage: record-dialogue.ts <show> <part>"); process.exit(1); }
const part = process.argv[3] ?? "AB";

interface Line { speaker: string; text: string }
interface Beat { id: string; lines: Line[] }
interface Script {
  model: string;
  voices: Record<string, { id: string; name: string }>;
  beats: Beat[];
}
interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const script: Script = JSON.parse(
  readFileSync(join(ROOT, "shows", show, "audio", `script-${part}.json`), "utf8"),
);

const inputs = script.beats.flatMap((b) =>
  b.lines.map((l) => {
    const v = script.voices[l.speaker];
    if (!v) throw new Error(`No voice cast for speaker "${l.speaker}"`);
    return { text: l.text, voice_id: v.id };
  }),
);

const res = await fetch("https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps", {
  method: "POST",
  headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    inputs,
    model_id: script.model,
    // Alignment indices must match script text exactly — CLAUDE.md invariant 5.
    apply_text_normalization: "off",
  }),
});
if (!res.ok) { console.error(res.status, await res.text()); process.exit(1); }
const data: any = await res.json();

const audioOut = join(ROOT, "cache", show, "audio");
mkdirSync(audioOut, { recursive: true });
writeFileSync(join(audioOut, `${part}.mp3`), Buffer.from(data.audio_base64, "base64"));

const al: Alignment = data.normalized_alignment ?? data.alignment;
writeFileSync(join(audioOut, `${part}.alignment.json`), JSON.stringify(al, null, 2));

/**
 * Walk the global alignment once, consuming each line's characters in order.
 * Audio tags like "[excited]" are consumed by the model and never appear in the
 * alignment, so they are stripped before matching. Matching is tolerant: a script
 * character that cannot be found within a short lookahead is skipped rather than
 * derailing every subsequent beat.
 */
const LOOKAHEAD = 60;
let ptr = 0;
function consume(text: string): { start: number; end: number } | null {
  const clean = text.replace(/\[[^\]]*\]/g, "");
  let start: number | null = null;
  let end: number | null = null;
  for (const ch of clean) {
    if (/\s/.test(ch)) continue;
    const limit = Math.min(al.characters.length, ptr + LOOKAHEAD);
    let found = -1;
    for (let i = ptr; i < limit; i++) {
      if (al.characters[i] === ch) { found = i; break; }
    }
    if (found < 0) continue;
    if (start === null) start = al.character_start_times_seconds[found];
    end = al.character_end_times_seconds[found];
    ptr = found + 1;
  }
  return start === null || end === null ? null : { start, end };
}

const beats = script.beats.map((b) => {
  const spans = b.lines.map((l) => ({ speaker: l.speaker, span: consume(l.text) }));
  const valid = spans.filter((s) => s.span) as { speaker: string; span: { start: number; end: number } }[];
  if (!valid.length) throw new Error(`Could not locate beat ${b.id} in alignment`);
  return {
    id: b.id,
    startSec: +valid[0].span.start.toFixed(3),
    endSec: +valid[valid.length - 1].span.end.toFixed(3),
    durationSec: +(valid[valid.length - 1].span.end - valid[0].span.start).toFixed(3),
    speakers: [...new Set(valid.map((v) => v.speaker))],
  };
});

const total = al.character_end_times_seconds[al.character_end_times_seconds.length - 1];
const timings = {
  show, part,
  audio: `cache/${show}/audio/${part}.mp3`,
  totalSec: +total.toFixed(3),
  fps: 30,
  beats,
};

const shotOut = join(ROOT, "shows", show, "audio");
mkdirSync(shotOut, { recursive: true });
writeFileSync(join(shotOut, `${part}.timings.json`), JSON.stringify(timings, null, 2));

console.log(`total ${timings.totalSec}s\n`);
for (const b of beats) {
  console.log(
    `${b.id.padEnd(3)} ${String(b.startSec).padStart(7)}s -> ${String(b.endSec).padStart(7)}s  ` +
    `${String(b.durationSec).padStart(6)}s  ${b.speakers.join(", ")}`,
  );
}
