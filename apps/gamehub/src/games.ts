import type { GameMeta } from '@gamehub/core';
import { imposterMeta } from '@gamehub/imposter';
import { whoAmIMeta } from '@gamehub/who-am-i';

/**
 * Games listed in the hub, in display order.
 * Adding a game: create libs/games/<id>, add it to package.json, mount its screens under app/<id>/,
 * and add its meta here.
 */
export const GAMES: GameMeta[] = [imposterMeta, whoAmIMeta];
