/**
 * Builds the public ShortFilmBuilder tree from this repository, per `publish.config.json`.
 *
 * Deterministic: the same working tree always yields the same output, so syncing the public
 * repo is "regenerate, diff, commit" rather than cherry-picking commits that mix private and
 * public files. Only git-tracked files are candidates. Plates are re-encoded as JPEG (no LFS in
 * the public repo), the example film is cut down to its taught part, the author's name is
 * scrubbed, and the whole output is scanned for private strings before anything is written.
 *
 *   npx tsx scripts/publish-snapshot.ts <targetDir>          build into targetDir (keeps its .git)
 *   npx tsx scripts/publish-snapshot.ts <targetDir> --check  only report what would change
 */
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync,
  symlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const check = argv.includes("--check");
const target = argv.find((a) => !a.startsWith("--"));
if (!target) { console.error("usage: publish-snapshot.ts <targetDir> [--check]"); process.exit(1); }
const OUT = resolve(target);
if (OUT === ROOT || ROOT.startsWith(OUT + "/")) { console.error("target must be outside this repository"); process.exit(1); }

type Config = {
  include: string[]; exclude: string[]; renames: Record<string, string>; stubs: Record<string, string>;
  artToJpeg: boolean; filmParts: Record<string, string[]>; replace: [string, string][]; privateStrings: string[];
};
const cfg = JSON.parse(readFileSync(join(ROOT, "publish.config.json"), "utf8")) as Config;

/** Minimal glob: `**` any path, `*` within a segment. Anchored to the repo root. */
const glob = (g: string) => new RegExp("^" + g
  .replace(/[.+^${}()|[\]\\]/g, "\\$&")
  .replace(/\*\*\//g, "\u0001").replace(/\*\*/g, "\u0002").replace(/\*/g, "[^/]*")
  .replace(/\u0001/g, "(?:.*/)?").replace(/\u0002/g, ".*") + "$");
const includes = cfg.include.map(glob), excludes = cfg.exclude.map(glob);
const wanted = (p: string) => includes.some((r) => r.test(p)) && !excludes.some((r) => r.test(p));

// Tracked plus untracked-but-not-ignored, so a snapshot can be checked before a commit.
const tracked = [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean))];
const files = tracked.filter(wanted);
const isText = (p: string) => /\.(md|json|ts|tsx|js|sh|yaml|yml|txt|css|html|gitignore|example)$|^(LICENSE|\.gitignore)$/.test(p) || !/\.(png|jpe?g|mp3|mp4|wav|woff2?)$/.test(p);

// ---------- transforms ----------
const transformText = (path: string, text: string): string => {
  let t = text;
  for (const [a, b] of cfg.replace) t = t.split(a).join(b);
  if (cfg.artToJpeg && /^shows\//.test(path)) t = t.replace(/(art\/[A-Za-z0-9_./-]+)\.png/g, "$1.jpg");
  return t;
};
const transformFilm = (path: string, text: string): string => {
  const keep = cfg.filmParts[path];
  const spec = JSON.parse(text);
  if (keep) {
    spec.parts = spec.parts.filter((p: { id: string }) => keep.includes(p.id));
    const first = spec.parts[0]?.id;
    spec.shots = spec.shots.filter((s: { part?: string }) => keep.includes(s.part ?? first));
  }
  delete spec.byline;
  if (spec.cards?.credits) {
    // The author's name lives in the rendered film only.
    spec.cards.credits.lines = spec.cards.credits.lines.filter((l: { role?: string }) => l.role !== "Story");
  }
  return JSON.stringify(spec, null, 2) + "\n";
};

// ---------- plan ----------
type Item = { src?: string; dest: string; kind: "copy" | "text" | "jpeg" | "symlink" | "stub"; content?: string | Buffer; link?: string };
const plan: Item[] = [];
for (const f of files) {
  const dest = cfg.renames[f] ?? f;
  const st = lstatSync(join(ROOT, f));
  if (st.isSymbolicLink()) { plan.push({ src: f, dest, kind: "symlink", link: readlinkSync(join(ROOT, f)) }); continue; }
  if (cfg.artToJpeg && /^shows\/.*\/art\/.*\.png$/.test(f)) { plan.push({ src: f, dest: dest.replace(/\.png$/, ".jpg"), kind: "jpeg" }); continue; }
  if (!isText(f)) { plan.push({ src: f, dest, kind: "copy", content: readFileSync(join(ROOT, f)) }); continue; }
  let text = readFileSync(join(ROOT, f), "utf8");
  if (cfg.filmParts[f] || /\/film\.json$/.test(f)) text = transformFilm(f, text);
  text = transformText(f, text);
  plan.push({ src: f, dest, kind: "text", content: text });
}
for (const [dest, content] of Object.entries(cfg.stubs)) plan.push({ dest, kind: "stub", content });

// ---------- private-string scan, before anything is written ----------
const hits: string[] = [];
for (const it of plan) {
  if (typeof it.content !== "string") continue;
  for (const s of cfg.privateStrings) if (it.content.includes(s)) hits.push(`${it.dest}: "${s}"`);
  for (const s of cfg.privateStrings) if (it.dest.includes(s)) hits.push(`${it.dest}: path contains "${s}"`);
}
if (hits.length) {
  console.error("private strings would be published — nothing written:");
  for (const h of hits) console.error("  " + h);
  process.exit(2);
}

// ---------- write ----------
const summary = { text: 0, copy: 0, jpeg: 0, symlink: 0, stub: 0 };
if (check) {
  for (const it of plan) summary[it.kind]++;
  console.log(`${plan.length} files would be written to ${OUT}:`, summary);
  process.exit(0);
}
// Clear the target so removals in the config are removals in the output — but keep what is the
// clone's own: its .git, installed dependencies, local media and keys.
const KEEP = new Set([".git", "node_modules", "out", "cache", ".env"]);
const clear = (dir: string) => {
  for (const e of readdirSync(dir)) {
    if (KEEP.has(e)) continue;
    const p = join(dir, e);
    if (e === "engine" && lstatSync(p).isDirectory()) { clear(p); continue; }
    rmSync(p, { recursive: true, force: true });
  }
};
if (existsSync(OUT)) clear(OUT);
for (const it of plan) {
  const dest = join(OUT, it.dest);
  mkdirSync(dirname(dest), { recursive: true });
  summary[it.kind]++;
  if (it.kind === "symlink") { symlinkSync(it.link!, dest); continue; }
  if (it.kind === "jpeg") {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", join(ROOT, it.src!), "--out", dest], { stdio: "ignore" });
    continue;
  }
  writeFileSync(dest, it.content!);
}
console.log(`${plan.length} files written to ${relative(process.cwd(), OUT) || "."}:`, summary);
