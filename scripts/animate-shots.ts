/**
 * Turns approved shot paintings into motion clips with Veo 3.1 on Vertex AI.
 * The painting is the FIRST FRAME, so composition, characters and palette are locked
 * before the model adds motion — this is what keeps the cast on-model.
 *
 * Run: npx tsx scripts/animate-shots.ts <show> <part> [shotIds...]
 *   e.g. npx tsx scripts/animate-shots.ts <show> AB B5 B3
 *   With no shot ids, every shot in the part is generated.
 *
 * Auth: gcloud auth application-default login   (uses ADC, no API key)
 * Output: cache/<show>/motion/<id>.mp4 (gitignored)
 *
 * Caching: a clip is keyed by a hash of (prompt + style + keyframe bytes + seconds).
 * An unchanged shot is never regenerated — Veo is billed per second of output.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const show = argv[0];
if (!show) { console.error("usage: animate-shots.ts <show> <part> [shotId ...] [--lite|--fast|--final]"); process.exit(1); }
const part = argv[1] ?? "AB";
const only = argv.slice(2).map((s) => s.toLowerCase());

/** Tier picker. Drafts are for judging staging and motion; only promote to final
 *  once a shot's direction is settled, because final costs several times more. */
const TIERS: Record<string, string> = {
  lite: "veo-3.1-lite-generate-001",
  fast: "veo-3.1-fast-generate-001",
  final: "veo-3.1-generate-001",
};
const tier = flags.has("--final") ? "final" : flags.has("--fast") ? "fast" : "lite";

interface ShotSpec {
  id: string;
  keyframe: string;
  seconds: number;
  /** What actually happens, first second to last. */
  action: string;
  /** Explicit camera choreography. Without this Veo animates the still and holds. */
  camera: string;
  /** Hard rules restated as constraints — physical relationships, emotional range,
   *  design details. Description alone does not survive; constraints do. */
  constraints?: string;
  /** Optional target end frame — Veo interpolates a continuous move between two
   *  approved compositions, which is how consecutive shots get connected. */
  lastFrame?: string;
  /** Start this shot from the ACTUAL final frame of another shot's clip, not from a
   *  painting. Makes the join frame-exact: the last frame of one clip and the first
   *  frame of the next are the same image, so the cut is invisible. */
  chainFrom?: string;
  /** An approved clip that is never regenerated — the shot is already finished. */
  reuseClip?: string;
  /** Overrides the show-wide negative prompt. The default bans locomotion, which is right
   *  for a tableau and wrong for a shot whose whole content is someone running. */
  negativePrompt?: string;
}
interface MotionSpec {
  model: string; location: string; styleSuffix: string;
  negativePrompt?: string; shots: ShotSpec[];
}

const spec: MotionSpec = JSON.parse(
  readFileSync(join(ROOT, "shows", show, "motion", `motion-${part}.json`), "utf8"),
);

function token(): string {
  try {
    return execFileSync("gcloud", ["auth", "application-default", "print-access-token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error(
      "Could not get a Google access token.\n" +
      "Run:  gcloud auth login && gcloud auth application-default login",
    );
    process.exit(1);
  }
}
function project(): string {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  return execFileSync("gcloud", ["config", "get-value", "project"], { encoding: "utf8" }).trim();
}

const ACCESS = token();
const PROJECT = project();
const LOC = spec.location;
const MODEL = TIERS[tier];
const BASE =
  `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}` +
  `/locations/${LOC}/publishers/google/models/${MODEL}`;
const H = { Authorization: `Bearer ${ACCESS}`, "Content-Type": "application/json" };

const outDir = join(ROOT, "cache", show, "motion");
mkdirSync(join(outDir, "_archive"), { recursive: true });
mkdirSync(join(outDir, "_frames"), { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull the last frame of a rendered clip out to a PNG, for frame-exact chaining. */
function tailFrame(shotId: string): string {
  const src = join(outDir, `${shotId}.${tier}.mp4`);
  if (!existsSync(src)) {
    throw new Error(`Cannot chain from ${shotId}: ${src} has not been generated yet.`);
  }
  const out = join(outDir, "_frames", `${shotId}.tail.png`);
  execFileSync("ffmpeg", ["-y", "-sseof", "-0.1", "-i", src, "-frames:v", "1", out], {
    stdio: "ignore",
  });
  return out;
}

async function generate(s: ShotSpec) {
  const kfPath = s.chainFrom
    ? tailFrame(s.chainFrom)
    : join(ROOT, "shows", show, "art", s.keyframe);
  const kf = readFileSync(kfPath);
  const lf = s.lastFrame
    ? readFileSync(join(ROOT, "shows", show, "art", s.lastFrame))
    : null;
  const prompt =
    `${s.action}\n\nCAMERA: ${s.camera}\n\n` +
    (s.constraints ? `MUST HOLD TRUE THROUGHOUT: ${s.constraints}\n\n` : "") +
    spec.styleSuffix;
  const negative = s.negativePrompt ?? spec.negativePrompt;
  const key = createHash("sha256")
    .update(prompt).update(kf).update(lf ?? Buffer.alloc(0))
    .update(String(s.seconds)).update(MODEL).update(negative ?? "")
    .digest("hex").slice(0, 16);

  const mp4 = join(outDir, `${s.id}.${tier}.mp4`);
  const stamp = join(outDir, `${s.id}.${tier}.key`);
  if (existsSync(mp4) && existsSync(stamp) && readFileSync(stamp, "utf8") === key) {
    console.log(`${s.id}  cached`);
    return;
  }

  const start = await fetch(`${BASE}:predictLongRunning`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      instances: [{
        prompt,
        image: { bytesBase64Encoded: kf.toString("base64"), mimeType: "image/png" },
        ...(lf ? { lastFrame: { bytesBase64Encoded: lf.toString("base64"), mimeType: "image/png" } } : {}),
      }],
      parameters: {
        aspectRatio: "16:9",
        durationSeconds: s.seconds,
        sampleCount: 1,
        resolution: "1080p",
        // Narration comes from ElevenLabs — never let Veo invent audio.
        generateAudio: false,
        personGeneration: "allow_all",
        ...(negative ? { negativePrompt: negative } : {}),
      },
    }),
  });
  if (!start.ok) { console.error(`${s.id}  FAIL ${start.status}: ${(await start.text()).slice(0, 500)}`); return; }
  const { name } = (await start.json()) as { name: string };
  console.log(`${s.id}  submitted`);

  for (let i = 0; i < 90; i++) {
    await sleep(10_000);
    const p = await fetch(`${BASE}:fetchPredictOperation`, {
      method: "POST", headers: H, body: JSON.stringify({ operationName: name }),
    });
    if (!p.ok) { console.error(`${s.id}  poll ${p.status}: ${(await p.text()).slice(0, 300)}`); return; }
    const op: any = await p.json();
    if (!op.done) { process.stdout.write("."); continue; }
    if (op.error) { console.error(`\n${s.id}  ERROR ${JSON.stringify(op.error).slice(0, 400)}`); return; }

    const vids = op.response?.videos ?? op.response?.generatedSamples ?? [];
    const b64 = vids[0]?.bytesBase64Encoded ?? vids[0]?.video?.bytesBase64Encoded;
    if (!b64) {
      console.error(`\n${s.id}  no video in response: ${JSON.stringify(op.response).slice(0, 500)}`);
      return;
    }
    const buf = Buffer.from(b64, "base64");
    writeFileSync(mp4, buf);
    // Immutable archive keyed by prompt hash — a re-draft never destroys an earlier
    // take, so an approved version can always be recovered.
    writeFileSync(join(outDir, "_archive", `${s.id}.${tier}.${key}.mp4`), buf);
    writeFileSync(stamp, key);
    console.log(`\n${s.id}  ok -> ${mp4}`);
    return;
  }
  console.error(`\n${s.id}  timed out waiting for the operation`);
}

// Veo image_to_video accepts only these clip lengths — fail before spending a call.
const VEO_DURATIONS = [4, 6, 8];
const bad = spec.shots.filter((s) => !s.reuseClip && !VEO_DURATIONS.includes(s.seconds));
if (bad.length) {
  console.error(
    `Unsupported durations (allowed ${VEO_DURATIONS.join("/")}s): ` +
    bad.map((b) => `${b.id}=${b.seconds}s`).join(", "),
  );
  process.exit(1);
}

// A shot needs a first frame from somewhere. Catch it here, before any call is paid for —
// a missing keyframe once crashed a run three clips in, after the first two had been billed.
const noFrame = spec.shots.filter((s) => !s.reuseClip && !s.chainFrom && !s.keyframe);
if (noFrame.length) {
  console.error(`No keyframe or chainFrom: ${noFrame.map((s) => s.id).join(", ")}`);
  process.exit(1);
}
const missingArt = spec.shots
  .filter((s) => !s.reuseClip)
  .flatMap((s) => [s.keyframe, s.lastFrame].filter((f): f is string => !!f))
  .filter((f) => !existsSync(join(ROOT, "shows", show, "art", f)));
if (missingArt.length) {
  console.error(`Missing art: ${[...new Set(missingArt)].join(", ")}`);
  process.exit(1);
}

const targets = spec.shots
  .filter((s) => !only.length || only.includes(s.id.toLowerCase()))
  .filter((s) => {
    if (s.reuseClip) console.log(`${s.id}  reusing approved clip ${s.reuseClip}`);
    return !s.reuseClip;
  });
console.log(`project ${PROJECT} · ${MODEL} (${tier}) · ${targets.length} shot(s)\n`);
for (const s of targets) await generate(s);
