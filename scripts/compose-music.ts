/**
 * Composes an instrumental underscore with ElevenLabs Music and caches it by content hash.
 *
 * The cue sits UNDER five voices of narration, so the brief matters more than the length:
 * sparse, slow, no percussion, room left for speech. The composition's own dynamics are not
 * relied on — Remotion mixes it at a fixed low level and fades it at both ends.
 *
 * Outputs (gitignored):
 *   cache/<show>/music/<name>.mp3            working file
 *   cache/<show>/music/<name>.<hash>.mp3     immutable archive of every take
 *
 *   npx tsx scripts/compose-music.ts <show> underscore 240000
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const [show, name = "underscore", lengthArg = "240000"] = process.argv.slice(2);
if (!show) { console.error("usage: compose-music.ts <show> [cue] [lengthMs]"); process.exit(1); }
const music_length_ms = Number(lengthArg);

const BRIEFS: Record<string, string> = {
  underscore:
    "Gentle, warm storybook underscore for a children's animated film set in autumn Norway. " +
    "Solo piano and soft legato strings, a hint of Nordic folk fiddle and harp. Slow and unhurried, " +
    "tender and hopeful with a quiet sense of wonder. Very sparse — long held notes, lots of space, " +
    "no percussion, no drums, no sudden swells. It must sit far in the background under spoken " +
    "narration for its whole length. Instrumental only. Ends with a soft, resolved final chord.",
  "geo-underscore":
    "Bright, curious documentary underscore for a fast-paced educational explainer about an Indian state. " +
    "Light, playful and modern: soft mallet percussion, plucked strings, a subtle tabla-like pulse and warm " +
    "synth pads, with a faint South Indian flavour (a hint of veena or bamboo flute) — never kitsch. Steady " +
    "medium tempo, unobtrusive, no melody that competes with speech. It must sit far in the background under " +
    "spoken narration for its whole length. Instrumental only. Ends with a light, resolved final chord.",
};
const prompt = BRIEFS[name];
if (!prompt) { console.error(`No brief named "${name}". Known: ${Object.keys(BRIEFS).join(", ")}`); process.exit(1); }

const body = { prompt, music_length_ms, force_instrumental: true, model_id: "music_v1" };
const key = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
const dir = join(ROOT, "cache", show, "music");
mkdirSync(dir, { recursive: true });
const working = join(dir, `${name}.mp3`);
const archive = join(dir, `${name}.${key}.mp3`);

/** Where the cue's sound actually stops. A composed take keeps a silent tail after its final
 *  chord, and the film aligns the cue's ENDING to the end card — so this number, not the file
 *  length, is what the composition reads. Written next to the show's other measured timings. */
function recordSoundEnd(file: string) {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file,
    "-af", "silencedetect=noise=-50dB:d=0.5", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const total = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim());
  // Trailing silence = a silence_start with no matching silence_end before the file ends.
  const tail = starts.length > ends.length || (starts.length && ends[ends.length - 1] >= total - 0.05)
    ? starts[starts.length - 1] : total;
  const lead = starts[0] === 0 ? ends[0] ?? 0 : 0;
  // Where the final chord LANDS: the last moment the cue is still strong (above -30 dB for
  // good). The film pins this to the end card, so the chord arrives on "Fin" and its decay
  // carries the picture out — pinning the faint end of the decay there left the card silent.
  const strong = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file,
    "-af", "silencedetect=noise=-30dB:d=1.0", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const strongStarts = [...strong.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const landing = strongStarts.length ? strongStarts[strongStarts.length - 1] : tail;
  const meta = { cue: name, durationSec: Number(total.toFixed(2)), soundStartSec: Number(lead.toFixed(2)),
    landingSec: Number(landing.toFixed(2)), soundEndSec: Number(tail.toFixed(2)) };
  const out = join(ROOT, "shows", show, "audio", `music-${name}.json`);
  writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`${name}  sound ${meta.soundStartSec}s -> ${meta.soundEndSec}s, final chord lands ${meta.landingSec}s  (${out.replace(ROOT + "/", "")})`);
}

if (existsSync(archive)) {
  copyFileSync(archive, working);
  console.log(`${name}  cached (${key}) -> ${working}`);
  recordSoundEnd(working);
  process.exit(0);
}

console.log(`${name}  composing ${(music_length_ms / 1000).toFixed(0)}s …`);
const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
  method: "POST",
  headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`music ${res.status}: ${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(archive, buf);
writeFileSync(working, buf);
console.log(`${name}  ok ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${working}  (archive ${key})`);
recordSoundEnd(working);
