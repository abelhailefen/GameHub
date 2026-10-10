import type { GameMeta } from '@gamehub/core';
import { colors } from '@gamehub/ui';
import { routes } from './routes';

export const imposterMeta: GameMeta = {
  id: 'imposter',
  title: 'Imposter',
  titleAm: 'አስመሳዩ ማነው?',
  emoji: '🕵️',
  tagline: 'Everyone knows the secret word except the imposter. Find them before they blend in.',
  players: '3–16 players · one phone or Wi-Fi',
  accent: colors.red,
  route: routes.home,
};
