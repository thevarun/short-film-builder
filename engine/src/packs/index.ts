/**
 * Show packs: data-driven components a show's `film.json` can name in a component shot,
 * keyed by show slug. Add `./<slug>/index.ts` exporting `pack` and register it here.
 */
import type { ShotCtx } from "../film/words";

export type PackComponent = React.FC<{ ctx: ShotCtx; props: Record<string, unknown> }>;
export type Pack = Record<string, PackComponent>;

export const PACKS: Record<string, Pack> = {};
