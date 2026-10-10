import type { GameMeta } from '@gamehub/core';
import { colors } from '@gamehub/ui';
import { routes } from './routes';

export const whoAmIMeta: GameMeta = {
  id: 'who-am-i',
  title: 'Who Am I?',
  titleAm: 'እኔ ማን ነኝ?',
  emoji: '🤔',
  tagline: 'Everyone writes a word for someone else. Hold the phone to your forehead and ask questions until you guess yours.',
  players: '2–16 players · one phone or Wi-Fi',
  accent: colors.yellow,
  route: routes.home,
};
