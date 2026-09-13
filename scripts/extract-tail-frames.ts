/**
 * Pulls the final frame of a shot's usable range out to a PNG, so a composition can freeze
 * on it.
 *
 * A closing shot has to cover the silent tail after the last word. Stretching the clip to
 * fill it drags the playback rate toward slow-motion — Arc A's closer reached 0.55x, and the
 * tail only grows. Freezing on the shot's own last frame holds the image without touching
 * the speed of anything that moves.
 *
 * Generated files are gitignored like every other clip artifact; re-run after regenerating
 * a closing shot.
 *
 *   npx tsx scripts/extract-tail-frames.ts <show> A4b B5b
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFilm } from "./lib/film.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
if (argv.length < 2) { console.error("usage: extract-tail-frames.ts <show> <shotId> ..."); process.exit(1); }
const tier = argv.includes("--final") ? "final" : argv.includes("--fast") ? "fast" : "lite";
const [show, ...ids] = argv.filter((a) => !a.startsWith("--"));
const CLIPS = join(ROOT, "cache", show, "motion");
const SHOTS = loadFilm(show).spec.shots;

for (const id of ids) {
  const shot = SHOTS.find((s) => s.id.toLowerCase() === id.toLowerCase());
  if (!shot?.video) { console.error(`${id}  no such shot, or it has no clip`); continue; }

  const clip = join(CLIPS, shot.video.replace(/^.*\//, ""));
  if (!existsSync(clip)) { console.error(`${id}  missing ${clip}`); continue; }

  // Seek to the end of the shot's USABLE range, not the end of the file — a trimmed shot
  // never reaches the frames past its trim, so its last frame is at trim[1].
  const at = shot.trim ? shot.trim[1] : (shot.clipSeconds ?? 0);
  const out = join(CLIPS, "_frames", `${shot.id}.hold.png`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-ss", String(Math.max(0, at - 0.05)), "-i", clip,
    "-frames:v", "1", out,
  ]);
  console.log(`${shot.id.padEnd(5)} frame at ${at.toFixed(2)}s -> ${out}`);
}
void tier;
