/**
 * Builds the production storyboard page from the artifacts that already exist — the shot
 * list, the measured sentence windows, the Veo motion specs and the painted keyframes.
 *
 * The storyboard used to be hand-written, which meant it drifted from the pipeline the
 * moment a shot changed. Generating it means the review surface and the thing being
 * reviewed cannot disagree.
 *
 *   npx tsx scripts/build-storyboard.ts <show> <part>
 *   -> out/<show>/storyboard.html
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Shot } from "../schemas/film.js";
import { arcComp, partComp, shotWindows, type Comp } from "../engine/src/film/timeline.js";
import { loadFilm } from "./lib/film.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [show, part] = process.argv.slice(2);
if (!show || !part) { console.error("usage: build-storyboard.ts <show> <part>"); process.exit(1); }
const film = loadFilm(show);
const partSpec = film.spec.parts.find((p) => p.id === part);
if (!partSpec) { console.error(`${show}: no part ${part} in film.json`); process.exit(1); }
const { fps: FPS } = film.spec;
const { min: RATE_MIN, max: RATE_MAX } = film.spec.rate;
const LINES = film.lines[part];
const SHOW_DIR = join(ROOT, "shows", show);
const ART = join(SHOW_DIR, "art");
const CLIPS = join(ROOT, "cache", show, "motion");
const THUMBS = join(ROOT, "cache", show, "thumbs");

interface ShotSpec {
  id: string; keyframe?: string; seconds?: number; action?: string; camera?: string;
  constraints?: string; lastFrame?: string; chainFrom?: string; reuseClip?: string;
  negativePrompt?: string; treatment?: string;
}
const spec = JSON.parse(
  readFileSync(join(SHOW_DIR, "motion", `motion-${part}.json`), "utf8"),
) as { negativePrompt?: string; shots: ShotSpec[] };
const byId = new Map(spec.shots.map((s) => [s.id.toLowerCase(), s]));

/** 16:9 thumbnails, cached, so a 3 MB painting costs ~15 KB in the page. */
function thumb(rel: string): string | null {
  const src = join(ART, rel);
  if (!existsSync(src)) return null;
  mkdirSync(THUMBS, { recursive: true });
  const out = join(THUMBS, `${basename(rel).replace(/\.\w+$/, "")}.jpg`);
  if (!existsSync(out)) {
    execFileSync("sips", ["-Z", "560", "-s", "format", "jpeg", "-s", "formatOptions", "72",
      src, "--out", out], { stdio: "ignore" });
  }
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const JOIN: Record<number, string> = {
  0: "chained — no fade",
  8: "cut — 8f",
  14: "dissolve — 14f",
  24: "new location — 24f",
  20: "open — 20f",
};

type Row = {
  id: string; startSec: number; endSec: number; windowSec: number;
  lines: string[]; s: ShotSpec | undefined; shot: Shot;
  rate: number | null; join: string; haveClip: boolean;
};

function rows(c: Comp): Row[] {
  return shotWindows(film, c).map((w) => {
    const shot = w.shot;
    const s = byId.get(shot.id.toLowerCase());
    const windowSec = w.durationInFrames / FPS;
    const usable = shot.trim ? shot.trim[1] - shot.trim[0] : shot.clipSeconds ?? null;
    const held = !!shot.hold;
    const [a, b] = shot.sentence;
    return {
      id: shot.id,
      startSec: w.startSec,
      endSec: w.startSec + windowSec,
      windowSec,
      lines: LINES.slice(a, b + 1).map((l) => l.text),
      s, shot,
      rate: usable ? (held ? 1 : usable / windowSec) : null,
      join: JOIN[shot.fadeIn ?? 14] ?? `${shot.fadeIn}f`,
      haveClip: !!shot.video && existsSync(join(CLIPS, basename(shot.video))),
    };
  });
}

function card(r: Row): string {
  const s = r.s;
  const frame = s?.chainFrom
    ? null
    : s?.keyframe
      ? thumb(s.keyframe)
      : null;
  const last = s?.lastFrame ? thumb(s.lastFrame) : null;
  const rate = r.rate;
  const rateClass = rate === null ? "" : rate > RATE_MAX || rate < RATE_MIN ? " bad" : " ok";

  const source = s?.reuseClip
    ? `approved take <code>${esc(s.reuseClip)}</code>`
    : s?.chainFrom
      ? `first frame = final frame of <b>${esc(s.chainFrom)}</b>`
      : s?.keyframe
        ? `first frame = <code>${esc(basename(s.keyframe))}</code>`
        : "—";

  const dl = [
    ["Action", s?.action],
    ["Camera", s?.camera],
    ["Must hold true", s?.constraints],
  ].filter(([, v]) => v)
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v)).replace(/\n/g, "<br>")}</dd>`)
    .join("");

  return `<article class="shot${r.haveClip ? " has-clip" : ""}">
  <header>
    <span class="sid">${esc(r.id)}</span>
    <span class="win">${clock(r.startSec)}–${clock(r.endSec)}</span>
    <span class="dur">${r.windowSec.toFixed(2)}s</span>
    <span class="tag ${r.haveClip ? "ready" : "todo"}">${r.haveClip ? "clip rendered" : "not generated"}</span>
  </header>
  <div class="body">
    <div class="frames">
      ${frame ? `<figure><img src="${frame}" alt="First frame for ${esc(r.id)}"><figcaption>first frame</figcaption></figure>`
        : `<figure class="chained"><div class="ph">chained from<br><b>${esc(s?.chainFrom ?? "—")}</b></div><figcaption>first frame</figcaption></figure>`}
      ${last ? `<figure><img src="${last}" alt="Target last frame for ${esc(r.id)}"><figcaption>target last frame</figcaption></figure>` : ""}
    </div>
    <div class="detail">
      ${r.lines.map((l) => `<p class="line">${esc(l)}</p>`).join("")}
      <dl>${dl}</dl>
      <ul class="facts">
        <li><span>Source</span>${source}</li>
        <li><span>Clip</span>${s?.seconds ?? "—"}s${r.shot.trim ? `, trimmed to ${r.shot.trim[1] - r.shot.trim[0]}s` : ""}</li>
        <li><span>Retime</span><b class="rate${rateClass}">${rate === null ? "—" : `${rate.toFixed(2)}×`}</b></li>
        <li><span>Join in</span>${esc(r.join)}</li>
        ${s?.negativePrompt ? `<li><span>Negatives</span>shot override — locomotion allowed</li>` : ""}
      </ul>
    </div>
  </div>
</article>`;
}

function arc(title: string, sub: string, list: Row[]): string {
  const total = list.length ? list[list.length - 1].endSec - list[0].startSec : 0;
  const done = list.filter((r) => r.haveClip).length;
  return `<section>
  <div class="arc-head">
    <h2>${esc(title)}</h2>
    <p>${esc(sub)}</p>
    <div class="arc-meta">
      <span><b>${list.length}</b> shots</span>
      <span><b>${total.toFixed(1)}s</b> on screen</span>
      <span><b>${list.reduce((n, r) => n + (r.s?.seconds ?? 0), 0)}s</b> of Veo output</span>
      <span><b>${done}/${list.length}</b> rendered</span>
    </div>
  </div>
  ${list.map(card).join("\n")}
</section>`;
}

const arcs = partSpec.arcs.map((a) => ({ id: a, rows: rows(arcComp(film, a)) }));
const all = arcs.flatMap((a) => a.rows);
const voices = new Set(LINES.map((l) => (l as { speaker?: string }).speaker).filter(Boolean)).size;

const html = `<title>${esc(film.spec.title)} Shot Book</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Karla:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#FBF6EC; --panel:#FFFFFF; --sunk:#F4ECDD;
  --ink:#2B2018; --ink-soft:#6B5C4E; --rule:#E2D7C6;
  --rust:#C2562A; --moss:#5E7050; --slate:#47607A; --todo:#A8968A;
  --shadow:0 1px 2px rgba(43,32,24,.06),0 6px 18px rgba(43,32,24,.06);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#16120F; --panel:#1F1A16; --sunk:#191411;
  --ink:#F0E6D8; --ink-soft:#A2917F; --rule:#3A312A;
  --rust:#E27C43; --moss:#8FA37C; --slate:#7FA0BC; --todo:#7C6E62;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.32);
}}
:root[data-theme="dark"]{
  --ground:#16120F; --panel:#1F1A16; --sunk:#191411;
  --ink:#F0E6D8; --ink-soft:#A2917F; --rule:#3A312A;
  --rust:#E27C43; --moss:#8FA37C; --slate:#7FA0BC; --todo:#7C6E62;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.32);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font:16px/1.55 Karla,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:44px 22px 88px;
  display:flex;flex-direction:column;gap:44px}
h1,h2{font-family:Fraunces,Georgia,serif;margin:0;text-wrap:balance}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;
  letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}

header.top{display:flex;flex-direction:column;gap:10px}
h1{font-size:clamp(32px,5vw,46px);font-weight:600;line-height:1.04}
.lede{max-width:62ch;color:var(--ink-soft);margin:0}
.totals{display:flex;flex-wrap:wrap;gap:26px;padding:14px 0;
  border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin-top:8px}
.totals div{display:flex;flex-direction:column}
.totals .k{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-soft)}
.totals .v{font-family:Fraunces,Georgia,serif;font-size:22px;font-variant-numeric:tabular-nums}

section{display:flex;flex-direction:column;gap:18px}
.arc-head{display:flex;flex-direction:column;gap:6px;
  border-bottom:2px solid var(--ink);padding-bottom:12px}
.arc-head h2{font-size:25px;font-weight:600}
.arc-head p{margin:0;color:var(--ink-soft);max-width:62ch}
.arc-meta{display:flex;flex-wrap:wrap;gap:20px;margin-top:6px;
  font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-soft);
  font-variant-numeric:tabular-nums}
.arc-meta b{color:var(--ink)}

.shot{background:var(--panel);border:1px solid var(--rule);border-radius:4px;
  box-shadow:var(--shadow);overflow:hidden}
.shot.has-clip{border-left:3px solid var(--moss)}
.shot>header{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;
  padding:11px 16px;background:var(--sunk);border-bottom:1px solid var(--rule);
  font-family:"IBM Plex Mono",monospace;font-size:12px;font-variant-numeric:tabular-nums;
  color:var(--ink-soft)}
.sid{font-size:15px;color:var(--rust);letter-spacing:.06em;font-weight:500}
.dur{color:var(--ink)}
.tag{margin-left:auto;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  padding:3px 8px;border-radius:2px}
.tag.ready{background:color-mix(in srgb,var(--moss) 18%,transparent);color:var(--moss)}
.tag.todo{background:color-mix(in srgb,var(--todo) 22%,transparent);color:var(--todo)}

.body{display:grid;grid-template-columns:236px 1fr;gap:20px;padding:16px}
.frames{display:flex;flex-direction:column;gap:12px}
.frames figure{margin:0;display:flex;flex-direction:column;gap:5px}
.frames img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;
  border:1px solid var(--rule);display:block}
.frames .ph{width:100%;aspect-ratio:16/9;border:1px dashed var(--rule);border-radius:3px;
  display:grid;place-items:center;text-align:center;background:var(--sunk);
  font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--ink-soft);line-height:1.7}
.frames figcaption{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-soft)}

.detail{min-width:0;display:flex;flex-direction:column;gap:12px}
.line{margin:0;padding-left:12px;border-left:2px solid var(--rust);
  font-family:Fraunces,Georgia,serif;font-size:15.5px;font-style:italic;color:var(--ink)}
dl{margin:0;display:flex;flex-direction:column;gap:9px}
dt{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-soft)}
dd{margin:2px 0 0;font-size:14.5px;line-height:1.5}
.facts{list-style:none;margin:2px 0 0;padding:10px 0 0;border-top:1px solid var(--rule);
  display:flex;flex-wrap:wrap;gap:6px 24px;font-size:13px;color:var(--ink)}
.facts li{display:flex;gap:8px;align-items:baseline}
.facts span{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink-soft)}
.facts code{font-family:"IBM Plex Mono",monospace;font-size:12px}
.rate{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.rate.ok{color:var(--moss)} .rate.bad{color:var(--rust)}

footer{border-top:1px solid var(--rule);padding-top:18px;font-size:13.5px;
  color:var(--ink-soft);max-width:66ch}
footer code{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink)}
@media(max-width:760px){.body{grid-template-columns:1fr}}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Shot book · part ${esc(part)} · sequences ${esc(partSpec.arcs.join(", "))}</div>
  <h1>${esc(film.spec.title)}</h1>
  <p class="lede">Every shot cut to a measured sentence span from the locked narration, with
  the direction that will be sent to Veo.${film.spec.byline ? ` Adapted for animation from the story ${esc(film.spec.byline)}.` : ""}</p>
  <div class="totals">
    <div><span class="k">Narration locked</span><span class="v">${clock(partComp(film, part).to)}</span></div>
    <div><span class="k">Shots</span><span class="v">${all.length}</span></div>
    <div><span class="k">Clips rendered</span><span class="v">${all.filter((r) => r.haveClip).length}</span></div>
    <div><span class="k">Voices</span><span class="v">${voices || "—"}</span></div>
  </div>
</header>
${arcs.map((a) => arc(`Sequence ${a.id}`, `${a.rows.length} shots, ${a.rows.filter((r) => r.shot.video).length} live, ${a.rows.filter((r) => (r.shot.fadeIn ?? 14) === 0).length} chained joins.`, a.rows)).join("\n")}
<footer>
  Generated from <code>shows/${esc(show)}/film.json</code>,
  <code>shows/${esc(show)}/motion/motion-${esc(part)}.json</code> and the measured sentence
  spans in <code>${esc(part)}.sentences.json</code>. Rebuild with
  <code>npx tsx scripts/build-storyboard.ts</code>. Retime figures come from the same
  function the render uses, so a rate shown here in red will fail
  <code>scripts/check-retime.ts</code>.
</footer>
</div>`;

mkdirSync(join(ROOT, "out", show), { recursive: true });
const dest = join(ROOT, "out", show, "storyboard.html");
writeFileSync(dest, html);
console.log(`${dest}  ${(html.length / 1024).toFixed(0)} KB  ${all.length} shots`);
