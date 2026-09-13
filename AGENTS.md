# Agent instructions

This repository turns a written story into a narrated, animated short film. An agent directs;
deterministic scripts execute; Remotion renders. Read this file first, whichever agent you are.
Claude Code users also get skills, hooks and path-scoped rules from `.claude/`; every other
agent follows the same process from `docs/animated-story-pipeline.md` by hand.

## Setting up

Follow `SETUP.md`. The gate is `npx tsx scripts/doctor.ts` printing no ✗. Keys live in `.env`
and are never printed, committed, or entered anywhere by an agent: when doctor reports a missing
key, tell the user which page to open and what to paste, then run doctor again.

## Invariants

1. **Agent directs, scripts execute.** Write schema-validated artifacts; `scripts/` do TTS, alignment, generation, rendering. No LLM calls in the render path.
2. **Audio is the timeline and the mp3 is the ruler.** After recording: `force-align` → `split-sentences` → `align-sentences`. Cut shots to sentence spans, never to fractions of a beat.
3. **A story film is data.** `shows/<slug>/film.json` (schema `schemas/film.ts`) drives generic compositions in `engine/src/film/`. Add shots to the JSON; never write per-show engine code.
4. **Every stage gates before the next.** Review before spend. A render is not done until `verify-sync` and `verify-picture` pass on the rendered file.
5. **Never AI-generate maps** (border hallucination is a publishing risk). No text or logos inside generated frames.
6. **Generated media is gitignored.** Paid outputs cache under `cache/` by content hash and archive an immutable copy; approved outputs are marked `reuseClip`.
7. Pre-normalize numbers and abbreviations; call TTS with `apply_text_normalization: "off"`. Pronunciation dictionaries are alias-only on `eleven_v3`.
8. `@remotion/captions` `Caption` is the timestamp interchange format.
9. OpenMontage (AGPL) is patterns-only — never copy its code.

## Commands (pnpm, from the repo root)

- `pnpm install` · `pnpm typecheck` · `pnpm studio` (Remotion Studio, instant preview of any composition)
- Check the machine: `npx tsx scripts/doctor.ts`
- Render: `cd engine && pnpm exec remotion render src/index.ts <Comp> ../out/<show>/{film|arcs}/<name>-vN.mp4`
- Pipeline scripts: `npx tsx scripts/<name>.ts <show> …` — order of use in `docs/animated-story-pipeline.md`

## Layout

- `engine/` — Remotion workspace; `src/film/` is the generic story engine, `src/packs/<slug>/` optional show-specific components.
- `scripts/` — deterministic jobs · `schemas/` — Zod · `docs/` — process and learnings
- `shows/<slug>/` — bibles and plans; `film.json`; `audio/` (scripts, measured timings); `motion/` (Veo specs); `art/` (plates; `_superseded/` ignored). Run `scripts/link-show.ts <slug>` once so the engine can reach its media.
- `cache/<show>/`, `out/<show>/` — gitignored media

## Services

- **ElevenLabs** — `ELEVENLABS_API_KEY`. Dialogue: `text-to-dialogue/with-timestamps` (eleven_v3, ≤2000 chars, ≤10 voices). Forced alignment and music need those permissions on the key; doctor checks.
- **Google Vertex AI** — Veo 3.1 lite/fast/standard; clips are 4, 6 or 8 s only. Auth is Application Default Credentials (`gcloud auth application-default login`); it expires within a working session, so check before a batch.
- **Gemini images** — `GEMINI_API_KEY`, used through the `nanobanana` MCP server declared in `.mcp.json`.

## Conventions

- Conventional Commits, one line. Commit only when asked.
- Media paths in `film.json` are show-relative (`art/…`, `cache/…`).
- zsh does not word-split unquoted variables — quote or use `while read`. Detach generations longer than ten minutes with `nohup`.
