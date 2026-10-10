// Where this game's screens are mounted in the app (apps/gamehub/app/imposter). Keep in sync with meta.route.
const base = '/imposter';

export const routes = {
  home: base,
  setup: `${base}/setup`,
  reveal: `${base}/reveal`,
  discuss: `${base}/discuss`,
  result: `${base}/result`,
  words: `${base}/words`,
  howToPlay: `${base}/how-to-play`,
  lan: `${base}/lan`,
  lanGame: `${base}/lan/game`,
} as const;
