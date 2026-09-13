/**
 * Checks a RENDERED film for picture faults the audio check cannot see: stretches of black
 * or near-black frames where a shot should be on screen.
 *
 * Why: a trimmed clip played under 1x went black for the last third of its window, and every
 * existing check passed — retimes were in bounds, audio was in sync. Nothing looked at the
 * frames. This does, with ffmpeg's blackdetect, and reports every dark run that is not one
 * of the places the film is *meant* to be dark: the first and last fades, and the end card.
 *
 *   npx tsx scripts/verify-picture.ts out/<show>/film/film-v5.mp4 --comp AliceFilm
 *
 * With `--comp`, a whole-film composition allows everything after its last recording (the
 * end card, the credits, the fades between them) to be dark; the numbers come from the same
 * layout the render used. `--allow-head`/`--allow-tail` override by hand.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filmLayout } from "../engine/src/film/timeline.js";
import { findFilmComposition } from "./lib/film.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
if (!file) { console.error("usage: verify-picture.ts <render.mp4> [--comp Id] [--allow-head s] [--allow-tail s]"); process.exit(1); }
const flag = (name: string, dflt: number) => {
  const i = argv.indexOf(name); return i > -1 ? Number(argv[i + 1]) : dflt;
};
const compArg = argv.indexOf("--comp") > -1 ? argv[argv.indexOf("--comp") + 1] : undefined;
const whole = compArg ? findFilmComposition(compArg) : undefined;
// Everything after the last recording — end card, credits, the fades between — is meant to be dark.
const tailFromLayout = whole ? (() => {
  const l = filmLayout(whole.film);
  const last = l.parts[l.parts.length - 1];
  return l.totalSec - (last.from + last.durationInFrames) / whole.film.spec.fps + 0.1;
})() : undefined;
const allowHead = flag("--allow-head", 1.2);   // the opening fade-in
const allowTail = flag("--allow-tail", tailFromLayout ?? 1.5);   // the closing fade-out
const MIN_RUN = 0.12;                           // anything shorter is a legitimate hard cut through dark

const path = join(ROOT, file);
const dur = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
  { encoding: "utf8" }).stdout.trim());
const log = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path,
  "-vf", `blackdetect=d=${MIN_RUN}:pix_th=0.12:pic_th=0.96`, "-f", "null", "-"], { encoding: "utf8" }).stderr;

const runs = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)]
  .map((m) => ({ start: Number(m[1]), end: Number(m[2]), len: Number(m[3]) }))
  .filter((r) => r.end > allowHead && r.start < dur - allowTail);

console.log(`${file}  ${dur.toFixed(2)}s  (ignoring the first ${allowHead}s and last ${allowTail.toFixed(1)}s)\n`);
if (!runs.length) { console.log("no black frames where a shot should be on screen."); process.exit(0); }
for (const r of runs) {
  console.log(`  BLACK ${r.start.toFixed(2)}–${r.end.toFixed(2)}  (${r.len.toFixed(2)}s)  <<<`);
}
console.error(`\n${runs.length} black run(s) inside the picture.`);
process.exit(1);
