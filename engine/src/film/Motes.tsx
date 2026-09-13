import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Drifting gold spirit motes. Deterministic — position is a pure function of frame and
 * index, so renders are reproducible and there is no random flicker between frames.
 */
export const Motes: React.FC<{ count?: number; seed?: number }> = ({
  count = 26,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const n = i * 2654435761 * seed;
        const rx = ((n >>> 8) % 1000) / 1000;
        const ry = ((n >>> 16) % 1000) / 1000;
        const rs = ((n >>> 4) % 1000) / 1000;
        const speed = 0.06 + rs * 0.1;
        const sway = Math.sin(t * (0.35 + rs * 0.5) + i) * 1.6;
        const y = (ry - t * speed) % 1;
        const size = 2 + rs * 5;
        const opacity = (0.18 + rs * 0.4) * (0.6 + 0.4 * Math.sin(t * 0.8 + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${rx * 100 + sway}%`,
              top: `${((y + 1) % 1) * 100}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgb(255, 226, 158)",
              opacity,
              filter: `blur(${0.5 + rs}px)`,
              boxShadow: "0 0 6px rgba(255,214,130,0.7)",
            }}
          />
        );
      })}
    </div>
  );
};
