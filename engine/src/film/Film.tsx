import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Shot, GROUND } from "./Shot";
import { CreditsRoll, FinCard, TitleCard } from "./Cards";
import {
  compFrames, compositions, filmLayout, musicPlacement, musicVolume, shotWindows,
  type Comp, type Film,
} from "./timeline";
import { PACKS } from "../packs";

/** A show's media, as the engine serves it: `engine/public/shows/<slug>/{art,cache}`. */
export const asset = (film: Film, rel: string) => staticFile(`shows/${film.spec.show}/${rel}`);

const audioOf = (film: Film, part: string) => asset(film, `cache/audio/${part}.mp3`);

/** An arc or a whole part: the recording, and every shot cut to its sentences. Standalone
 *  (not inside the whole film) it also carries the underscore at its narration level, so a
 *  slice reviews the way the film will sound. */
export function makePart(film: Film, c: Comp, opts: { music: boolean } = { music: true }): React.FC {
  const { fps, defaultFade } = film.spec;
  const pack = PACKS[film.spec.show];
  const frames = compFrames(film, c);
  const m = film.spec.music;
  const cue = opts.music && m?.underArcs && film.music ? film.music : undefined;
  const musicVol = cue && m
    ? (f: number) => m.levels.under
      * interpolate(f, [0, m.fadeInSec * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      * interpolate(f, [frames - m.fadeOutSec * fps, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : undefined;
  return () => {
    const offset = Math.round(c.from * fps);
    const windows = shotWindows(film, c);
    return (
      <AbsoluteFill style={{ backgroundColor: GROUND }}>
        <Audio src={audioOf(film, c.part)} trimBefore={offset} trimAfter={Math.round(c.audioEnd * fps)} />
        {cue && musicVol && m ? (
          <Audio src={asset(film, `cache/music/${m.cue}.mp3`)} volume={musicVol} trimBefore={Math.round(cue.soundStartSec * fps)} />
        ) : null}
        {windows.map(({ shot, from, durationInFrames }, i) => {
          const isLast = i === windows.length - 1;
          // Only overlap into the next shot when that shot actually fades in. A chained
          // join (fadeIn 0) must be a clean butt-cut or the matched frames smear.
          const nextFade = isLast ? 0 : windows[i + 1].shot.fadeIn ?? defaultFade;
          const dur = durationInFrames + nextFade;
          let content: React.ReactNode = null;
          if (shot.component) {
            const Comp = pack?.[shot.component];
            if (!Comp) throw new Error(`${film.spec.show}: shot ${shot.id} names unknown component ${shot.component}`);
            const words = (film.words?.[c.part] ?? []).filter((w) => w.sentence >= shot.sentence[0] && w.sentence <= shot.sentence[1]);
            content = <Comp ctx={{ fps, durationInFrames: dur, startSec: from / fps, words }} props={shot.props ?? {}} />;
          }
          return (
            <Sequence key={shot.id} from={from - offset} durationInFrames={dur} name={shot.id}>
              <Shot
                image={shot.image ? asset(film, shot.image) : undefined}
                video={shot.video ? asset(film, shot.video) : undefined}
                hold={shot.hold ? asset(film, shot.hold) : undefined}
                clipSeconds={shot.clipSeconds}
                trim={shot.trim}
                fps={fps}
                move={shot.move}
                durationInFrames={dur}
                fadeInFrames={shot.fadeIn ?? defaultFade}
                // The closing shot does not fade out. The film holds on its last frame
                // through the silent tail, which is what an ending looks like.
                fadeOutFrames={isLast ? 0 : nextFade}
                motes={shot.motes}
              >
                {content}
              </Shot>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
  };
}

/** The whole film: title card, each recording with its held tail, end card, credits — and
 *  one instrumental cue underneath, out of the narration's way, lifting under the cards. */
export function makeFilm(film: Film): React.FC {
  const layout = filmLayout(film);
  const placement = musicPlacement(film, layout);
  const volume = placement ? musicVolume(film, layout, placement) : undefined;
  const { cards } = film.spec;
  const parts = layout.parts.map((p) => ({ ...p, Comp: makePart(film, p.comp, { music: false }) }));
  return () => (
    <AbsoluteFill style={{ backgroundColor: GROUND }}>
      {placement && volume && film.spec.music ? (
        <Audio src={asset(film, `cache/music/${film.spec.music.cue}.mp3`)} volume={volume} trimBefore={placement.trimFrames} />
      ) : null}
      {layout.title && cards.title ? (
        <Sequence from={layout.title.from} durationInFrames={layout.title.durationInFrames} name="Title">
          <TitleCard
            title={film.spec.title} byline={film.spec.byline} face={cards.title.face}
            backdrop={cards.title.backdrop ? asset(film, cards.title.backdrop) : undefined}
          />
        </Sequence>
      ) : null}
      {parts.map((p) => (
        <Sequence key={p.comp.id} from={p.from} durationInFrames={p.durationInFrames} name={p.comp.part}>
          <p.Comp />
        </Sequence>
      ))}
      {layout.fin && cards.fin ? (
        <Sequence from={layout.fin.from} durationInFrames={layout.fin.durationInFrames} name="Fin">
          <FinCard text={cards.fin.text} />
        </Sequence>
      ) : null}
      {layout.credits && cards.credits ? (
        <Sequence from={layout.credits.from} durationInFrames={layout.credits.durationInFrames} name="Credits">
          <CreditsRoll lines={cards.credits.lines} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

type Meta = CalculateMetadataFunction<Record<string, unknown>>;
const meta = (film: Film, frames: number): Meta => () => ({
  // Audio is the timeline.
  durationInFrames: frames,
  fps: film.spec.fps,
  width: film.spec.width,
  height: film.spec.height,
});

export type Registered = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  calculateMetadata: Meta;
};

/** Every composition a film contributes: its arcs, its parts, the film, and previews of the
 *  cards so they can be reviewed without rendering four minutes. */
export function compositionsOf(film: Film): Registered[] {
  const out: Registered[] = [];
  for (const c of compositions(film)) {
    const frames = compFrames(film, c);
    out.push({ id: c.id, component: makePart(film, c), durationInFrames: frames, calculateMetadata: meta(film, frames) });
  }
  const layout = filmLayout(film);
  out.push({ id: `${film.spec.id}Film`, component: makeFilm(film), durationInFrames: layout.totalFrames, calculateMetadata: meta(film, layout.totalFrames) });
  const { cards } = film.spec;
  if (layout.title && cards.title) {
    const t = cards.title;
    const Title: React.FC = () => (
      <TitleCard title={film.spec.title} byline={film.spec.byline} face={t.face} backdrop={t.backdrop ? asset(film, t.backdrop) : undefined} />
    );
    out.push({ id: `${film.spec.id}Title`, component: Title, durationInFrames: layout.title.durationInFrames, calculateMetadata: meta(film, layout.title.durationInFrames) });
  }
  if (layout.credits && cards.credits) {
    const lines = cards.credits.lines;
    const Credits: React.FC = () => <CreditsRoll lines={lines} />;
    out.push({ id: `${film.spec.id}Credits`, component: Credits, durationInFrames: layout.credits.durationInFrames, calculateMetadata: meta(film, layout.credits.durationInFrames) });
  }
  return out;
}
