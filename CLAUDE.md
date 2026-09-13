@AGENTS.md

## Claude Code specifics

- `/story-film <story> [slug]` runs the twelve-stage workflow with its gates; `video-shot-prompts` loads when editing `shows/*/motion/*.json`; the `remotion-*` skills are Remotion's own.
- `.claude/rules/` load by path: `audio-timeline.md` for scripts, audio and motion specs; `remotion.md` for `engine/`.
- A PostToolUse hook runs `verify-picture` and `verify-sync` after every `remotion render` and blocks on failure. Detached (`nohup`) renders are verified by hand when they land.
- Worked example with costs: `shows/alice-in-dragonland/retrospective.md`.
