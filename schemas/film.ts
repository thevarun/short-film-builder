/**
 * `shows/<slug>/film.json` — everything the engine needs to cut a story film, as data.
 *
 * The recording is the timeline. Shots are cut to sentence spans measured from the mp3
 * (`audio/<part>.sentences.json`); the film spec only says which sentences each shot owns and
 * which media plays under them. Arc boundaries, shot windows, playback rates and the music
 * placement are all derived, never written down.
 *
 * Media paths are relative to the show: `art/...` for committed plates, `cache/...` for
 * generated audio, clips and music. The engine reaches them through
 * `engine/public/shows/<slug>/{art,cache}` (see `scripts/link-show.ts`).
 */
import { z } from "zod";

const Point = z.object({ scale: z.number(), x: z.number(), y: z.number() });

/** A slow camera move over a still: from one framing to another, eased. */
export const MoveSchema = z.object({ from: Point, to: Point });

export const ShotSchema = z.object({
  /** `<arc><n><letter>` — the arc is the leading letters, so `B2a` belongs to arc `B`. */
  id: z.string().regex(/^[A-Z]+\d+[a-z]?$/, "shot ids look like A1, B2a"),
  /** Which recording this shot is cut against; sentence indices are local to it.
   *  Defaults to the first part. */
  part: z.string().optional(),
  /** [first, last] sentence, inclusive, in that part's sentences file. */
  sentence: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  /** Live shot: a generated clip and its real length. */
  video: z.string().optional(),
  clipSeconds: z.number().positive().optional(),
  /** Use only this range of the clip, in seconds from its start. */
  trim: z.tuple([z.number().min(0), z.number().positive()]).optional(),
  /** 2.5D shot: a still under a camera move. */
  image: z.string().optional(),
  move: MoveSchema.optional(),
  /** Drifting gold motes over the shot. */
  motes: z.boolean().optional(),
  /** Crossfade into this shot, in frames. 0 = chained join (the previous clip's last frame is
   *  this clip's first), 8 = cut, 14 = dissolve, 24 = new location. Default 14. */
  fadeIn: z.number().int().min(0).optional(),
  /** A still of this shot's own final frame. A closing shot plays at 1x and freezes on it for
   *  the silent tail instead of being slowed to fill it (`extract-tail-frames`). */
  hold: z.string().optional(),
  /** Data-driven shot: a component from the show's pack (`engine/src/packs/<show>`) with its
   *  props. Word anchors inside props resolve against `audio/<part>.words.json`, so a stat
   *  or a pin appears on the spoken word — never on a hand-written time. */
  component: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  /** Why the shot is cut this way — kept in the data so the worked example teaches. */
  note: z.string().optional(),
}).superRefine((s, ctx) => {
  if (s.video && !s.clipSeconds) ctx.addIssue({ code: "custom", message: `${s.id}: video needs clipSeconds` });
  if (!s.video && !s.image && !s.component) ctx.addIssue({ code: "custom", message: `${s.id}: needs video, image or component` });
  if (s.image && !s.video && !s.move) ctx.addIssue({ code: "custom", message: `${s.id}: a still needs a move` });
  if (s.sentence[1] < s.sentence[0]) ctx.addIssue({ code: "custom", message: `${s.id}: sentence range reversed` });
  if (s.trim && s.trim[1] <= s.trim[0]) ctx.addIssue({ code: "custom", message: `${s.id}: trim range reversed` });
});

export const CreditLineSchema = z.object({
  /** A section heading, on its own line. */
  heading: z.string().optional(),
  /** `role — name`, e.g. Story / the author. */
  role: z.string().optional(),
  name: z.string().optional(),
});

export const FilmSchema = z.object({
  show: z.string(),
  /** Composition-id prefix: `Alice` → `AliceArcA`, `AliceAB`, `AliceFilm`, `AliceTitle`. */
  id: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
  title: z.string(),
  byline: z.string().optional(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  /** Held on the last image after the final word, so an arc ends rather than stops. */
  tailSec: z.number().min(0).default(2.5),
  defaultFade: z.number().int().min(0).default(14),
  /** Playback-rate bounds for a clip retimed to its window (`check-retime`). */
  rate: z.object({ min: z.number().positive(), max: z.number().positive() }).default({ min: 0.5, max: 1.3 }),
  /** One entry per recording, in story order; each lists its arcs in order. The audio is
   *  `cache/audio/<part>.mp3`, the measured lines `audio/<part>.sentences.json`. */
  parts: z.array(z.object({
    /** Also the recording's file stem (`cache/audio/<id>.mp3`) and a composition-id suffix. */
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/),
    arcs: z.array(z.string().regex(/^[A-Z]+$/)).min(1),
  })).min(1),
  shots: z.array(ShotSchema).min(1),
  cards: z.object({
    title: z.object({
      seconds: z.number().positive().default(7),
      /** A plate under the title, slowly pushed in. Plain ground when omitted. */
      backdrop: z.string().optional(),
      face: z.enum(["swash", "almendra"]).default("swash"),
    }).optional(),
    fin: z.object({
      seconds: z.number().positive().default(5),
      text: z.string().default("Fin"),
    }).optional(),
    credits: z.object({
      seconds: z.number().positive(),
      lines: z.array(CreditLineSchema).min(1),
    }).optional(),
  }).default({}),
  /** One instrumental cue under the whole film: `cache/music/<cue>.mp3`, measured in
   *  `audio/music-<cue>.json` by `compose-music`. */
  music: z.object({
    cue: z.string(),
    /** Gain under narration, under the title card, and under the end cards. */
    levels: z.object({
      under: z.number().min(0).max(1),
      cards: z.number().min(0).max(1),
      end: z.number().min(0).max(1),
    }).default({ under: 0.13, cards: 0.42, end: 0.6 }),
    fadeInSec: z.number().min(0).default(2),
    fadeOutSec: z.number().min(0).default(1.5),
    /** The cue's measured landing is pinned this far before the picture ends, so its last
     *  strong bars play under the end cards and the fade-out takes only the decay. */
    landingLeadSec: z.number().min(0).default(1.5),
    /** The cue may end before the picture does (it then starts with sound and runs out under
     *  the credits). `check-retime` warns instead of failing. Off by default: silence under
     *  an end card was a reviewed defect once. */
    allowEarlyEnd: z.boolean().default(false),
    /** Also play the cue (at `levels.under`) in standalone arc and part renders, so a slice
     *  reviews the way the film will sound. Off by default: music under an arc masks the
     *  speech onsets `verify-sync` listens for, so its check falls back to alignment-only. */
    underArcs: z.boolean().default(false),
  }).optional(),
});

export type Move = z.infer<typeof MoveSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type CreditLine = z.infer<typeof CreditLineSchema>;
export type FilmSpec = z.infer<typeof FilmSchema>;
/** The shape on disk, before defaults are applied. */
export type FilmSpecInput = z.input<typeof FilmSchema>;

/** `audio/<part>.sentences.json`: one entry per spoken sentence, measured from the mp3. */
export const SentenceSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
}).passthrough();
export type Sentence = z.infer<typeof SentenceSchema>;

/** `audio/<part>.words.json`: every spoken word with its measured span and the index of the
 *  sentence it belongs to (`word-cues`). Component shots anchor visuals to these. */
export const WordSchema = z.object({
  word: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  sentence: z.number().int().min(0),
});
export type Word = z.infer<typeof WordSchema>;

/** `audio/music-<cue>.json`, written by `compose-music`. */
export const MusicMetaSchema = z.object({
  cue: z.string(),
  durationSec: z.number().positive(),
  soundStartSec: z.number().min(0),
  /** The last moment the cue is still strong (above −30 dB): where the final chord lands. */
  landingSec: z.number().min(0),
  soundEndSec: z.number().min(0),
});
export type MusicMeta = z.infer<typeof MusicMetaSchema>;
