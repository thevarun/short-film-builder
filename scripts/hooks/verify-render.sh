#!/usr/bin/env bash
# PostToolUse hook (Bash): after any `remotion render`, check the rendered file.
#
# Runs verify-picture (black frames) on every render and verify-sync (cuts vs speech onsets)
# on compositions it knows. Exits 2 on a failure so the result reaches Claude as feedback —
# a render is not done until both pass on the file, and this makes that a gate rather than a
# habit. Anything that is not a remotion render exits 0 silently.
set -u
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
case "$cmd" in *"remotion render"*) ;; *) exit 0 ;; esac
case "$cmd" in *nohup*) exit 0 ;; esac   # detached render: the file is not there yet; verify it by hand when it lands

# `remotion render <entry> <Composition> <output.mp4>` — possibly prefixed by `cd engine &&`.
comp=$(printf '%s' "$cmd" | sed -nE 's/.*remotion render[[:space:]]+[^[:space:]]+[[:space:]]+([A-Za-z0-9_]+)[[:space:]]+([^[:space:]]+\.mp4).*/\1/p')
out=$(printf '%s' "$cmd" | sed -nE 's/.*remotion render[[:space:]]+[^[:space:]]+[[:space:]]+[A-Za-z0-9_]+[[:space:]]+([^[:space:]]+\.mp4).*/\1/p')
[ -n "$comp" ] && [ -n "$out" ] || exit 0
case "$comp" in *Title|*Credits) exit 0 ;; esac   # card previews: no narration, meant to be dark

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
out="${out#../}"   # a `../out/…` path can only be relative to engine/; everything else is repo-relative
file="$root/$out"
[ -f "$file" ] || { echo "verify-render: $out not found after render" >&2; exit 2; }

fail=0
pic=$(cd "$root" && npx tsx scripts/verify-picture.ts "$out" --comp "$comp" 2>&1) || fail=1   # a *Film comp allows its end cards to be dark
case "$comp" in
  *Film) sync="verify-sync: skipped (multi-part film; the arcs and parts were checked)" ;;
  *) sync=$(cd "$root" && npx tsx scripts/verify-sync.ts "$out" "$comp" 2>&1) || fail=1 ;;
esac

if [ "$fail" -ne 0 ]; then
  printf 'RENDER CHECKS FAILED for %s\n\n%s\n\n%s\n' "$out" "$pic" "$sync" >&2
  exit 2
fi
printf 'render checks passed: %s — %s; %s\n' "$out" "$(printf '%s' "$pic" | tail -1)" "$(printf '%s' "$sync" | tail -1)"
