import "./index.css";
import { Composition } from "remotion";
import { FILMS } from "./film/registry";
import { compositionsOf } from "./film/Film";
import { Extras } from "./extras";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Every show with a shows/<slug>/film.json: its arcs, parts, film and card previews. */}
      {FILMS.flatMap((film) =>
        compositionsOf(film).map((c) => (
          <Composition
            key={c.id}
            id={c.id}
            component={c.component}
            calculateMetadata={c.calculateMetadata}
            durationInFrames={c.durationInFrames}
            fps={film.spec.fps}
            width={film.spec.width}
            height={film.spec.height}
          />
        )),
      )}
      <Extras />
    </>
  );
};
