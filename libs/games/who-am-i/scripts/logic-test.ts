// Tests the Who Am I? round logic: npx nx test who-am-i
import {
  allWritten,
  currentPlayer,
  dealWords,
  derangement,
  endRound,
  guessed,
  newRound,
  passTurn,
  placings,
  roundPoints,
  stillGuessing,
  wordFor,
  writeWord,
  type Round,
} from '../src/logic';

let fails = 0;
const check = (ok: boolean, what: string) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) fails++;
};

// Derangements: nobody ever gets their own word, for any size, over many shuffles.
let allGood = true;
for (let n = 2; n <= 12; n++) {
  for (let i = 0; i < 2000; i++) {
    const p = derangement(n);
    if (p.some((v, j) => v === j) || new Set(p).size !== n) allGood = false;
  }
}
check(allGood, 'derangement never maps anyone to themselves and is a permutation (n = 2..12)');

// Every valid assignment shows up for n = 3 (there are exactly 2), so it isn't stuck on one cycle.
const seen = new Set<string>();
for (let i = 0; i < 500; i++) seen.add(derangement(3).join(','));
check(seen.size === 2, 'both derangements of 3 players occur');

let threw = false;
try {
  derangement(1);
} catch {
  threw = true;
}
check(threw, 'one player cannot be dealt a word');

// A full round with 4 players.
const names = ['Abel', 'Bete', 'Chala', 'Dawit'];
let r: Round = newRound(names, 'anything');
check(r.writeOrder.length === 4 && new Set(r.writeOrder).size === 4, 'everyone is in the writing order once');
check(!allWritten(r), 'no words yet');
for (const p of r.writeOrder) r = writeWord(r, p, `  word   of ${names[p]}  `);
check(allWritten(r) && r.words[0] === 'word of Abel', 'words are trimmed and spaces collapsed');

r = dealWords(r);
check(names.every((_, p) => wordFor(r, p) !== `word of ${names[p]}`), 'nobody is dealt their own word');
check(new Set(r.target).size === 4, 'every word is dealt exactly once');

const first = currentPlayer(r);
r = passTurn(r);
check(currentPlayer(r) !== first && r.turns[first] === 1, 'turn over: next player, turn counted');

// Go round until the first player is back, then they guess it.
while (currentPlayer(r) !== first) r = passTurn(r);
r = guessed(r);
check(r.solved[0] === first && !r.over, 'first guess places the player, round goes on');
check(currentPlayer(r) !== first, 'a solved player is skipped');

let loops = 0;
while (!r.over && loops++ < 50) {
  check(!r.solved.includes(currentPlayer(r)), `turn ${loops}: only unsolved players get turns`);
  r = r.turns[currentPlayer(r)] % 2 === 0 ? passTurn(r) : guessed(r);
}
check(r.over && r.solved.length === 3 && stillGuessing(r).length === 1, 'round ends when one player is left guessing');
check(guessed(r) === r && passTurn(r) === r, 'nothing changes after the round is over');

const rows = placings(r);
check(rows.map((x) => x.place).join() === '1,2,3,', 'placings: three placed, then the one who missed');
check(rows[0].name === names[first] && rows[0].points === 3 && rows[1].points === 2 && rows[2].points === 1 && rows[3].points === 0, '3 / 2 / 1 / 0 points');
check(rows.every((x) => x.writer !== x.name), 'nobody wrote their own word');
const pts = roundPoints(r);
check(Object.values(pts).reduce((a, b) => a + b, 0) === 6 && pts[names[first]] === 3, 'round points keyed by name');

// Two players: the first correct guess ends it.
let two = dealWords(writeWord(writeWord(newRound(['A', 'B'], 'people'), 0, 'Lion'), 1, 'Paris'));
check(wordFor(two, 0) === 'Paris' && wordFor(two, 1) === 'Lion', 'two players swap words');
two = guessed(two);
check(two.over && placings(two)[0].place === 1 && placings(two)[1].place === null, 'two players: first guess wins the round');

// Ending early: nobody placed, nobody scores.
const early = endRound(dealWords(writeWord(writeWord(writeWord(newRound(['A', 'B', 'C'], 'food'), 0, 'x'), 1, 'y'), 2, 'z')));
check(early.over && placings(early).every((x) => x.place === null && x.points === 0), 'ending early gives no points');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
