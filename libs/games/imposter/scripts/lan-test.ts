// End-to-end test of the LAN game over real TCP sockets on this computer: npx nx test imposter
import * as net from 'node:net';
import { ClientSession, HostSession, probe, type NetApi } from '@gamehub/lan';
import { Engine, type Dealt } from '../src/lan/engine';
import { IMPOSTER_LAN, type Action, type View } from '../src/lan/protocol';

const api = net as unknown as NetApi;
const PORT = 47901;
const config = { ...IMPOSTER_LAN, port: PORT };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok: boolean, what: string) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) fails++;
};

const deal = (n: number): Dealt => ({
  word: { am: 'ማር', en: 'Honey' },
  category: '🍲 Food',
  hint: { am: 'ንብ', en: 'Bee', label: 'Your hint' },
  imposters: [1],
  speakOrder: Array.from({ length: n }, (_, i) => i),
});
let scoring = true;
const settings = () => ({ imposterCount: 1, hintMode: 'easy' as const, timerMinutes: 1, votingSeconds: 30, scoring });

(async () => {
  let hostView: View | null = null;
  const host = new HostSession<Action, View>(api, config, new Engine('H', 'Abel', deal, settings), 'Abel', (v) => (hostView = v));
  await host.start();
  const hv = () => hostView!;

  const info = await probe(api, '127.0.0.1', config);
  check(info?.name === 'Abel' && info.players === 1, 'discovery probe finds host');
  check((await probe(api, '127.0.0.1', { ...config, port: PORT + 1 }, 500)) === null, 'probe on empty port returns null');

  const views: Record<string, View> = {};
  const ends: Record<string, string> = {};
  const join = (id: string, name: string) => {
    const c = new ClientSession<Action, View>(api, config, '127.0.0.1', id, name, {
      onView: (v) => (views[id] = v),
      onStatus: () => {},
      onError: () => {},
      onEnd: (m) => (ends[id] = m),
    });
    c.connect();
    return c;
  };
  const a = join('A', 'Bete');
  const b = join('B', 'Chala');
  const c = join('C', 'Dawit');
  await wait(300);
  check(hv().players.length === 4, 'host sees 4 players');
  join('X', 'bete');
  await wait(500);
  check(!!ends.X?.includes('already'), 'duplicate name rejected');

  a.act({ t: 'start' });
  await wait(200);
  check(views.A.phase === 'lobby', 'non-host cannot start');
  check(host.act({ t: 'start' }) === null, 'host starts round');
  await wait(200);
  check(views.A.card?.role === 'imposter', 'player A is the imposter');
  check(views.B.card?.role === 'crew' && views.B.card.en === 'Honey', 'B gets the word');
  check(!JSON.stringify(views.A).includes('Honey'), "imposter's view never contains the word");

  for (const p of [a, b, c]) p.act({ t: 'seen' });
  host.act({ t: 'seen' });
  await wait(200);
  check(hv().phase === 'clues', 'everyone saw their card -> clues');

  (b as unknown as { conn: net.Socket }).conn.destroy();
  await wait(300);
  check(hv().players.find((p) => p.id === 'B')!.connected === false, 'host sees B drop');
  await wait(2500);
  check(hv().players.find((p) => p.id === 'B')!.connected === true, 'B reconnects by itself');
  join('L', 'Late');
  await wait(400);
  check(!!ends.L?.includes('middle of a round'), 'new player refused mid-round');

  host.act({ t: 'discuss' });
  await wait(150);
  check(views.C.phase === 'discuss' && views.C.timerMs! > 55_000, 'discussion timer reaches players');
  host.act({ t: 'startVote' });
  await wait(150);
  a.act({ t: 'vote', target: 'B' });
  b.act({ t: 'vote', target: 'A' });
  c.act({ t: 'vote', target: 'A' });
  host.act({ t: 'vote', target: 'A' });
  c.act({ t: 'vote', target: 'C' });
  await wait(200);
  check(hv().voted.length === 4, 'four votes counted, self-vote ignored');
  host.act({ t: 'reveal' });
  await wait(200);
  check(views.A.phase === 'guess' && views.A.guessing?.imposter === 'A', 'caught imposter gets a guess');
  check(!JSON.stringify(views.A).includes('Honey'), 'word still hidden from the imposter while guessing');
  check(!views.B.result, 'no result until the guess is judged');
  a.act({ t: 'judge', correct: true });
  b.act({ t: 'guess', text: 'Honey' });
  await wait(200);
  check(views.B.phase === 'guess', 'imposter cannot judge, others cannot guess for them');
  a.act({ t: 'guess', text: 'Sugar' });
  a.act({ t: 'guess', text: 'Honey' });
  await wait(200);
  check(views.B.guessing?.guess === 'Sugar' && views.B.phase === 'guess', 'only the first guess counts; a miss waits for a verdict');
  b.act({ t: 'judge', correct: false });
  await wait(200);
  const r = views.B.result!;
  check(r.caught && r.outcome === 'caught' && r.mostVoted[0] === 'A' && r.imposters[0] === 'A', 'imposter caught with 3 votes');
  check(r.points.A === 0 && r.points.B === 2 && r.points.H === 2 && r.points.C === 2, 'crew win +1, good vote +1');
  check(views.A.scores.B === 2 && views.A.scores.A === 0, 'scores reach every phone');

  // Round 2: caught again, but the imposter types the word and wins on the spot.
  host.act({ t: 'start' });
  await wait(200);
  for (const p of [a, b, c]) p.act({ t: 'seen' });
  host.act({ t: 'seen' });
  await wait(200);
  host.act({ t: 'startVote' });
  await wait(150);
  for (const p of [b, c]) p.act({ t: 'vote', target: 'A' });
  await wait(200);
  host.act({ t: 'reveal' });
  await wait(200);
  a.act({ t: 'guess', text: '  the honey! ' });
  await wait(200);
  const r2 = views.A.result!;
  check(r2?.outcome === 'guessed' && r2.points.A === 3, 'exact guess wins for the imposter (+2 +1 bonus)');
  check(hv().scores.A === 3 && hv().scores.B === 3, 'scores add up across rounds');
  host.act({ t: 'resetScores' });
  await wait(150);
  check(Object.keys(hv().scores).length === 0, 'host can reset the leaderboard');

  // Round 3 with points turned off: the round plays the same but nobody scores.
  scoring = false;
  host.act({ t: 'start' });
  await wait(200);
  for (const p of [a, b, c]) p.act({ t: 'seen' });
  host.act({ t: 'seen' });
  await wait(200);
  host.act({ t: 'startVote' });
  await wait(150);
  for (const p of [b, c]) p.act({ t: 'vote', target: 'A' });
  await wait(200);
  host.act({ t: 'reveal' });
  await wait(200);
  a.act({ t: 'guess', text: 'Honey' });
  await wait(200);
  check(views.B.result?.outcome === 'guessed' && Object.keys(views.B.result.points).length === 0, 'scoring off: no points awarded');
  check(Object.keys(hv().scores).length === 0 && views.B.settings.scoring === false, 'scoring off: leaderboard stays empty');

  host.act({ t: 'kick', id: 'C' });
  await wait(500);
  check(ends.C === 'The host removed you from the game.', 'removed player is told');
  a.leave();
  await wait(300);
  check(hv().players.length === 2, 'leaving between rounds frees the seat');
  host.stop();
  await wait(300);
  check(ends.B === 'The host ended the game.', 'ending the game notifies players');

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
