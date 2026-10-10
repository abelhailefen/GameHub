// Where this game's screens are mounted in the app (apps/gamehub/app/who-am-i). Keep in sync with meta.route.
const base = '/who-am-i';

export const routes = {
  home: base,
  setup: `${base}/setup`,
  write: `${base}/write`,
  play: `${base}/play`,
  result: `${base}/result`,
  howToPlay: `${base}/how-to-play`,
  lan: `${base}/lan`,
  lanGame: `${base}/lan/game`,
} as const;
