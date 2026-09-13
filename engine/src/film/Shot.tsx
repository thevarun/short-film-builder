import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";
import type { Move } from "../../../schemas/film";
import { Motes } from "./Motes";

export const GROUND = "#0d0b09";

/**
 * One shot. Live shots play a generated clip retimed to fill their window; 2.5D shots
 * hold a still under an eased camera move. Both get the same vignette and crossfade so
 * the two treatments cut together without announcing themselves.
 *
 * `video`, `image` and `hold` are resolved URLs (already through `staticFile`).
 */
export const Shot: React.FC<{
  image?: string;
  video?: string;
  /** Real length of the clip, used to work out the playback rate that fills the window. */
  clipSeconds?: number;
  /** Use only part of the clip, in seconds from its start. Lets an approved take be
   *  shortened without regenerating it. */
  trim?: [number, number];
  fps: number;
  move?: Move;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  motes?: boolean;
  /** Still of this shot's own final frame; the shot freezes on it once the clip runs out. */
  hold?: string;
  /** A component shot: rendered content instead of media. Gets the same fades so it cuts
   *  against clips and stills without announcing itself; no vignette (its ground is its own). */
  children?: React.ReactNode;
}> = ({
  image, video, clipSeconds, trim, fps, move,
  durationInFrames, fadeInFrames, fadeOutFrames, motes, hold, children,
}) => {
  const frame = useCurrentFrame();

  // Two independent ramps rather than one four-point range: a chained join has a
  // zero-length fade, which would collapse the range and stop it increasing.
  const fadeIn = fadeInFrames > 0
    ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const fadeOut = fadeOutFrames > 0
    ? interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const opacity = Math.min(fadeIn, fadeOut);

  let content: React.ReactNode;

  if (children) {
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: GROUND }}>
        <AbsoluteFill style={{ overflow: "hidden" }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (video && clipSeconds) {
    const usableSec = trim ? trim[1] - trim[0] : clipSeconds;
    // A shot with a hold frame plays at 1x for its own length and then freezes on its final
    // frame for whatever window is left. Everything else is stretched or compressed to cover
    // its window exactly; below ~0.5 that reads as slow-motion rather than a slower camera.
    const playFrames = hold ? Math.min(durationInFrames, Math.round(usableSec * fps)) : durationInFrames;
    const playbackRate = Math.max(0.45, usableSec / (playFrames / fps));
    content = frame < playFrames || !hold
      ? (
        <OffthreadVideo
          src={video}
          playbackRate={playbackRate}
          trimBefore={trim ? Math.round(trim[0] * fps) : undefined}
          // No trimAfter. Remotion applies it in composition frames without dividing by the
          // playback rate, so a 1.7s trim played at 0.66x went black after 1.7s of a 2.57s
          // window. The Sequence already ends exactly when the source reaches trim[1],
          // because the rate is derived from that — so the end bound is redundant here.
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )
      : <Img src={hold} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  } else if (image && move) {
    const p = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    // Ease so the camera settles rather than stopping dead.
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const lerp = (a: number, b: number) => a + (b - a) * eased;
    content = (
      <Img
        src={image}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${lerp(move.from.scale, move.to.scale)}) translate(${lerp(move.from.x, move.to.x)}%, ${lerp(move.from.y, move.to.y)}%)`,
          transformOrigin: "center center",
        }}
      />
    );
  }

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: GROUND }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {content}
        {motes ? <Motes /> : null}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(40,24,10,0.34) 100%)" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
