# Setup

Everything you need before the first film. Budget about thirty minutes, most of it waiting on
account sign-ups. If you use an AI coding agent, open this repository and say **"set this up"**:
the agent follows this page, runs the checker, and tells you exactly which page to open when a
key is missing. It never creates accounts or enters keys for you — that part is yours.

## 1. Tools

| Tool | Why | Install |
|---|---|---|
| Node.js 20+ and pnpm | runs everything | https://nodejs.org · `npm install -g pnpm` |
| ffmpeg | measures audio, checks renders | `brew install ffmpeg` (macOS) · `apt install ffmpeg` (Linux) |
| Google Cloud CLI | authenticates video generation | https://cloud.google.com/sdk/docs/install |
| uv | runs the image server | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| jq | used by the render-check hook | `brew install jq` |

Then, in the repository:

```bash
pnpm install
```

## 2. Accounts and keys

Three services. Each key goes into a file called `.env` at the repository root, which git
ignores. Start from the template:

```bash
cp .env.example .env
```

**ElevenLabs** — voices, timing, music. https://elevenlabs.io
A paid plan is needed for the v3 dialogue model. Create an API key at *Settings → API keys*
and give it three permissions: **Text to Speech**, **Speech to Text** (this is what forced
alignment uses) and **Music**. Paste it as `ELEVENLABS_API_KEY`.

**Google AI Studio** — the illustrations. https://aistudio.google.com/apikey
Create a key and paste it as `GEMINI_API_KEY`.

**Google Cloud** — the animation (Veo 3.1). https://console.cloud.google.com
1. Create a project and turn on billing (new accounts get free credit that covers several films).
2. Enable the Vertex AI API: `gcloud services enable aiplatform.googleapis.com`
3. Sign in on this machine, twice — once for the CLI and once for the scripts:
   ```bash
   gcloud auth login
   gcloud config set project <your-project-id>
   gcloud auth application-default login
   ```
   The second sign-in expires after a while. When a batch fails with a 401, run it again.

## 3. Check

```bash
npx tsx scripts/doctor.ts
```

Every line should show ✓. A ✗ line prints the exact fix under it. Nothing this runs costs money.

## 4. First film

With Claude Code, open the repository and run `/story-film path/to/story.md`. It walks the
twelve stages in `docs/animated-story-pipeline.md`, pausing at each gate for your approval.
With another agent, point it at that document and `AGENTS.md`.

To see the worked example without spending anything, link its media once and open Remotion Studio:

```bash
npx tsx scripts/link-show.ts alice-in-dragonland
pnpm studio
```

`AliceTitle` and `AliceCredits` render from the repository alone. The shots themselves need the
generated clips, which are not in git.

## What it costs

List prices, for a four-minute film with about forty shots (from
`shows/alice-in-dragonland/retrospective.md`):

| | |
|---|---|
| Veo 3.1 Lite clips, including a third re-rolled | ~$30 |
| Illustrations, ~80 generations | ~$10 |
| Voices, alignment, music | ~$2 |
| **Media total** | **~$45, roughly $12 per finished minute** |
| Coding agent | your subscription |

Remotion is free for individuals and companies of up to three people; larger companies need a
licence from remotion.dev.
