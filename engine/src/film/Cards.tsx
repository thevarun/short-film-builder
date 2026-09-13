/**
 * Title card, end card and credits roll.
 *
 * The title sits on one of the film's own plates under a slow push; the end card and the
 * credits on the warm dark ground the shots fade through. The title is set in a fairy-tale
 * face — calligraphic, old-book — with a warm gold fill, an extruded bronze shadow and a
 * flourish above and below, so the card reads as the first page of a storybook rather than
 * a slate. The byline, the end card and the credits use an elegant italic that defers to it.
 */
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadAlmendra } from "@remotion/google-fonts/Almendra";
import { loadFont as loadSwash } from "@remotion/google-fonts/BerkshireSwash";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import type { CreditLine } from "../../../schemas/film";
import { Motes } from "./Motes";

const almendra = loadAlmendra("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily;
const swash = loadSwash("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const cormorant = loadCormorant("normal", { weights: ["500", "600"], subsets: ["latin"] }).fontFamily;
const cormorantItalic = loadCormorant("italic", { weights: ["500"], subsets: ["latin"] }).fontFamily;

const CREAM = "#FBF6EC";
const GOLD = "#E8C27A";
const BRONZE = "#7A4E22";   // the extrusion — the title's shadowed side
const INK = "#3A2412";      // the stroke that separates the face from the sky
const GROUND = "#16120F";

export type TitleFace = "almendra" | "swash";

/** Fade in over `up` frames, hold, fade out over the last `down` frames. */
const envelope = (frame: number, total: number, up: number, down: number) =>
  Math.min(
    interpolate(frame, [0, up], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [total - down, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

/** A calligraphic flourish: a long stroke that curls at both ends, with a leaf at centre. */
const Flourish: React.FC<{ flip?: boolean; opacity: number }> = ({ flip, opacity }) => (
  <svg
    width="560" height="44" viewBox="0 0 560 44" fill="none"
    style={{ opacity, transform: flip ? "scaleY(-1)" : undefined, filter: "drop-shadow(0 2px 10px rgba(22,18,15,0.7))" }}
  >
    <path
      d="M12 30 C 60 30, 90 10, 150 22 C 200 32, 230 30, 268 22 M292 22 C 330 30, 360 32, 410 22 C 470 10, 500 30, 548 30"
      stroke={GOLD} strokeWidth="3.4" strokeLinecap="round"
    />
    <path d="M12 30 c -6 -4, -8 -12, -2 -16 c 6 -3, 10 4, 6 9" stroke={GOLD} strokeWidth="2.8" strokeLinecap="round" />
    <path d="M548 30 c 6 -4, 8 -12, 2 -16 c -6 -3, -10 4, -6 9" stroke={GOLD} strokeWidth="2.8" strokeLinecap="round" />
    <path d="M280 8 c 7 4, 9 12, 0 20 c -9 -8, -7 -16, 0 -20 z" fill={GOLD} />
  </svg>
);

const goldFace: React.CSSProperties = {
  backgroundImage: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM} 42%, ${GOLD} 100%)`,
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
};

export const TitleCard: React.FC<{
  title: string;
  byline?: string;
  /** Resolved URL of the plate under the title. */
  backdrop?: string;
  face?: TitleFace;
}> = ({ title, byline, backdrop, face = "swash" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = envelope(frame, durationInFrames, fps, fps);
  // The flourishes draw in first, the title blooms, then the byline arrives a beat later.
  const flourish = envelope(frame - Math.round(fps * 0.2), durationInFrames - Math.round(fps * 0.2), fps, fps);
  const bylineOpacity = envelope(frame - Math.round(fps * 1.1), durationInFrames - Math.round(fps * 1.1), fps, fps);
  const bloom = interpolate(frame, [0, fps * 1.4], [0.975, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, durationInFrames], [1.04, 1.12]);

  // A long title steps the size down so it stays on one or two comfortable lines.
  const size = Math.round((face === "swash" ? 138 : 150) * Math.min(1, 22 / Math.max(22, title.length)));
  const titleStyle: React.CSSProperties = face === "swash"
    ? { fontFamily: swash, fontWeight: 400, fontSize: size, letterSpacing: "0.01em" }
    : { fontFamily: almendra, fontWeight: 700, fontSize: size, letterSpacing: "0.015em" };

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      {backdrop ? (
        <Img src={backdrop} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      ) : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(22,18,15,0.14) 35%, rgba(22,18,15,0.78) 100%)" }} />
      <Motes count={48} seed={7} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Flourish opacity={flourish} />
        {/* Two layers of the same text. The back layer is solid bronze and carries the
            extrusion (a stack of one-pixel-step shadows) and a soft drop shadow; the front
            layer carries the gold fill, which cannot take a text-shadow of its own because
            its glyphs are transparent. Together they read as lettering cut from gold leaf. */}
        <div style={{ position: "relative", transform: `scale(${bloom})`, opacity, padding: "0 40px", margin: "6px 0 2px" }}>
          <div aria-hidden style={{
            ...titleStyle, lineHeight: 1.05, color: BRONZE, position: "absolute", inset: 0, padding: "0 40px",
            textShadow: [
              ...Array.from({ length: 9 }, (_, i) => `${i + 1}px ${i + 1}px 0 ${BRONZE}`),
              `12px 16px 26px rgba(22,18,15,0.65)`,
              `0 0 46px rgba(232,194,122,0.30)`,
            ].join(", "),
          }}>
            {title}
          </div>
          <div style={{ ...titleStyle, ...goldFace, lineHeight: 1.05, position: "relative", WebkitTextStroke: `1.4px ${INK}` }}>
            {title}
          </div>
        </div>
        <Flourish flip opacity={flourish} />
        {byline ? (
          <div style={{
            fontFamily: cormorantItalic, fontStyle: "italic", fontWeight: 500, fontSize: 50,
            marginTop: 22, letterSpacing: "0.04em", color: CREAM, opacity: bylineOpacity,
            textShadow: "0 3px 18px rgba(22,18,15,0.6)",
          }}>
            {byline}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const FinCard: React.FC<{ text?: string }> = ({ text = "Fin" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const opacity = envelope(frame, durationInFrames, Math.round(fps * 1.4), Math.round(fps * 1.2));
  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      <Motes count={18} seed={3} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
        <div style={{
          fontFamily: cormorantItalic, fontStyle: "italic", fontWeight: 500, fontSize: 170,
          letterSpacing: "0.04em", ...goldFace,
          filter: "drop-shadow(0 0 30px rgba(232,194,122,0.25))",
        }}>
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ROW = 104;
const HEADING = 190;

/**
 * A classic roll: role on the left in gold small capitals, name on the right in cream,
 * headings centred in the title face. The column travels from below the frame to above it
 * over the whole card, at a constant speed — the length of the card sets the pace, so a
 * longer list wants more seconds, not a faster scroll.
 */
export const CreditsRoll: React.FC<{ lines: CreditLine[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  const opacity = envelope(frame, durationInFrames, fps, fps);
  const contentHeight = lines.reduce((h, l) => h + (l.heading ? HEADING : ROW), 0);
  const travel = height + contentHeight;
  const top = height - (frame / Math.max(1, durationInFrames - 1)) * travel;

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      <Motes count={18} seed={5} />
      <div style={{ position: "absolute", left: 0, right: 0, top, opacity }}>
        {lines.map((l, i) => l.heading ? (
          <div key={i} style={{
            height: HEADING, display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: 34, fontFamily: swash, fontSize: 64, ...goldFace,
          }}>
            {l.heading}
          </div>
        ) : (
          <div key={i} style={{
            height: ROW, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 56, alignItems: "center",
          }}>
            <div style={{
              textAlign: "right", fontFamily: cormorant, fontWeight: 600, fontSize: 30,
              letterSpacing: "0.22em", textTransform: "uppercase", color: GOLD,
            }}>
              {l.role}
            </div>
            <div style={{ textAlign: "left", fontFamily: cormorant, fontWeight: 500, fontSize: 54, color: CREAM }}>
              {l.name}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
