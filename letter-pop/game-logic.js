/*
 * Letter Pop - game logic (no DOM, no audio, fully testable in Node).
 *
 * Works both in the browser (exposes window.LetterPopLogic) and in Node
 * (module.exports), so the same file is used by the game and by the tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LetterPopLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Every picture in the game. Rules for adding more:
   *  - one clear, single-word picture that a toddler recognises instantly
   *  - `letter` must be the first letter of `word` (uppercase) - the tests check this
   *  - avoid look-alike or ambiguous emoji (e.g. "ice cream" is two words, skip it)
   */
  var WORDS = [
    { word: 'apple', emoji: '🍎', letter: 'A' },
    { word: 'ball', emoji: '⚽', letter: 'B' },
    { word: 'banana', emoji: '🍌', letter: 'B' },
    { word: 'bee', emoji: '🐝', letter: 'B' },
    { word: 'bus', emoji: '🚌', letter: 'B' },
    { word: 'cat', emoji: '🐱', letter: 'C' },
    { word: 'car', emoji: '🚗', letter: 'C' },
    { word: 'cow', emoji: '🐮', letter: 'C' },
    { word: 'cake', emoji: '🎂', letter: 'C' },
    { word: 'dog', emoji: '🐶', letter: 'D' },
    { word: 'duck', emoji: '🦆', letter: 'D' },
    { word: 'elephant', emoji: '🐘', letter: 'E' },
    { word: 'egg', emoji: '🥚', letter: 'E' },
    { word: 'fish', emoji: '🐟', letter: 'F' },
    { word: 'frog', emoji: '🐸', letter: 'F' },
    { word: 'grapes', emoji: '🍇', letter: 'G' },
    { word: 'goat', emoji: '🐐', letter: 'G' },
    { word: 'hat', emoji: '🎩', letter: 'H' },
    { word: 'horse', emoji: '🐴', letter: 'H' },
    { word: 'key', emoji: '🔑', letter: 'K' },
    { word: 'lion', emoji: '🦁', letter: 'L' },
    { word: 'moon', emoji: '🌙', letter: 'M' },
    { word: 'mouse', emoji: '🐭', letter: 'M' },
    { word: 'nose', emoji: '👃', letter: 'N' },
    { word: 'owl', emoji: '🦉', letter: 'O' },
    { word: 'pig', emoji: '🐷', letter: 'P' },
    { word: 'pizza', emoji: '🍕', letter: 'P' },
    { word: 'rainbow', emoji: '🌈', letter: 'R' },
    { word: 'sun', emoji: '☀️', letter: 'S' },
    { word: 'star', emoji: '⭐', letter: 'S' },
    { word: 'tree', emoji: '🌳', letter: 'T' },
    { word: 'train', emoji: '🚂', letter: 'T' },
    { word: 'umbrella', emoji: '☂️', letter: 'U' },
    { word: 'violin', emoji: '🎻', letter: 'V' },
    { word: 'watermelon', emoji: '🍉', letter: 'W' },
    { word: 'zebra', emoji: '🦓', letter: 'Z' }
  ];

  var OPTION_COUNT = 4;
  var DEFAULT_GOAL = 10;

  /** Fisher-Yates shuffle (returns a new array). `rng` returns a float in [0, 1). */
  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /** All distinct letters that appear in WORDS, sorted A-Z. */
  function letterPool(words) {
    var seen = {};
    (words || WORDS).forEach(function (w) {
      seen[w.letter] = true;
    });
    return Object.keys(seen).sort();
  }

  /**
   * Build the 4 letter choices for a word: the right letter plus 3 different
   * wrong letters, in random order.
   */
  function buildOptions(correctLetter, rng, count) {
    count = count || OPTION_COUNT;
    var wrong = shuffle(
      letterPool().filter(function (l) {
        return l !== correctLetter;
      }),
      rng
    ).slice(0, count - 1);
    return shuffle([correctLetter].concat(wrong), rng);
  }

  /**
   * Create a game session.
   *
   * Pictures are dealt from a shuffled "bag" so nothing repeats until every
   * picture has been seen, and the same picture is never shown twice in a row.
   *
   * There is no way to lose: a wrong answer just greys that letter out and the
   * child can try again. Getting it right earns a star; `goal` stars triggers a
   * celebration and a fresh set of stars.
   */
  function createGame(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var goal = opts.goal || DEFAULT_GOAL;
    var words = opts.words || WORDS;

    var bag = [];
    var last = null;
    var stars = 0;
    var round = null;

    function draw() {
      if (bag.length === 0) bag = shuffle(words, rng);
      var pick = bag.pop();
      if (last && pick.word === last.word && bag.length > 0) {
        var alt = bag.pop();
        bag.unshift(pick); // put the repeat at the bottom of the bag
        pick = alt;
      }
      return pick;
    }

    function nextRound() {
      if (stars >= goal) stars = 0; // celebration finished, start a fresh row of stars
      var pick = draw();
      last = pick;
      round = {
        word: pick.word,
        emoji: pick.emoji,
        letter: pick.letter,
        options: buildOptions(pick.letter, rng),
        wrongPicks: [],
        solved: false
      };
      return snapshot();
    }

    function snapshot() {
      return {
        word: round.word,
        emoji: round.emoji,
        letter: round.letter,
        options: round.options.slice(),
        wrongPicks: round.wrongPicks.slice(),
        solved: round.solved,
        stars: stars,
        goal: goal
      };
    }

    /**
     * Answer the current round.
     * Returns { ignored } for taps that do nothing (already solved / already
     * tried that wrong letter), otherwise { correct, stars, goal, completed }.
     */
    function answer(letter) {
      if (!round || round.solved) return { ignored: true };
      if (round.options.indexOf(letter) === -1) return { ignored: true };
      if (round.wrongPicks.indexOf(letter) !== -1) return { ignored: true };

      if (letter === round.letter) {
        round.solved = true;
        stars += 1;
        return {
          correct: true,
          word: round.word,
          letter: round.letter,
          stars: stars,
          goal: goal,
          completed: stars >= goal
        };
      }
      round.wrongPicks.push(letter);
      return { correct: false, letter: letter, stars: stars, goal: goal, completed: false };
    }

    return {
      nextRound: nextRound,
      answer: answer,
      getState: function () {
        return round ? snapshot() : null;
      },
      getStars: function () {
        return stars;
      },
      getGoal: function () {
        return goal;
      }
    };
  }

  return {
    WORDS: WORDS,
    OPTION_COUNT: OPTION_COUNT,
    DEFAULT_GOAL: DEFAULT_GOAL,
    shuffle: shuffle,
    letterPool: letterPool,
    buildOptions: buildOptions,
    createGame: createGame
  };
});
