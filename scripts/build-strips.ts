/**
 * Contact strips for reviewing generated clips.
 *
 * Watching nine clips end to end does not reliably surface the failures that matter — a
 * scene re-staging itself, a costume item dropping out, a character drifting off-model.
 * Those show up when you put six frames side by side. Every Arc A defect the review caught
 * was visible in a strip.
 *
 *   npx tsx scripts/build-strips.ts <show> AB B1 B2a ...
 *   npx tsx scripts/build-strips.ts <show> AB --arc B
 *   -> out/strips/<id>.png
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const [show, part] = argv.filter((a) => !a.startsWith("--"));
if (!show || !part) { console.error("usage: build-strips.ts <show> <part> [shotId ...] [--arc X]"); process.exit(1); }
const arcFlag = argv.indexOf("--arc");
const arc = arcFlag > -1 ? argv[arcFlag + 1]?.toUpperCase() : null;
const tier = argv.includes("--final") ? "final" : argv.includes("--fast") ? "fast" : "lite";

const CLIPS = join(ROOT, "cache", show, "motion");
const OUT = join(ROOT, "out", show, "strips");
const COLS = 6;

/** Working files are `<id>.<tier>.mp4`; the hash-suffixed siblings are immutable archives
 *  and would produce a strip per historical take. */
const working = (f: string) => /^[^.]+\.[a-z]+\.mp4$/.test(f);

// Drop the positional show/part and the value that belongs to --arc.
let ids = argv.filter((a, i) =>
  !a.startsWith("--") && a !== show && a !== part && i !== arcFlag + 1);
if (!ids.length) {
  ids = readdirSync(CLIPS)
    .filter((f) => working(f) && f.endsWith(`.${tier}.mp4`))
    .map((f) => f.split(".")[0]);
}
if (arc) ids = ids.filter((id) => id.toUpperCase().startsWith(arc));
ids = [...new Set(ids)].sort();

mkdirSync(OUT, { recursive: true });

for (const id of ids) {
  const clip = [`${id}.${tier}.mp4`, `${id}-approved.mp4`]
    .map((f) => join(CLIPS, f))
    .find(existsSync);
  if (!clip) { console.log(`${id.padEnd(5)} no clip`); continue; }

  const dur = Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip,
  ]).toString().trim());
  // Sample inside the clip rather than at its ends: the first and last frames are the
  // keyframes we already approved, so they tell us nothing about what Veo invented.
  const times = Array.from({ length: COLS }, (_, i) => (dur * (i + 0.5)) / COLS);

  const dest = join(OUT, `${id}.png`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", clip,
    "-vf", `select='${times.map((t) => `lt(abs(t-${t.toFixed(3)})\\,0.02)`).join("+")}',` +
      `scale=360:-1,tile=${COLS}x1`,
    "-frames:v", "1", "-fps_mode", "vfr", dest,
  ]);
  console.log(`${id.padEnd(5)} ${dur.toFixed(2)}s -> ${dest}`);
}
