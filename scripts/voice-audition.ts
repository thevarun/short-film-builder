/**
 * Voice audition harness — renders one representative line per candidate voice
 * so a human can pick by ear. Run: npx tsx scripts/voice-audition.ts [role]
 *
 * Outputs to cache/<show>/auditions/<ROLE>--<voice-name>.mp3 (gitignored).
 * Deterministic: same line, same settings, only the voice changes.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOW = "alice-in-dragonland";
const OUT = join(ROOT, "cache", SHOW, "auditions");

const envFile = join(ROOT, ".env");
if (!process.env.ELEVENLABS_API_KEY && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY not set. Add it to .env in the repo root.");
  process.exit(1);
}

const MODEL = "eleven_v3";

interface Candidate {
  id: string;
  name: string;
  note: string;
}
interface Role {
  role: string;
  /** Pre-normalized: no digits, no abbreviations. */
  line: string;
  candidates: Candidate[];
}

const ROLES: Role[] = [
  {
    role: "VULCAN",
    // Both registers in one clip: the shout from C4 and the calm turn from D4. The picture
    // does "fierce"; the voice must already be warm underneath so the D4 switch reads as
    // "he was never angry", not "he changed his mind".
    line: "[booming, delighted] Come on, let's chase them! [calm, amused] Calm down, no need to point that pointy thing at me.",
    candidates: [
      { id: "nPczCjzI2devNBz1zQrb", name: "Brian", note: "Deep, resonant, comforting" },
      { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", note: "Old, wise, mature" },
      { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", note: "Dominant, firm — the fiercest option" },
    ],
  },
  {
    role: "NARRATOR",
    line: "Alice was nine years old. High above the village was a cave, and in that cave lived dragons. Earth, water, stone, crystal, light. And last of all, the king of them all: fire.",
    candidates: [
      { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", note: "British, warm captivating storyteller" },
      { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", note: "British, velvety actress" },
      { id: "DODLEQrClDo8wCz460ld", name: "Lauren", note: "American, friendly comforting soft" },
    ],
  },
  {
    role: "ALICE",
    line: "[excited] Po! Can you take me in the sky to see the dragons?",
    candidates: [
      { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", note: "Young, playful, bright, cute" },
      { id: "hO2yZ8lxM3axUxL8OeKX", name: "Mini", note: "Lively cute young female, built for animation" },
      { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", note: "Young, enthusiast, quirky" },
      { id: "ecp3DWciuUyW7BYM7II1", name: "Anika", note: "Young, sweet and lively" },
    ],
  },
  {
    role: "PO",
    line: "[nervous] Are you crazy? You're going to get eaten by them.",
    candidates: [
      { id: "bIHbv24MWmeRgasZH58o", name: "Will", note: "Young, relaxed optimist — soft and round" },
      { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", note: "Husky trickster, animation voice" },
      { id: "iP95p4xoKVk53GoZ742B", name: "Chris", note: "Charming, down to earth" },
      { id: "S7IsvAvEoDfui6GSZK3A", name: "OmarJ", note: "Very young storyteller, animation voice" },
    ],
  },
  {
    role: "ERIK",
    line: "[shouting, urgent] The dragons are coming!",
    candidates: [
      { id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry", note: "Young, rough, fierce warrior" },
      { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", note: "Australian, deep confident energetic" },
      { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", note: "British, steady broadcaster" },
    ],
  },
];

async function render(voiceId: string, text: string, outPath: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // Alignment indices must match script text exactly — see CLAUDE.md invariant 5.
        apply_text_normalization: "off",
      }),
    },
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

const only = process.argv[2]?.toUpperCase();
mkdirSync(OUT, { recursive: true });

for (const r of ROLES) {
  if (only && r.role !== only) continue;
  console.log(`\n${r.role} — "${r.line}"`);
  for (const c of r.candidates) {
    const out = join(OUT, `${r.role}--${c.name}.mp3`);
    try {
      await render(c.id, r.line, out);
      console.log(`  ok  ${c.name.padEnd(9)} ${c.note}`);
    } catch (e) {
      console.log(`  FAIL ${c.name.padEnd(9)} ${(e as Error).message.slice(0, 120)}`);
    }
  }
}
console.log(`\nAuditions in ${OUT}`);
