/**
 * Loads a show's film from disk for the scripts — the same `buildFilm` the engine uses, fed
 * from the same files, so a number printed by a script is the number the render used.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  FilmSchema,
  MusicMetaSchema,
  SentenceSchema,
  WordSchema,
  type Sentence,
  type Word,
} from "../../schemas/film.js";
import {
  buildFilm,
  findComp,
  type Comp,
  type Film,
} from "../../engine/src/film/timeline.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const readJson = (p: string) => {
  if (!existsSync(p)) throw new Error(`missing ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
};

export function loadFilm(show: string): Film {
  const dir = join(ROOT, "shows", show);
  const spec = FilmSchema.parse(readJson(join(dir, "film.json")));
  const lines: Record<string, Sentence[]> = {};
  const total: Record<string, number> = {};
  const words: Record<string, Word[]> = {};
  for (const p of spec.parts) {
    lines[p.id] = z
      .array(SentenceSchema)
      .parse(readJson(join(dir, "audio", `${p.id}.sentences.json`)));
    total[p.id] = z
      .object({ totalSec: z.number() })
      .parse(readJson(join(dir, "audio", `${p.id}.timings.json`))).totalSec;
    const wf = join(dir, "audio", `${p.id}.words.json`);
    if (existsSync(wf)) words[p.id] = z.array(WordSchema).parse(readJson(wf));
  }
  const music = spec.music
    ? MusicMetaSchema.parse(
        readJson(join(dir, "audio", `music-${spec.music.cue}.json`)),
      )
    : undefined;
  return buildFilm(spec, lines, total, music, words);
}

/** Every show that has a film.json. */
export const showsWithFilms = (): string[] =>
  readdirSync(join(ROOT, "shows"), { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(join(ROOT, "shows", d.name, "film.json")),
    )
    .map((d) => d.name);

/** Resolve a composition id (`AliceArcB`) to its show and comp, whichever show owns it. */
export function findComposition(
  id: string,
): { show: string; film: Film; comp: Comp } | undefined {
  for (const show of showsWithFilms()) {
    const film = loadFilm(show);
    const comp = findComp(film, id);
    if (comp) return { show, film, comp };
  }
  return undefined;
}

/** Resolve a whole-film composition id (`AliceFilm`) to its show and film. */
export function findFilmComposition(
  id: string,
): { show: string; film: Film } | undefined {
  for (const show of showsWithFilms()) {
    const film = loadFilm(show);
    if (`${film.spec.id}Film` === id) return { show, film };
  }
  return undefined;
}
