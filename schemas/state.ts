import { z } from "zod";

/**
 * Episode state file — reconciles planned intent vs. files on disk so work
 * resumes cleanly across sessions (pattern: claude-code-video-toolkit's project.json).
 * Gates are approved by the human, recorded here by the agent.
 */

export const Stage = z.enum([
  "scaffolded",
  "research",
  "script",
  "audio",
  "assets",
  "assembly",
  "rendered",
  "published",
]);

export const GateStatus = z.enum(["pending", "approved", "rework"]);

export const EpisodeState = z.object({
  schemaVersion: z.literal(1),
  show: z.string(),
  episode: z.string(),
  stage: Stage,
  gates: z.object({
    research: GateStatus.default("pending"),
    script: GateStatus.default("pending"),
    podcastCheckpoint: GateStatus.default("pending"),
    assetContactSheet: GateStatus.default("pending"),
    preview: GateStatus.default("pending"),
  }),
  /** ISO timestamps, set by scripts — not by hand. */
  updatedAt: z.string(),
  notes: z.array(z.string()).default([]),
});

export type EpisodeState = z.infer<typeof EpisodeState>;
