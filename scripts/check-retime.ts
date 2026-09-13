/**
 * Fails the build when a clip is stretched or squeezed too far to fill its shot window, and
 * flags a music cue too short to land under the end cards.
 *
 *   npx tsx scripts/check-retime.ts <show>
 *
 * A4b once played at 2.08x — an 8s clip crammed into a 3.8s sentence window — and nothing
 * caught it until the ending felt rushed on viewing. Derived timing values need a guard.
 */
import { compositions, filmLayout, musicPlacement, retimeReport } from "../engine/src/film/timeline.js";
import { loadFilm, showsWithFilms } from "./lib/film.js";

const show = process.argv[2] ?? showsWithFilms()[0];
if (!show) { console.error("usage: check-retime.ts <show>"); process.exit(1); }
const film = loadFilm(show);
const { min, max } = film.spec.rate;

let bad = 0;
for (const c of compositions(film)) {
  console.log(`\n${c.id}`);
  console.log(`  ${"shot".padEnd(6)}${"clip".padStart(8)}${"window".padStart(9)}${"rate".padStart(8)}`);
  for (const r of retimeReport(film, c)) {
    const flag = r.ok ? "" : `   <-- outside ${min}x-${max}x`;
    if (!r.ok) bad++;
    console.log(
      `  ${r.id.padEnd(6)}${r.clipSec.toFixed(2).padStart(8)}` +
      `${r.windowSec.toFixed(2).padStart(9)}${r.rate.toFixed(2).padStart(7)}x${flag}`,
    );
  }
}

const layout = filmLayout(film);
const m = musicPlacement(film, layout);
console.log(`\n${film.spec.id}Film  ${layout.totalSec.toFixed(2)}s (${layout.totalFrames} frames)`);
if (m) {
  console.log(`  music ${film.spec.music!.cue}: trim ${(m.trimFrames / film.spec.fps).toFixed(2)}s from the front`);
  if (m.shortBySec > 0) {
    const ok = film.spec.music!.allowEarlyEnd;
    if (!ok) bad++;
    console[ok ? "log" : "error"](`  ${ok ? "note" : "<--"} cue is ${m.shortBySec.toFixed(1)}s too short to land under the end cards; ` +
      `it runs out ${((layout.totalFrames - m.endFrame) / film.spec.fps).toFixed(1)}s before the picture ends` +
      (ok ? " (allowEarlyEnd)." : `. Recompose at least ${Math.ceil(layout.totalSec + (film.music!.durationSec - film.music!.landingSec) + film.music!.soundStartSec + 2)}s long.`));
  }
}

if (bad) {
  console.error(`\n${bad} problem(s). Trim the clip, split the shot, or recompose the cue.`);
  process.exit(1);
}
console.log("\nAll shots within retime bounds; music lands on cue.");
