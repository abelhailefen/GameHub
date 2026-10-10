// End-to-end test of the Wi-Fi game over real TCP sockets on this computer: npx nx test who-am-i
import * as net from 'node:net';
import { ClientSession, HostSession, probe, type NetApi } from '@gamehub/lan';
import { Engine } from '../src/lan/engine';
import { WHO_AM_I_LAN, type Action, type View } from '../src/lan/protocol';
import type { Settings } from '../src/store';

const api = net as unknown as NetApi;
const PORT = 47911;
const config = { ...WHO_AM_I_LAN, port: PORT };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok: boolean, what: string) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) fails++;
};

let settings: Settings = { theme: 'animals', turnSeconds: 60, scoring: true };

(async () => {
  let hostView: View | null = null;
  const host = new HostSession<Action, View>(api, config, new Engine('H', 'Abel', () => settings), 'Abel', (v) => (hostView = v));
  await host.start();
  const hv = () => hostView!;

  const info = await probe(api, '127.0.0.1', config);
  check(info?.name === 'Abel' && info.players === 1 && info.phase === 'lobby', 'discovery probe finds host');

  const views: Record<string, View> = {};
  const errors: Record<string, string> = {};
  const ends: Record<string, string> = {};
  const join = (id: string, name: string) => {
    const c = new ClientSession<Action, View>(api, config, '127.0.0.1', id, name, {
      onView: (v) => (views[id] = v),
      onStatus: () => {},
      onError: (m) => (errors[id] = m),
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
  join('X', 'CHALA');
  await wait(500);
  check(!!ends.X?.includes('already'), 'duplicate name rejected');

  a.act({ t: 'start' });
  await wait(200);
  check(views.A.phase === 'lobby' && errors.A === 'Only the host can do that.', 'non-host cannot start');
  check(host.act({ t: 'start' }) === null, 'host starts round');
  await wait(200);
  check(views.A.phase === 'write' && views.A.theme === 'animals', 'everyone is writing, with the theme');
  const ids = ['H', 'A', 'B', 'C'];
  const writeFor = (id: string) => (id === 'H' ? hv() : views[id]).writeFor!;
  check(ids.every((id) => writeFor(id) && writeFor(id) !== id), 'everyone writes for someone else');
  check(new Set(ids.map(writeFor)).size === 4, 'every player gets exactly one word written for them');

  // Each word names who it's for, so the test can tell whose is whose.
  const wordOf = (id: string) => `Lion for ${id}`;
  // Remembered now: writeFor is only sent while writing.
  const writers = Object.fromEntries(ids.map((id) => [id, ids.find((w) => writeFor(w) === id)!]));
  const writerOf = (id: string) => writers[id];
  const clients: Record<string, ClientSession<Action, View>> = { A: a, B: b, C: c };
  const actAs = (id: string, action: Action) => (id === 'H' ? host.act(action) : clients[id].act(action));
  for (const id of ['A', 'B', 'C']) actAs(writerOf(id), { t: 'write', word: `  ${wordOf(id)} ` });
  await wait(200);
  check(hv().phase === 'write' && hv().written.length === 3, 'waits until every word is written');
  check(views[writerOf('A')].yourWord === wordOf('A'), 'writer sees the word they wrote, cleaned up');
  check(!JSON.stringify(views.A).includes(wordOf('A')), "a player's view never has their own word while writing");
  actAs(writerOf('H'), { t: 'write', word: wordOf('H') });
  await wait(200);
  check(hv().phase === 'play' && views.B.phase === 'play', 'last word written -> play');
  check(views.C.timerMs! > 55_000, 'turn timer reaches players');

  for (const id of ids) {
    const v = id === 'H' ? hv() : views[id];
    const others = ids.filter((o) => o !== id);
    if (v.words[id] !== undefined || JSON.stringify(v).includes(wordOf(id))) check(false, `${id} can see their own word`);
    if (!others.every((o) => v.words[o] === wordOf(o))) check(false, `${id} can't see someone else's word`);
  }
  check(true, "everyone sees every word but their own");

  const view = () => hv();
  const first = view().current!;
  const turn1 = view().turn;
  const watcher = ids.find((id) => id !== first)!;
  actAs(first, { t: 'gotIt', turn: turn1 });
  await wait(150);
  check(view().solved.length === 0, 'you cannot mark your own word as guessed');

  actAs(first, { t: 'guess', turn: turn1, text: 'Tiger' });
  await wait(150);
  check(view().guess === 'Tiger' && view().current === first, 'a wrong-looking guess waits for a verdict');
  actAs(first, { t: 'guess', turn: turn1, text: 'Zebra' });
  await wait(150);
  check(view().guess === 'Tiger', 'one guess at a time');
  actAs(watcher, { t: 'wrong', turn: turn1 });
  await wait(150);
  check(view().guess === undefined && view().current === first, 'wrong: guess cleared, turn goes on');

  actAs(watcher, { t: 'turnOver', turn: turn1 });
  actAs(ids.find((id) => id !== first && id !== watcher)!, { t: 'turnOver', turn: turn1 });
  await wait(200);
  const second = view().current!;
  check(second !== first && view().turns[first] === 1, 'turn over moves on once, even when two people tap it');

  // The second player types their word exactly: solved without anyone confirming.
  actAs(second, { t: 'guess', turn: view().turn, text: `the ${wordOf(second).toUpperCase()}!` });
  await wait(200);
  check(view().solved[0] === second && view().current !== second, 'exact typed guess solves it');
  check(views[second === 'H' ? 'A' : second]?.phase === 'play', 'round goes on');
  const sv = second === 'H' ? hv() : views[second];
  check(sv.words[second] === wordOf(second), 'once guessed, you can see your own word');

  // Two people tap "Got it!" at once: only the current player is placed.
  const third = view().current!;
  const turn3 = view().turn;
  const tappers = ids.filter((id) => id !== third);
  for (const t of tappers) actAs(t, { t: 'gotIt', turn: turn3 });
  await wait(200);
  check(view().solved.length === 2 && view().solved[1] === third, 'double "Got it!" only places one player');

  (b as unknown as { conn: net.Socket }).conn.destroy();
  await wait(300);
  check(hv().players.find((p) => p.id === 'B')!.connected === false, 'host sees B drop');
  await wait(2500);
  check(hv().players.find((p) => p.id === 'B')!.connected === true, 'B reconnects by itself, mid-round');
  join('L', 'Late');
  await wait(400);
  check(!!ends.L?.includes('middle of a round'), 'new player refused mid-round');

  const fourth = view().current!;
  actAs(ids.find((id) => id !== fourth)!, { t: 'gotIt', turn: view().turn });
  await wait(200);
  const r = views.A.result!;
  check(views.A.phase === 'result' && r.placings.length === 4, 'round ends when one player is left');
  check(r.placings.map((p) => p.place).join() === '1,2,3,', 'placings 1, 2, 3, then the one who missed');
  check(r.placings[0].id === second && r.points[second] === 3 && r.points[third] === 2 && r.points[fourth] === 1, '3 / 2 / 1 points');
  check(r.placings.every((p) => p.word === wordOf(p.id) && p.writer === writerOf(p.id)), 'result shows each word and who wrote it');
  check(views.C.scores[second] === 3, 'scores reach every phone');

  // Round 2: ended early by the host.
  host.act({ t: 'start' });
  await wait(200);
  for (const id of ids) actAs(id, { t: 'write', word: 'Gelada' });
  await wait(200);
  a.act({ t: 'end' });
  await wait(150);
  check(hv().phase === 'play', 'only the host can end the round');
  host.act({ t: 'end' });
  await wait(200);
  check(views.A.phase === 'result' && views.A.result!.placings.every((p) => p.place === null), 'ending early: nobody placed');
  check(hv().scores[second] === 3, 'no points for an unfinished round');

  // Round 3 with points off and no timer.
  settings = { theme: 'food', turnSeconds: 0, scoring: false };
  host.refresh();
  host.act({ t: 'start' });
  await wait(200);
  check(views.B.theme === 'food', 'new round uses the new theme');
  for (const id of ids) actAs(id, { t: 'write', word: 'Injera' });
  await wait(200);
  check(views.B.timerMs === undefined, 'no turn timer when it is off');
  for (let i = 0; i < 3; i++) {
    const cur = view().current!;
    actAs(ids.find((id) => id !== cur)!, { t: 'gotIt', turn: view().turn });
    await wait(150);
  }
  check(views.B.phase === 'result' && Object.keys(views.B.result!.points).length === 0, 'scoring off: no points awarded');
  check(hv().scores[second] === 3, 'scoring off: leaderboard unchanged');
  host.act({ t: 'resetScores' });
  await wait(150);
  check(Object.keys(hv().scores).length === 0, 'host can reset the leaderboard');

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
