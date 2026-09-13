import { z } from "zod";

/**
 * Episode manifest — the machine-readable spine of an episode.
 * Written by the agent (from the parsed script + measured audio), consumed by
 * deterministic scripts and the Remotion engine. v0 — expect churn during Ep 1-3;
 * bump `schemaVersion` on breaking changes.
 */

export const SyncMaster = z.enum(["audio", "visual", "music"]);

/** A visual event anchored to a spoken word, resolved to frames from alignment JSON. */
export const WordCue = z.object({
  /** Word (or exact phrase) in this segment's narration that triggers the cue. */
  anchor: z.string(),
  /** 1-based occurrence of the anchor within the segment, if it appears more than once. */
  occurrence: z.number().int().positive().default(1),
  /** What happens: component-specific action id, e.g. "highlight-state", "reveal-stat". */
  action: z.string(),
  props: z.record(z.unknown()).optional(),
});

export const SegmentAudio = z.object({
  /** Relative path to the segment's audio file (episode-local or cache). */
  file: z.string(),
  durationInSeconds: z.number().positive(),
  /** Relative path to alignment-derived Caption[] JSON (@remotion/captions format). */
  captionsFile: z.string().optional(),
  /** Hash of (text, voiceId, modelId, dictVersion) — cache key & idempotency check. */
  contentHash: z.string(),
});

export const SegmentVisual = z.object({
  /** Remotion component key (from neutral library or show pack), e.g. "stat-sprint". */
  component: z.string(),
  /** Asset ids from the asset manifest used by this segment. */
  assetIds: z.array(z.string()).default([]),
  props: z.record(z.unknown()).optional(),
  /** For sync=visual: the clip's intrinsic duration (also the narration budget). */
  fixedDurationInSeconds: z.number().positive().optional(),
});

export const Segment = z.object({
  id: z.string(),
  /** Segment type from the show's format, e.g. "cold-open", "dialogue", "pin-drop". */
  type: z.string(),
  sync: SyncMaster.default("audio"),
  /** Speaker role key resolved via the brand/show voice map. Omit for music-only. */
  speaker: z.string().optional(),
  /** Narration text — pre-normalized (numbers spelled out); source of truth is script.md. */
  text: z.string().optional(),
  audio: SegmentAudio.optional(),
  visual: SegmentVisual.optional(),
  cues: z.array(WordCue).default([]),
});

export const EpisodeManifest = z.object({
  schemaVersion: z.literal(1),
  show: z.string(),
  episode: z.string(),
  title: z.string(),
  brand: z.string(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  segments: z.array(Segment).min(1),
  music: z
    .object({
      bedAssetId: z.string().optional(),
      /** Ducking handled via precomputed volume envelopes at assembly time. */
      duckUnderNarration: z.boolean().default(true),
    })
    .optional(),
});

export type EpisodeManifest = z.infer<typeof EpisodeManifest>;
export type Segment = z.infer<typeof Segment>;
