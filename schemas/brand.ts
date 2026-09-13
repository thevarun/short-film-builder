import { z } from "zod";

/**
 * Brand kit — swappable identity profile. All Remotion components consume this
 * via context; zero hardcoded brand values in components.
 * Visual tokens may be seeded from vt-design-studio themes (scaffold-time copy).
 */

export const VisualTokens = z.object({
  colors: z.record(z.string()),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
    mono: z.string().optional(),
  }),
  radius: z.string().optional(),
});

export const MotionTokens = z.object({
  /** Timing personality: e.g. "snappy" (Fireship) vs "serene" (documentary). */
  personality: z.enum(["snappy", "balanced", "serene"]).default("balanced"),
  transitionStyle: z.string().default("fade"),
  transitionDurationInFrames: z.number().int().positive().default(15),
  easing: z.string().default("ease-in-out"),
});

export const VoiceProfile = z.object({
  voiceId: z.string(),
  modelId: z.string().default("eleven_multilingual_v2"),
  settings: z.record(z.unknown()).optional(),
});

export const BrandKit = z.object({
  schemaVersion: z.literal(1),
  slug: z.string(),
  name: z.string(),
  /** Provenance note if seeded from a vt-design-studio theme. */
  seededFromTheme: z.string().optional(),
  visual: VisualTokens,
  motion: MotionTokens,
  /** Role → voice, e.g. narrator / skeptic / state. Shows reference roles, not voice ids. */
  voices: z.record(VoiceProfile),
  audio: z.object({
    themeAssetId: z.string().optional(),
    stingAssetId: z.string().optional(),
    musicStyle: z.string().optional(),
  }),
  identity: z.object({
    logoAssetId: z.string().optional(),
    /** NanoBanana character-consistency anchors. */
    mascotReferenceAssetIds: z.array(z.string()).default([]),
  }),
});

export type BrandKit = z.infer<typeof BrandKit>;
