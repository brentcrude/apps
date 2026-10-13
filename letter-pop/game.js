/*
 * Letter Pop - browser UI: rendering, sound, speech, confetti.
 * All game rules live in game-logic.js.
 */
(function () {
  'use strict';

  var Logic = window.LetterPopLogic;
  var NEXT_ROUND_DELAY_MS = 2300;
  var MUTE_KEY = 'letterpop.muted';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    start: $('start-screen'),
    game: $('game-screen'),
    win: $('win-screen'),
    play: $('play-btn'),
    again: $('again-btn'),
    stars: $('stars'),
    mute: $('mute-btn'),
    picture: $('picture'),
    pictureEmoji: $('picture-emoji'),
    choices: $('choices'),
    confetti: $('confetti')
  };

  var game = Logic.createGame({ goal: Logic.DEFAULT_GOAL });
  var current = null;
  var advanceTimer = null;
  var muted = readMuted();

  /* ------------------------------------------------------------------ *
   * Sound: spoken words (Web Speech API) + tiny synthesized chimes.
   * Everything degrades silently if the browser lacks either feature.
   * ------------------------------------------------------------------ */

  var audioCtx = null;

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { audioCtx = new Ctor(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  function tone(freq, start, duration, type, gain) {
    var ctx = getAudioCtx();
    if (!ctx || muted) return;
    try {
      var osc = ctx.createOscillator();
      var amp = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var t0 = ctx.currentTime + start;
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch (e) { /* audio is a nice-to-have */ }
  }

  function playCorrect() {
    // C major arpeggio: happy "ta-da"
    tone(523.25, 0, 0.18, 'triangle');
    tone(659.25, 0.12, 0.18, 'triangle');
    tone(783.99, 0.24, 0.35, 'triangle');
  }

  function playWrong() {
    // soft, low, gentle "boop" (not a harsh buzzer)
    tone(220, 0, 0.25, 'sine', 0.15);
  }

  function playWin() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach(function (f, i) {
      tone(f, i * 0.14, 0.25, 'triangle');
    });
  }

  function speak(text) {
    if (muted || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85;
      u.pitch = 1.25;
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  function readMuted() {
    try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  function writeMuted(value) {
    try { window.localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch (e) { /* private mode etc. */ }
  }

  function renderMute() {
    els.mute.textContent = muted ? '🔇' : '🔊';
    els.mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    els.mute.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function show(screen) {
    [els.start, els.game, els.win].forEach(function (s) {
      s.classList.toggle('hidden', s !== screen);
    });
  }

  function renderStars(count, goal) {
    els.stars.textContent = '';
    for (var i = 0; i < goal; i++) {
      var s = document.createElement('span');
      s.className = 'star' + (i < count ? ' on' : '');
      s.textContent = '⭐';
      els.stars.appendChild(s);
    }
    els.stars.setAttribute('aria-label', count + ' of ' + goal + ' stars');
    els.stars.dataset.count = String(count);
  }

  function renderRound(state) {
    current = state;
    renderStars(state.stars, state.goal);

    els.picture.setAttribute('aria-label', state.word + '. Tap to hear it again.');
    els.picture.dataset.word = state.word;
    els.pictureEmoji.textContent = state.emoji;
    els.picture.classList.remove('cheer', 'pop-in');
    void els.picture.offsetWidth; // restart the CSS animation
    els.picture.classList.add('pop-in');

    els.choices.classList.remove('solved');
    els.choices.textContent = '';
    state.options.forEach(function (letter) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.textContent = letter;
      b.dataset.letter = letter;
      b.setAttribute('aria-label', 'Letter ' + letter);
      b.addEventListener('click', function () { onChoice(letter, b); });
      els.choices.appendChild(b);
    });
  }

  function startRound() {
    clearTimeout(advanceTimer);
    renderRound(game.nextRound());
    show(els.game);
    speak(current.word + '! What letter does ' + current.word + ' start with?');
  }

  /* ------------------------------------------------------------------ *
   * Interaction
   * ------------------------------------------------------------------ */

  function onChoice(letter, button) {
    var result = game.answer(letter);
    if (result.ignored) return;

    if (result.correct) {
      button.classList.add('correct');
      els.choices.classList.add('solved');
      Array.prototype.forEach.call(els.choices.children, function (c) { c.disabled = true; });
      els.picture.classList.remove('pop-in');
      void els.picture.offsetWidth;
      els.picture.classList.add('cheer');
      renderStars(result.stars, result.goal);
      confetti(result.completed ? 120 : 45);
      playCorrect();
      speak('Yes! ' + result.letter + ' is for ' + result.word + '!');
      advanceTimer = setTimeout(function () {
        if (result.completed) {
          celebrate();
        } else {
          startRound();
        }
      }, NEXT_ROUND_DELAY_MS);
    } else {
      button.classList.add('wrong');
      button.disabled = true;
      playWrong();
      speak('Try again!');
    }
  }

  function celebrate() {
    show(els.win);
    confetti(150);
    playWin();
    speak('Great job! You got ' + Logic.DEFAULT_GOAL + ' stars!');
  }

  function confetti(count) {
    var colors = ['#ff6b6b', '#4dabf7', '#51cf66', '#b197fc', '#ffd43b', '#ff922b'];
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      p.style.animationDelay = Math.random() * 0.4 + 's';
      els.confetti.appendChild(p);
      (function (piece) {
        setTimeout(function () { if (piece.parentNode) piece.parentNode.removeChild(piece); }, 4000);
      })(p);
    }
  }

  els.play.addEventListener('click', function () {
    getAudioCtx(); // must be created/resumed from a user gesture
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startRound();
  });

  els.again.addEventListener('click', startRound);

  els.picture.addEventListener('click', function () {
    if (current) speak(current.word + '!');
  });

  els.mute.addEventListener('click', function () {
    muted = !muted;
    writeMuted(muted);
    renderMute();
    if (muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  renderMute();
})();
