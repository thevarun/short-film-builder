import { z } from "zod";

/**
 * Asset registry entry. No asset enters a render without one.
 * The YouTube-description attribution block is generated from this — never hand-written.
 */

export const AssetSource = z.enum([
  "generated-image", // NanoBanana etc.
  "generated-clip", // keyframe interpolation via fal.ai / Vertex
  "generated-audio", // music/sting (Suno etc.)
  "fetched", // Pexels / Pixabay / Wikimedia
  "manual", // Earth Studio exports, hand-crafted SVGs
]);

export const GenerationInputs = z.object({
  tool: z.string(), // e.g. "nanobanana", "fal:wan-flf2v", "fal:kling-o1"
  prompt: z.string().optional(),
  model: z.string().optional(),
  seed: z.number().optional(),
  /** For keyframe interpolation: asset ids of start/end frames. */
  keyframeAssetIds: z.array(z.string()).optional(),
});

export const AssetEntry = z.object({
  id: z.string(),
  path: z.string(),
  source: AssetSource,
  license: z.string(), // e.g. "generated", "Pexels", "CC-BY-SA-4.0"
  attribution: z.string().optional(), // required for fetched assets
  sourceUrl: z.string().optional(),
  durationInSeconds: z.number().positive().optional(),
  tags: z.array(z.string()).default([]),
  createdFor: z.string().optional(), // "show/episode"
  generation: GenerationInputs.optional(),
});

export const AssetManifest = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(AssetEntry),
});

export type AssetEntry = z.infer<typeof AssetEntry>;
