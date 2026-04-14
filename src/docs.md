# Noridoc: src

Path: @/src

### Overview

- Core application source for the Reword daily word puzzle game, a Vue 3 single-page app
- Contains game logic (pure functions), audio, analytics, PRNG, UI utilities, and all Vue components
- Entry point is `main.js` which initializes GA4 analytics and mounts the Vue app; all game rules live in `game.js`

### How it fits into the larger codebase

- `main.js` mounts the root Vue component from `@/src/components/App.vue`
- `game.js` is the central logic module, imported by both components and `@/tests/` -- it owns puzzle selection, answer validation, tile matching, scoring, streak/lifetime stats, and share text generation
- `prng.js` provides a seeded PRNG (used by `game.js` to deterministically select daily puzzles and offered letters from `@/data/puzzles.json`)
- `analytics.js` is a thin system-boundary wrapper around GA4's `gtag.js`. It exports `initGA(measurementId)` (called once by `main.js`) and `trackEvent(eventName, params)` (called by `App.vue` at game events). The module gracefully no-ops when GA is not initialized, so all callers can invoke `trackEvent` unconditionally.
- `sound.js` and `ui.js` are browser-side utilities consumed only by components
- `@/style.css` at the project root contains all CSS, including component-specific styles (no scoped styles in `.vue` files)
- `@/tests/components.test.js` tests both the pure game logic and the Vue components

### Core Implementation

- **Puzzle data model**: Each puzzle round has a `root` word, `expansions` (a map of letter-key to valid answer words), and `offeredLetters` (the extra letters presented to the player). `offeredLetters` are generated at runtime by `getOfferedLetters()` using the seeded PRNG, not stored in the puzzle data file.
- **`completedRounds` data structure**: The central state for a finished game. Each entry contains `{ root, answer, timeMs, offeredLetters, possibleAnswers }`. This is persisted to localStorage and consumed by `ScoreScreen` and `WordListModal`. Old saved games that lack `offeredLetters` are backfilled from puzzle data on load (see `App.vue` onMounted).
- **`matchTypedToTiles()`**: Given typed letters, root letters, and offered letters, produces a matched array where each letter is tagged as `root`, `offered`, or `invalid`. Prioritizes matching against root letters first. Used by `GameBoard` for live input display and by `WordListModal` to color-code possible answer tiles.
- **`removeLetterAt(letters, index)`**: Pure function that returns a new array with the element at the given index removed. Used by `App.vue` to support click-to-remove on filled input tiles (position-specific removal, as opposed to `processKeyPress` Backspace which only removes the last letter).
- **`getAnswersForRound()`**: Collects all non-trivial-suffix valid answers by iterating expansion keys that are subsets of the offered letters. Then performs a stable partition: words present in `round.commonWords` are placed before all other words. If `commonWords` is absent or empty, original iteration order is preserved. Both the skip-round hint (up to 3 answers) and the score screen word list consume this function's output, so this is the single sort point for common word priority.
- **Answer validation**: `isValidAnswer()` checks that the answer exists in expansions whose keys are subsets of offered letters, and is not a trivial suffix (s, ed, er appended to root).
- **Hint selection**: `getHintLetter(round)` picks the best offered letter to reveal as a hint. It prefers offered letters that appear as single-char `commonKeys` entries, breaking ties by counting how many `commonWords` that letter's expansion produces. If no offered letter is a common key, it falls back to the offered letter with the most total expansion words. Returns `null` if no offered letters have any expansions.
- **Share text**: `generateShareText()` maps each round to an emoji: `🟩` (solved), `🟡` (hinted and solved), or `⬜` (skipped). Skip takes precedence over hint (empty answer = skipped regardless of hint state).
- **Lifetime stats**: `updateLifetimeStats()` tracks `totalHints` across games. A game is "perfect" only if all 10 rounds are solved with no skips, no hints, and timer enabled. Hinted rounds disqualify a game from perfect status, affecting `fastestTimeMs` and `perfectGamesPlayed` tracking.

### Things to Know

- `offeredLetters` is always exactly 3 letters, generated from expansion keys plus random alphabet fill. `getOfferedLetters()` uses a priority hierarchy for the first letter: (1) a single-letter key from `commonKeys` (expansion keys leading to common words), (2) any letter extracted from multi-letter common keys, (3) fallback to any valid expansion key if `commonKeys` is absent or empty. The `commonKeys` field is expected to come from the puzzle data; if absent, the function falls back to the pre-existing behavior of picking any valid expansion letter.
- Trivial suffix filtering (`isTrivialSuffix`) applies to both answer validation and possible answer listing -- words like "cats" for root "cat" are excluded everywhere
- The `expansions` map keys are letter combinations (e.g., "e", "el"), not full words -- `isKeySubsetOfOffered()` checks if the key's letters are all present in the offered set
- The `commonKeys` and `commonWords` fields from puzzle data are used both at puzzle generation time (for biasing offered letters) and at runtime (for hint selection via `getHintLetter`). These fields are optional; code falls back gracefully when they are absent.
- Timer gives 70s on touch devices vs 60s on pointer devices, detected once via `matchMedia` at module load
- `analytics.js` uses `window.dataLayer.push(arguments)` (not spread) as the boundary contract with GA4's `gtag.js`. The gtag.js script is loaded asynchronously via a `<script async>` tag in `@/index.html` with the measurement ID `G-B61TJ0H3MM` hardcoded (it is inherently public). `initGA` is called before `createApp()` in `main.js`.

Created and maintained by Nori.
