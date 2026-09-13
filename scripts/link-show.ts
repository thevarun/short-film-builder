/**
 * Makes a show's media reachable by the engine. Remotion serves `staticFile()` from
 * `engine/public/`, so each show gets two symlinks there: `art` (the committed plates) and
 * `cache` (generated audio, clips, music). Idempotent; run once per show, or after a clone.
 *
 *   npx tsx scripts/link-show.ts <show>
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const show = process.argv[2];
if (!show || !existsSync(join(ROOT, "shows", show))) {
  console.error("usage: link-show.ts <show>   (shows/<show> must exist)");
  process.exit(1);
}

const pub = join(ROOT, "engine", "public", "shows", show);
mkdirSync(pub, { recursive: true });
mkdirSync(join(ROOT, "cache", show), { recursive: true });

for (const [name, target] of [["art", join(ROOT, "shows", show, "art")], ["cache", join(ROOT, "cache", show)]] as const) {
  const link = join(pub, name);
  const rel = relative(pub, target);
  if (existsSync(link) || (() => { try { return !!lstatSync(link); } catch { return false; } })()) {
    if (lstatSync(link).isSymbolicLink() && readlinkSync(link) === rel) { console.log(`ok      ${relative(ROOT, link)} -> ${rel}`); continue; }
    unlinkSync(link);
  }
  symlinkSync(rel, link);
  console.log(`linked  ${relative(ROOT, link)} -> ${rel}`);
}
