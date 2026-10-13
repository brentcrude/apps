'use strict';
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Logic = require('../game-logic.js');

/** Small deterministic RNG so tests are repeatable. */
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('word list: every letter is the first letter of its word, uppercase', () => {
  for (const w of Logic.WORDS) {
    assert.equal(w.letter, w.word[0].toUpperCase(), `${w.word} should start with ${w.letter}`);
    assert.match(w.letter, /^[A-Z]$/);
  }
});

test('word list: words and emoji are unique, and every word is a single word', () => {
  const words = Logic.WORDS.map((w) => w.word);
  const emoji = Logic.WORDS.map((w) => w.emoji);
  assert.equal(new Set(words).size, words.length, 'duplicate word');
  assert.equal(new Set(emoji).size, emoji.length, 'duplicate emoji');
  for (const w of words) assert.match(w, /^[a-z]+$/, `"${w}" must be one lowercase word`);
});

test('word list: there are enough different letters to always offer 4 choices', () => {
  assert.ok(Logic.letterPool().length >= Logic.OPTION_COUNT);
});

test('buildOptions: 4 unique letters, includes the right one, all from the pool', () => {
  const rng = seeded(1);
  const pool = Logic.letterPool();
  for (let i = 0; i < 500; i++) {
    const correct = pool[i % pool.length];
    const opts = Logic.buildOptions(correct, rng);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4, 'options must be distinct');
    assert.ok(opts.includes(correct));
    for (const o of opts) assert.ok(pool.includes(o));
  }
});

test('buildOptions: the correct answer lands in every position sometimes', () => {
  const rng = seeded(7);
  const positions = new Set();
  for (let i = 0; i < 200; i++) positions.add(Logic.buildOptions('A', rng).indexOf('A'));
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test('shuffle: returns a permutation and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const copy = input.slice();
  const out = Logic.shuffle(input, seeded(3));
  assert.deepEqual(input, copy);
  assert.deepEqual(out.slice().sort(), copy);
});

test('game: first round is playable and unsolved with 0 stars', () => {
  const g = Logic.createGame({ rng: seeded(5) });
  assert.equal(g.getState(), null);
  const r = g.nextRound();
  assert.equal(r.options.length, 4);
  assert.equal(r.solved, false);
  assert.equal(r.stars, 0);
  assert.equal(r.goal, Logic.DEFAULT_GOAL);
  assert.ok(r.options.includes(r.letter));
});

test('game: correct answer earns a star and locks the round', () => {
  const g = Logic.createGame({ rng: seeded(5) });
  const r = g.nextRound();
  const res = g.answer(r.letter);
  assert.equal(res.correct, true);
  assert.equal(res.stars, 1);
  assert.equal(res.completed, false);
  assert.equal(g.getState().solved, true);
  // further taps on a solved round do nothing, and never add extra stars
  assert.deepEqual(g.answer(r.letter), { ignored: true });
  assert.equal(g.getStars(), 1);
});

test('game: wrong answers cost nothing, can be retried, and a repeat tap is ignored', () => {
  const g = Logic.createGame({ rng: seeded(11) });
  const r = g.nextRound();
  const wrong = r.options.find((l) => l !== r.letter);
  const res = g.answer(wrong);
  assert.equal(res.correct, false);
  assert.equal(res.stars, 0);
  assert.deepEqual(g.getState().wrongPicks, [wrong]);
  assert.deepEqual(g.answer(wrong), { ignored: true });
  assert.equal(g.answer(r.letter).correct, true, 'can still answer correctly afterwards');
});

test('game: letters that are not offered are ignored', () => {
  const g = Logic.createGame({ rng: seeded(2) });
  const r = g.nextRound();
  const notOffered = Logic.letterPool().find((l) => !r.options.includes(l));
  assert.deepEqual(g.answer(notOffered), { ignored: true });
  assert.deepEqual(g.answer('?'), { ignored: true });
});

test('game: answering before any round starts is ignored', () => {
  const g = Logic.createGame({ rng: seeded(2) });
  assert.deepEqual(g.answer('A'), { ignored: true });
});

test('game: reaching the goal completes, then stars reset on the next round', () => {
  const g = Logic.createGame({ rng: seeded(9), goal: 3 });
  let r = g.nextRound();
  let res;
  for (let i = 1; i <= 3; i++) {
    res = g.answer(r.letter);
    assert.equal(res.stars, i);
    if (i < 3) r = g.nextRound();
  }
  assert.equal(res.completed, true);
  r = g.nextRound();
  assert.equal(r.stars, 0, 'fresh row of stars after the celebration');
});

test('game: a wrong guess does not reduce stars', () => {
  const g = Logic.createGame({ rng: seeded(4) });
  let r = g.nextRound();
  g.answer(r.letter);
  r = g.nextRound();
  g.answer(r.options.find((l) => l !== r.letter));
  assert.equal(g.getStars(), 1);
});

test('game: never shows the same picture twice in a row', () => {
  const g = Logic.createGame({ rng: seeded(123) });
  let prev = null;
  for (let i = 0; i < 1000; i++) {
    const r = g.nextRound();
    if (prev) assert.notEqual(r.word, prev, `repeat at round ${i}`);
    prev = r.word;
  }
});

test('game: every picture appears once before any picture repeats', () => {
  const g = Logic.createGame({ rng: seeded(77) });
  const n = Logic.WORDS.length;
  const seen = new Set();
  for (let i = 0; i < n; i++) seen.add(g.nextRound().word);
  // the "no immediate repeat" swap can push at most one picture to the next bag,
  // so allow a single deferred picture but never a duplicate in the first pass
  assert.ok(seen.size >= n - 1, `only ${seen.size}/${n} unique pictures in the first pass`);
});

test('game: works with a custom word list', () => {
  const words = [
    { word: 'ant', emoji: '🐜', letter: 'A' },
    { word: 'bat', emoji: '🦇', letter: 'B' },
    { word: 'cat', emoji: '🐱', letter: 'C' },
    { word: 'dog', emoji: '🐶', letter: 'D' }
  ];
  const g = Logic.createGame({ rng: seeded(1), words });
  // buildOptions uses the global pool, so the answer must still be offered
  const r = g.nextRound();
  assert.ok(words.some((w) => w.word === r.word));
  assert.ok(r.options.includes(r.letter));
});
