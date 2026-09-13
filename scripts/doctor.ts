/**
 * Checks that this machine can run the pipeline, and says exactly what to fix when it cannot.
 *
 *   npx tsx scripts/doctor.ts
 *
 * Every row is a real probe, not a guess: keys are exercised against the API, the ElevenLabs
 * key is asked whether it may call forced alignment and music (a key without those
 * permissions fails halfway through a film, not at the start), and Vertex is asked whether it
 * will serve the Veo model. Nothing here spends money. Nothing here prints a secret.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Row = { name: string; ok: boolean | "warn"; detail: string; fix?: string; required?: boolean };
const rows: Row[] = [];
const add = (r: Row) => rows.push({ required: true, ...r });

const sh = (cmd: string, args: string[]): string | null => {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};
const which = (cmd: string) => sh("sh", ["-c", `command -v ${cmd}`]);

// ---------- .env (never printed) ----------
const env: Record<string, string> = {};
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/);
    if (m) env[m[1]] = m[2];
  }
}
const key = (name: string) => process.env[name] || env[name] || "";

// ---------- tools ----------
const nodeMajor = Number(process.versions.node.split(".")[0]);
add({ name: "Node.js", ok: nodeMajor >= 20, detail: `v${process.versions.node}`, fix: "Install Node 20 or newer: https://nodejs.org" });
add({ name: "pnpm", ok: !!which("pnpm"), detail: sh("pnpm", ["--version"]) ?? "not found", fix: "npm install -g pnpm" });
add({ name: "Dependencies installed", ok: existsSync(join(ROOT, "engine", "node_modules", "remotion")), detail: existsSync(join(ROOT, "engine", "node_modules", "remotion")) ? "engine/node_modules present" : "engine/node_modules missing", fix: "pnpm install" });
add({ name: "ffmpeg + ffprobe", ok: !!which("ffmpeg") && !!which("ffprobe"), detail: sh("ffmpeg", ["-version"])?.split("\n")[0].split(" ").slice(0, 3).join(" ") ?? "not found", fix: "brew install ffmpeg   (macOS)  ·  apt install ffmpeg  (Linux)" });
add({ name: "jq", ok: !!which("jq"), detail: sh("jq", ["--version"]) ?? "not found", fix: "brew install jq — the render-check hook uses it", required: false });
add({ name: "uvx (for the image MCP)", ok: !!which("uvx"), detail: which("uvx") ? "found" : "not found", fix: "curl -LsSf https://astral.sh/uv/install.sh | sh", required: false });

// ---------- .env ----------
add({ name: ".env file", ok: existsSync(envPath), detail: existsSync(envPath) ? "present" : "missing", fix: "cp .env.example .env, then fill in the keys (see SETUP.md)" });

// ---------- ElevenLabs ----------
const eleven = key("ELEVENLABS_API_KEY");
const probe = async (url: string, init: RequestInit): Promise<number> => {
  try { return (await fetch(url, init)).status; } catch { return 0; }
};
if (!eleven) {
  add({ name: "ElevenLabs key", ok: false, detail: "ELEVENLABS_API_KEY not set", fix: "https://elevenlabs.io/app/settings/api-keys → create a key → paste into .env" });
} else {
  const h = { "xi-api-key": eleven };
  // A POST with no body is refused for a bad key or a missing permission (401) before it is
  // refused for a missing file (422). So 422 means "valid and allowed", and it costs nothing.
  // (The account endpoints are not used: a restricted key may not read them and still be fine.)
  const results: [string, boolean, number][] = [];
  for (const [name, url] of [
    ["text-to-dialogue", "https://api.elevenlabs.io/v1/text-to-dialogue"],
    ["forced-alignment", "https://api.elevenlabs.io/v1/forced-alignment"],
    ["music", "https://api.elevenlabs.io/v1/music"],
  ] as const) {
    const s = await probe(url, { method: "POST", headers: h });
    results.push([name, s === 422 || s === 400, s]);
  }
  if (results.every(([, ok, s]) => !ok && (s === 401 || s === 403))) {
    add({ name: "ElevenLabs key", ok: false, detail: "rejected by every endpoint", fix: "Check ELEVENLABS_API_KEY in .env" });
  } else {
    add({ name: "ElevenLabs key", ok: true, detail: "accepted" });
    const need: Record<string, string> = { "text-to-dialogue": "Text to Speech", "forced-alignment": "Speech to Text (forced alignment)", music: "Music" };
    for (const [name, ok, s] of results) {
      add({ name: `  ${name}`, ok, detail: ok ? "permitted" : s === 401 || s === 403 ? "key lacks this permission" : `unexpected HTTP ${s}`,
        fix: `Edit the key at https://elevenlabs.io/app/settings/api-keys and enable "${need[name]}"` });
    }
  }
}

// ---------- Gemini (images, via the nanobanana MCP) ----------
const gemini = key("GEMINI_API_KEY");
if (!gemini) {
  add({ name: "Gemini key (images)", ok: false, detail: "GEMINI_API_KEY not set", fix: "https://aistudio.google.com/apikey → create → paste into .env" });
} else {
  const s = await probe(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(gemini)}`, {});
  add({ name: "Gemini key (images)", ok: s === 200, detail: s === 200 ? "accepted" : `rejected (HTTP ${s})`, fix: "Check GEMINI_API_KEY in .env" });
}

// ---------- Google Cloud / Vertex (Veo) ----------
const gcloud = which("gcloud");
add({ name: "gcloud CLI", ok: !!gcloud, detail: gcloud ? sh("gcloud", ["--version"])?.split("\n")[0] ?? "found" : "not found", fix: "https://cloud.google.com/sdk/docs/install" });
if (gcloud) {
  const project = key("GOOGLE_CLOUD_PROJECT") || sh("gcloud", ["config", "get-value", "project"]) || "";
  add({ name: "Google Cloud project", ok: !!project && project !== "(unset)", detail: project || "none", fix: "gcloud config set project <your-project-id>   (or GOOGLE_CLOUD_PROJECT in .env)" });
  const token = sh("gcloud", ["auth", "application-default", "print-access-token"]);
  add({ name: "Application Default Credentials", ok: !!token, detail: token ? "valid token" : "no valid token", fix: "gcloud auth application-default login   (expires after a while — rerun when a batch fails with 401)" });
  if (token && project) {
    const s = await probe(`https://us-central1-aiplatform.googleapis.com/v1/publishers/google/models/veo-3.1-lite-generate-001`,
      { headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project } });
    add({ name: "Vertex AI + Veo 3.1", ok: s === 200, detail: s === 200 ? "model reachable" : s === 403 ? "API not enabled or no access" : `HTTP ${s}`,
      fix: `gcloud services enable aiplatform.googleapis.com --project ${project}   then check billing is on for the project` });
  }
}

// ---------- report ----------
let failed = 0;
for (const r of rows) {
  const mark = r.ok === true ? "✓" : r.ok === "warn" ? "!" : "✗";
  if (r.ok === false && r.required) failed++;
  console.log(`${mark} ${r.name.padEnd(34)} ${r.detail}`);
  if (r.ok !== true && r.fix) console.log(`  ${"".padEnd(34)} → ${r.fix}`);
}
console.log();
if (failed) { console.error(`${failed} required check(s) failed. Fix the lines marked ✗ and run again.`); process.exit(1); }
console.log("Ready. Next: /story-film <path-to-story> — or SETUP.md, step 3.");
