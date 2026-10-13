'use strict';
// End-to-end-ish test of the real index.html in a simulated browser (jsdom).
// Run with: npm test   (needs `npm install` once for jsdom)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const INDEX = path.join(__dirname, '..', 'index.html');

async function load() {
  const dom = await JSDOM.fromFile(INDEX, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', resolve);
  });
  return dom;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (dom, sel) => dom.window.document.querySelector(sel);
const $$ = (dom, sel) => [...dom.window.document.querySelectorAll(sel)];
const isHidden = (dom, id) => $(dom, '#' + id).classList.contains('hidden');

test('starts on the start screen with only the play button', async () => {
  const dom = await load();
  assert.equal(isHidden(dom, 'start-screen'), false);
  assert.equal(isHidden(dom, 'game-screen'), true);
  assert.equal(isHidden(dom, 'win-screen'), true);
  dom.window.close();
});

test('play shows a picture and exactly four letter buttons', async () => {
  const dom = await load();
  $(dom, '#play-btn').click();
  assert.equal(isHidden(dom, 'game-screen'), false);
  assert.equal($$(dom, '.choice').length, 4);
  assert.ok($(dom, '#picture-emoji').textContent.length > 0);
  assert.match($(dom, '#picture').dataset.word, /^[a-z]+$/);
  dom.window.close();
});

test('choosing the right letter marks it correct, adds a star, locks the rest', async () => {
  const dom = await load();
  $(dom, '#play-btn').click();
  const letter = $(dom, '#picture').dataset.word[0].toUpperCase();
  const right = $$(dom, '.choice').find((b) => b.dataset.letter === letter);
  assert.ok(right, 'the correct letter must be one of the four buttons');
  right.click();
  assert.ok(right.classList.contains('correct'));
  assert.equal($(dom, '#stars').dataset.count, '1');
  assert.ok($$(dom, '.choice').every((b) => b.disabled));
  assert.ok($(dom, '#choices').classList.contains('solved'));
  assert.ok($$(dom, '.confetti-piece').length > 0, 'confetti appears');
  dom.window.close();
});

test('choosing a wrong letter wobbles, disables only that button, no star lost', async () => {
  const dom = await load();
  $(dom, '#play-btn').click();
  const letter = $(dom, '#picture').dataset.word[0].toUpperCase();
  const wrong = $$(dom, '.choice').find((b) => b.dataset.letter !== letter);
  wrong.click();
  assert.ok(wrong.classList.contains('wrong'));
  assert.equal(wrong.disabled, true);
  assert.equal($(dom, '#stars').dataset.count, '0');
  const stillOpen = $$(dom, '.choice').filter((b) => !b.disabled);
  assert.equal(stillOpen.length, 3, 'the other three can still be tapped');
  dom.window.close();
});

test('after a correct answer the game moves on to a new round by itself', async () => {
  const dom = await load();
  $(dom, '#play-btn').click();
  const firstWord = $(dom, '#picture').dataset.word;
  const letter = firstWord[0].toUpperCase();
  $$(dom, '.choice').find((b) => b.dataset.letter === letter).click();
  await sleep(2600);
  assert.notEqual($(dom, '#picture').dataset.word, firstWord);
  assert.equal($$(dom, '.choice').filter((b) => !b.disabled).length, 4);
  assert.equal($(dom, '#stars').dataset.count, '1', 'star is kept');
  dom.window.close();
});

test('mute button toggles state and aria attributes', async () => {
  const dom = await load();
  const mute = $(dom, '#mute-btn');
  assert.equal(mute.getAttribute('aria-pressed'), 'false');
  mute.click();
  assert.equal(mute.getAttribute('aria-pressed'), 'true');
  assert.equal(mute.getAttribute('aria-label'), 'Turn sound on');
  mute.click();
  assert.equal(mute.getAttribute('aria-pressed'), 'false');
  dom.window.close();
});

test('ten correct answers in a row show the win screen, play again restarts', async () => {
  const dom = await load();
  $(dom, '#play-btn').click();
  for (let i = 0; i < 10; i++) {
    const letter = $(dom, '#picture').dataset.word[0].toUpperCase();
    $$(dom, '.choice').find((b) => b.dataset.letter === letter).click();
    await sleep(2400);
  }
  assert.equal(isHidden(dom, 'win-screen'), false);
  $(dom, '#again-btn').click();
  assert.equal(isHidden(dom, 'game-screen'), false);
  assert.equal($(dom, '#stars').dataset.count, '0');
  dom.window.close();
});
