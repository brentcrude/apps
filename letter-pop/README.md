# Letter Pop 🍎🐶🐱

A tiny first-letter game for toddlers. The child sees one big, clear picture
and taps the letter it starts with, out of four choices. Hear the word, pop
some confetti, collect ten stars, win a trophy.

No accounts, no ads, no tracking, no build step, no dependencies to play.
Open `index.html` and go.

---

## Play it

**Locally (simplest):** double-click `index.html`.

**With a local server** (recommended on tablets/phones on your Wi-Fi):

```bash
npx serve .
# then open the printed address, e.g. http://localhost:3000
```

**On GitHub Pages:** push to GitHub, then *Settings → Pages → Deploy from a
branch → `main` / root*. The game will be live at
`https://<your-username>.github.io/<repo-name>/`.

> Tip for phones/tablets: use *Add to Home Screen* so it opens full-screen.

---

## How it works for the child

| What happens | What the child sees/hears |
| --- | --- |
| Round starts | A big picture pops in. A voice says *"Apple! What letter does apple start with?"* |
| Taps the picture | The word is spoken again |
| Taps the **right** letter | The letter glows and bounces, confetti, happy chime, *"Yes! A is for apple!"*, a star lights up, next picture after ~2 seconds |
| Taps a **wrong** letter | The button wobbles and fades, a soft low "boop", *"Try again!"*. No penalty, no game over, can try again right away |
| 10 stars | Trophy screen with confetti. One big button plays again |

Design choices made for toddlers:

- **Zero reading required.** Every instruction is spoken, and the only controls are pictures, letters and two big round buttons.
- **Huge tap targets** (the four letters fill the lower half of the screen) with chunky colours and rounded corners.
- **Impossible to fail.** Wrong answers are gently discouraged, never punished.
- **No tiny controls** other than a single mute button at the top right (for parents).
- **No accidental zoom or text selection**, and the page never scrolls.
- **Pictures never repeat back-to-back**, and every picture shows up once before any picture repeats.
- Respects the device's **reduced-motion** setting.

---

## Project layout

```
letter-pop/
├── index.html        Screens (start, game, win) and script/style includes
├── style.css         All visuals, animations, responsive + landscape layout
├── game-logic.js     Pure game rules: picture list, option building, stars (no DOM)
├── game.js           Browser UI: rendering, speech, sounds, confetti
├── tests/
│   ├── logic.test.js Unit tests for game-logic.js (Node's built-in test runner)
│   └── dom.test.js   Full-page tests of index.html in a simulated browser (jsdom)
├── package.json      `npm test` scripts (jsdom is a dev-only dependency)
└── README.md         This file
```

### How the pieces fit together

- `game-logic.js` is a small UMD module. In the browser it becomes
  `window.LetterPopLogic`, in Node it is `require`-able. It knows nothing about
  the page, which is what makes it easy to test.
- `createGame()` deals pictures from a shuffled "bag", builds four options (the
  right letter plus three different wrong ones, shuffled), and tracks stars.
  `answer(letter)` returns `{ correct, stars, goal, completed }`, or
  `{ ignored: true }` for taps that should do nothing (already solved, already
  tried that wrong letter, or a letter that was never offered).
- `game.js` listens for taps, calls the logic, and updates the page. It also
  handles audio:
  - **Spoken words** use the browser's built-in Web Speech API
    (`speechSynthesis`).
  - **Chimes** are synthesized live with the Web Audio API. No audio files.
  - If either API is missing, the game stays fully playable, just quieter.
- The start screen exists partly because browsers only allow audio after a
  user tap, so pressing ▶ unlocks sound for the whole session.
- The mute choice is remembered in `localStorage` (and the game still works if
  storage is blocked, such as in private browsing).

---

## Adding or changing pictures

Open `game-logic.js` and edit the `WORDS` array. One line per picture:

```js
{ word: 'giraffe', emoji: '🦒', letter: 'G' },
```

Rules (the tests enforce the first three):

1. `letter` must be the uppercase first letter of `word`.
2. `word` must be a single lowercase word (so no "ice cream").
3. Words and emoji must be unique.
4. Pick pictures a toddler recognises instantly. Avoid look-alikes (for example
   a dog and a wolf), abstract objects, and brand new emoji that older devices
   can't draw.

New letters are picked up automatically: the wrong-answer pool is built from
whatever letters appear in `WORDS`. You need at least four different letters.

Other quick tweaks:

| What | Where |
| --- | --- |
| Stars needed to win | `DEFAULT_GOAL` in `game-logic.js` (also update the win text if you like) |
| Delay before the next picture | `NEXT_ROUND_DELAY_MS` in `game.js` |
| Colours | CSS variables at the top of `style.css` |
| Number of choices | `OPTION_COUNT` in `game-logic.js` (the CSS grid is 2x2, so change that too) |
| Voice speed/pitch | `speak()` in `game.js` |

---

## Tests

```bash
npm install        # once: installs jsdom (dev only)
npm test           # everything
npm run test:logic # game rules only, needs no install
```

What is covered:

- **Word list integrity:** correct first letters, no duplicate words/emoji,
  single lowercase words, enough distinct letters.
- **Option building:** always 4 distinct letters, always includes the right
  one, the right one lands in every position over time.
- **Game rules:** stars only go up, wrong guesses cost nothing, repeat/invalid
  taps are ignored, completing the goal resets the stars next round, no
  picture twice in a row, every picture shown before repeats.
- **Whole page (jsdom):** start → play → four buttons → right answer (glow,
  star, confetti, everything locks) → wrong answer (only that button
  disables) → automatic next round → mute toggle and ARIA state → ten stars
  shows the trophy and *play again* resets.

Not covered by automated tests (please check by ear/eye on a real device):
the actual voice output, chime sounds, and animation feel. jsdom has no audio
and doesn't render layout.

### Manual device checklist

- [ ] Sound on: word is spoken, chime plays on right and wrong answers
- [ ] Sound off (🔊 button): silence, and it stays off after reload
- [ ] Portrait phone: picture on top, four big letters below, no scrolling
- [ ] Landscape phone: picture left, letters right
- [ ] Emoji look right on your device (they come from the OS emoji font)
- [ ] Double-tap does not zoom the page

---

## Accessibility notes

- The picture button has an accessible name equal to the word (for example
  "apple. Tap to hear it again.") and each letter button is labelled
  "Letter A", so screen readers work.
- The star row exposes "N of 10 stars".
- `prefers-reduced-motion` turns animations down to near-instant.
- Colours are used decoratively. Correct/wrong is also communicated by
  movement, sound and speech, never colour alone.

## Privacy

Nothing leaves the device. The only thing stored is whether sound is muted
(`localStorage`, key `letterpop.muted`). There are no network requests, no
analytics and no third-party scripts or fonts.

## Known limitations

- Voice quality depends on the device's built-in text-to-speech voices.
- Emoji appearance varies between Apple, Google and Microsoft devices.
- Letters shown are uppercase only. Lowercase is a possible later addition.
- Only English words so far.

## Ideas for later

- Lowercase mode, or showing both cases
- Sound-it-out mode ("buh" for B) instead of the letter name
- More pictures, themed packs (animals, food, vehicles)
- Optional parent settings (stars to win, number of choices)

## License

MIT
