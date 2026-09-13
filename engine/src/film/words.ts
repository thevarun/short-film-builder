/**
 * Word anchors: a component shot names the spoken word a visual should land on, and the
 * frame is derived from the measured word timings. Pure — no React, usable from scripts.
 */
import type { Word } from "../../../schemas/film";

export type AnchorSpec = string | { anchor: string; occurrence?: number };

/** What a component shot knows about its window and the words spoken inside it. */
export type ShotCtx = {
  fps: number;
  durationInFrames: number;
  /** Part time (seconds) at which the shot's Sequence starts. */
  startSec: number;
  /** The words of this shot's own sentences, in order. */
  words: Word[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Part time at which the anchor phrase is spoken (nth occurrence within the shot's words). */
export function anchorTime(words: Word[], spec: AnchorSpec): number | undefined {
  const a = typeof spec === "string" ? { anchor: spec, occurrence: 1 } : { occurrence: 1, ...spec };
  const tokens = a.anchor.split(/\s+/).map(norm).filter(Boolean);
  if (!tokens.length) return undefined;
  let seen = 0;
  for (let i = 0; i + tokens.length <= words.length; i++) {
    if (tokens.every((t, k) => norm(words[i + k].word) === t)) {
      seen++;
      if (seen === a.occurrence) return words[i].start;
    }
  }
  return undefined;
}

/** Frame within the shot at which the anchor is spoken; 0 (and a warning) when not found,
 *  so a typo shows the visual early rather than never. */
export function anchorFrame(ctx: ShotCtx, spec?: AnchorSpec): number {
  if (spec === undefined) return 0;
  const t = anchorTime(ctx.words, spec);
  if (t === undefined) {
    console.warn(`word anchor not found in shot: ${JSON.stringify(spec)}`);
    return 0;
  }
  return Math.max(0, Math.round((t - ctx.startSec) * ctx.fps));
}
