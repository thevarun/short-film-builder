/**
 * Pure timing logic for a story film, shared by the compositions and by the scripts
 * (`check-retime`, `verify-sync`, `build-storyboard`). No React or Remotion imports: a node
 * script must be able to load it, and the numbers it produces must be the same in both.
 *
 * Everything here is derived from two inputs: the film spec (`film.json`) and the measured
 * sentence spans of each recording. Nothing about *when* is written down by hand.
 */
import type { FilmSpec, MusicMeta, Sentence, Shot, Word } from "../../../schemas/film";

export type Film = {
  spec: FilmSpec;
  /** Measured sentences per part, from forced alignment of the mp3. */
  lines: Record<string, Sentence[]>;
  /** The mp3 duration per part, from ffprobe. */
  total: Record<string, number>;
  music?: MusicMeta;
  /** Measured words per part (`word-cues`), for component shots' anchors. */
  words?: Record<string, Word[]>;
};

/** One renderable composition: an arc or a whole part. Times are seconds into the part's
 *  recording; a standalone arc shifts everything back by `from` so it starts at frame 0. */
export type Comp = {
  id: string;
  kind: "arc" | "part";
  part: string;
  arc?: string;
  from: number;
  /** Where the composition ends, including its held tail. */
  to: number;
  /** The last word it owns. Everything after is a SILENT held tail: the recording is one
   *  take, so without an explicit end an arc keeps playing the next arc's line. */
  audioEnd: number;
};

export type ShotWindow = {
  shot: Shot;
  startSec: number;
  from: number;
  durationInFrames: number;
};

export type Retime = { id: string; clipSec: number; windowSec: number; rate: number; ok: boolean };

const mid = (a: number, b: number) => (a + b) / 2;

export const partOf = (film: Film, shot: Shot): string => shot.part ?? film.spec.parts[0].id;

/** Assemble and cross-check a film. Throws with a readable message on the first hole. */
export function buildFilm(
  spec: FilmSpec,
  lines: Record<string, Sentence[]>,
  total: Record<string, number>,
  music?: MusicMeta,
  words?: Record<string, Word[]>,
): Film {
  const film: Film = { spec, lines, total, music, words };
  for (const s of spec.shots) {
    const part = s.part ?? spec.parts[0].id;
    if (s.component && !words?.[part]) throw new Error(`${spec.show}: shot ${s.id} is a component shot but part ${part} has no audio/${part}.words.json (run word-cues)`);
  }
  for (const p of spec.parts) {
    if (!lines[p.id]?.length) throw new Error(`${spec.show}: part ${p.id} has no sentences (audio/${p.id}.sentences.json)`);
    if (!(total[p.id] > 0)) throw new Error(`${spec.show}: part ${p.id} has no totalSec (audio/${p.id}.timings.json)`);
  }
  const ids = new Set<string>();
  for (const s of spec.shots) {
    if (ids.has(s.id)) throw new Error(`${spec.show}: duplicate shot ${s.id}`);
    ids.add(s.id);
    const part = partOf(film, s);
    const ls = lines[part];
    if (!ls) throw new Error(`${spec.show}: shot ${s.id} names unknown part ${part}`);
    if (s.sentence[1] >= ls.length) throw new Error(`${spec.show}: shot ${s.id} sentence ${s.sentence[1]} beyond part ${part} (${ls.length} lines)`);
    const arc = arcOf(s);
    const p = spec.parts.find((x) => x.id === part)!;
    if (!p.arcs.includes(arc)) throw new Error(`${spec.show}: shot ${s.id} is in arc ${arc}, which part ${part} does not list`);
  }
  for (const p of spec.parts) for (const a of p.arcs) {
    if (!spec.shots.some((s) => partOf(film, s) === p.id && arcOf(s) === a)) throw new Error(`${spec.show}: arc ${a} has no shots`);
  }
  if (spec.music && !music) throw new Error(`${spec.show}: music cue ${spec.music.cue} has no audio/music-${spec.music.cue}.json`);
  return film;
}

export const arcOf = (shot: Shot): string => shot.id.match(/^[A-Z]+/)![0];

const shotsIn = (film: Film, part: string, arc?: string) =>
  film.spec.shots.filter((s) => partOf(film, s) === part && (!arc || arcOf(s) === arc));

/** The sentences an arc owns: from its first shot's first line to its last shot's last. */
function arcSpan(film: Film, part: string, arc: string): [number, number] {
  const ss = shotsIn(film, part, arc);
  return [Math.min(...ss.map((s) => s.sentence[0])), Math.max(...ss.map((s) => s.sentence[1]))];
}

/**
 * An arc starts in the middle of the measured silence between the previous arc's last line
 * and its own first line, and its narration ends in the middle of the silence before the
 * next arc's first line. Derived from the sentence spans, so the boundary moves with the
 * audio, never with a guess.
 */
export function arcComp(film: Film, arc: string): Comp {
  const part = film.spec.parts.find((p) => p.arcs.includes(arc));
  if (!part) throw new Error(`${film.spec.show}: no part lists arc ${arc}`);
  const i = part.arcs.indexOf(arc);
  const ls = film.lines[part.id];
  const [first, last] = arcSpan(film, part.id, arc);
  const from = i === 0 ? 0 : mid(ls[arcSpan(film, part.id, part.arcs[i - 1])[1]].end, ls[first].start);
  const audioEnd = i === part.arcs.length - 1
    ? film.total[part.id]
    : mid(ls[last].end, ls[arcSpan(film, part.id, part.arcs[i + 1])[0]].start);
  return {
    id: `${film.spec.id}Arc${arc}`, kind: "arc", part: part.id, arc,
    from, audioEnd, to: audioEnd + film.spec.tailSec,
  };
}

/** A whole recording, with the same held tail an arc gets. Without it the last shot has to
 *  race to fit the gap between the final word and the end of the file. */
export function partComp(film: Film, partId: string): Comp {
  const total = film.total[partId];
  if (!(total > 0)) throw new Error(`${film.spec.show}: unknown part ${partId}`);
  return {
    id: `${film.spec.id}${partId}`, kind: "part", part: partId,
    from: 0, audioEnd: total, to: total + film.spec.tailSec,
  };
}

/** Every arc, then every part, in story order. */
export function compositions(film: Film): Comp[] {
  return [
    ...film.spec.parts.flatMap((p) => p.arcs.map((a) => arcComp(film, a))),
    ...film.spec.parts.map((p) => partComp(film, p.id)),
  ];
}

export const findComp = (film: Film, id: string): Comp | undefined =>
  compositions(film).find((c) => c.id === id);

export const compFrames = (film: Film, c: Comp): number => Math.ceil((c.to - c.from) * film.spec.fps);

/**
 * A shot is on screen from the moment its own line starts speaking until the moment the next
 * shot's line starts speaking. Ending each shot where the next begins keeps the cut on the
 * word and hands every trailing pause to the outgoing image, which is where a held beat
 * belongs. (Ending a shot at its own last sentence's END left holes: an audio tag like
 * `[alarmed]` pushes a line's speech up to a second past the previous line's end.)
 */
export function shotWindows(film: Film, c: Comp): ShotWindow[] {
  const { fps } = film.spec;
  const lines = film.lines[c.part];
  const pool = shotsIn(film, c.part, c.arc);
  const spans = pool.map((s) => ({
    s, startSec: lines[s.sentence[0]].start, endSec: lines[s.sentence[1]].end,
  }));
  const windows = spans.map(({ s, startSec, endSec }, i) => {
    const end = i < spans.length - 1 ? spans[i + 1].startSec : endSec;
    return {
      shot: s,
      startSec,
      from: Math.round(startSec * fps),
      durationInFrames: Math.max(1, Math.round((end - startSec) * fps)),
    };
  }).filter((w) => w.startSec < c.to - 0.001);

  if (windows.length) {
    // The first shot fills from the start of the composition. An arc boundary is measured
    // against the audio, not against a sentence start, so the two are a few frames apart —
    // and those frames would otherwise render as black before the first shot appears.
    const first = windows[0];
    const f0 = Math.round(c.from * fps);
    if (first.from > f0) {
      first.durationInFrames += first.from - f0;
      first.from = f0;
      first.startSec = c.from;
    }
    // The last shot always runs to the end of the composition, so a tail after the final
    // word is held on picture instead of cutting to black.
    const last = windows[windows.length - 1];
    last.durationInFrames = Math.max(last.durationInFrames, Math.round(c.to * fps) - last.from);
  }
  return windows;
}

/** How far each live shot is stretched or compressed to fill its window. */
export function retimeReport(film: Film, c: Comp): Retime[] {
  const { fps, rate } = film.spec;
  return shotWindows(film, c).flatMap(({ shot, durationInFrames }) => {
    const usable = shot.trim ? shot.trim[1] - shot.trim[0] : shot.clipSeconds;
    if (!usable) return [];
    const windowSec = durationInFrames / fps;
    // A held shot plays at 1x and freezes; the window it does not fill is covered by the
    // still, so its window length says nothing about its speed.
    const r = shot.hold ? 1 : usable / windowSec;
    return [{ id: shot.id, clipSec: usable, windowSec, rate: r, ok: r <= rate.max && r >= rate.min }];
  });
}

// ---------- the whole film ----------

export type Segment = { from: number; durationInFrames: number };
export type Layout = {
  title?: Segment;
  parts: (Segment & { comp: Comp })[];
  fin?: Segment;
  credits?: Segment;
  totalFrames: number;
  totalSec: number;
};

/** Title card, each part with its held tail, end card, credits — laid end to end. */
export function filmLayout(film: Film): Layout {
  const { fps, cards } = film.spec;
  let f = 0;
  const seg = (sec: number): Segment => {
    const s = { from: f, durationInFrames: Math.ceil(sec * fps) };
    f += s.durationInFrames;
    return s;
  };
  const title = cards.title ? seg(cards.title.seconds) : undefined;
  const parts = film.spec.parts.map((p) => {
    const comp = partComp(film, p.id);
    return { ...seg(comp.to), comp };
  });
  const fin = cards.fin ? seg(cards.fin.seconds) : undefined;
  const credits = cards.credits ? seg(cards.credits.seconds) : undefined;
  return { title, parts, fin, credits, totalFrames: f, totalSec: f / fps };
}

export type MusicPlacement = {
  /** Frames cut from the front of the cue so its landing sits where the film wants it. */
  trimFrames: number;
  /** Positive when the cue is too short to land on cue: it then starts at 0 and runs out
   *  this many seconds before the picture ends. That is a brief to recompose, not a mix. */
  shortBySec: number;
  /** Film frame at which the fade-out completes. */
  endFrame: number;
};

/** The cue's last strong moment lands `landingLeadSec` before the picture ends, so its final
 *  bars play under the end cards at full presence and the fade-out takes only the decay.
 *  Whatever that leaves at the front is trimmed under the fade-in. */
export function musicPlacement(film: Film, layout: Layout): MusicPlacement | undefined {
  const m = film.spec.music;
  if (!m || !film.music) return undefined;
  const { fps } = film.spec;
  const target = layout.totalSec - m.landingLeadSec;
  const offset = film.music.landingSec - target;
  // Never start inside the cue's leading silence: a title card with no music under it is
  // worse than a cue that runs out early. So the trim is at least the leading silence, and
  // "short" means the landing cannot reach its mark from there.
  const trimSec = Math.max(offset, film.music.soundStartSec);
  const shortBySec = Math.max(0, film.music.soundStartSec - offset);
  const trimFrames = Math.round(trimSec * fps);
  const endFrame = shortBySec > 0
    ? Math.min(layout.totalFrames, Math.round((film.music.soundEndSec - trimSec) * fps))
    : layout.totalFrames;
  return { trimFrames, shortBySec, endFrame };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (f: number, a: number, b: number, va: number, vb: number) =>
  b <= a ? vb : va + (vb - va) * clamp01((f - a) / (b - a));

/**
 * Music gain per film frame: present under narration but never competing, lifted under the
 * title card and again under the end cards where nobody is speaking, eased over a second at
 * each boundary; a fade-in at the start and a short fade-out that lets the chord's own decay
 * do most of the work.
 */
export function musicVolume(film: Film, layout: Layout, p: MusicPlacement): (f: number) => number {
  const m = film.spec.music!;
  const { fps } = film.spec;
  const { under, cards, end } = m.levels;
  const narrationFrom = layout.parts[0]?.from ?? 0;
  const narrationTo = layout.parts.length
    ? layout.parts[layout.parts.length - 1].from + layout.parts[layout.parts.length - 1].durationInFrames
    : 0;
  return (f) => {
    const fadeIn = ramp(f, 0, m.fadeInSec * fps, 0, 1);
    const fadeOut = ramp(f, p.endFrame - m.fadeOutSec * fps, p.endFrame, 1, 0);
    const level =
      f < narrationFrom ? ramp(f, narrationFrom - fps, narrationFrom, cards, under)
      : f < narrationTo ? ramp(f, narrationTo - fps, narrationTo, under, end)
      : end;
    return level * Math.min(fadeIn, fadeOut);
  };
}
