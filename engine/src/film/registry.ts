/**
 * Every show with a `film.json` becomes a set of compositions. Nothing is registered by
 * hand: the bundler picks up every `film.json` under `shows/` and the measured audio files beside it.
 * A show that fails validation fails here, at load, with the schema's message.
 */
import { z } from "zod";
import { FilmSchema, MusicMetaSchema, SentenceSchema, WordSchema, type Sentence, type Word } from "../../../schemas/film";
import { buildFilm, type Film } from "./timeline";

const ctx = require.context(
  "../../../shows", true,
  /\/(film|audio\/[^/]+\.(sentences|timings|words)|audio\/music-[^/]+)\.json$/,
);
const read = (key: string): unknown => {
  try { return ctx(key); } catch { throw new Error(`film registry: missing shows/${key.slice(2)}`); }
};
const keys = new Set(ctx.keys());

export const FILMS: Film[] = ctx.keys().filter((k) => /^\.\/[^/]+\/film\.json$/.test(k)).map((key) => {
  const slug = key.split("/")[1];
  const spec = FilmSchema.parse(read(key));
  const lines: Record<string, Sentence[]> = {};
  const total: Record<string, number> = {};
  const words: Record<string, Word[]> = {};
  for (const p of spec.parts) {
    lines[p.id] = z.array(SentenceSchema).parse(read(`./${slug}/audio/${p.id}.sentences.json`));
    total[p.id] = z.object({ totalSec: z.number() }).parse(read(`./${slug}/audio/${p.id}.timings.json`)).totalSec;
    // Optional: only shows with component shots need word anchors.
    const wk = `./${slug}/audio/${p.id}.words.json`;
    if (keys.has(wk)) words[p.id] = z.array(WordSchema).parse(read(wk));
  }
  const music = spec.music
    ? MusicMetaSchema.parse(read(`./${slug}/audio/music-${spec.music.cue}.json`))
    : undefined;
  return buildFilm(spec, lines, total, music, words);
});
