# Noridoc: src

Path: @/src

### Overview

- Core application source for the Reword daily word puzzle game, a Vue 3 single-page app
- Contains game logic (pure functions), audio, analytics, Firebase/leaderboard, PRNG, UI utilities, and all Vue components
- Entry point is `main.js` which initializes GA4 analytics and mounts the Vue app; all game rules live in `game.js`

### How it fits into the larger codebase

- `main.js` mounts the root Vue component from `@/src/components/App.vue`
- `game.js` is the central logic module, imported by both components and `@/tests/` -- it owns puzzle selection, answer validation, tile matching, scoring, streak/lifetime stats, and share text generation
- `prng.js` provides a seeded PRNG (used by `game.js` to deterministically select daily puzzles and offered letters from `@/data/puzzles.json`)
- `analytics.js` is a thin system-boundary wrapper around GA4's `gtag.js`. It exports `initGA(measurementId)` (called once by `main.js`) and `trackEvent(eventName, params)` (called by `App.vue` at game events). The module gracefully no-ops when GA is not initialized, so all callers can invoke `trackEvent` unconditionally.
- `firebase.js` initializes the Firebase app and exports a Firestore `db` instance for the `games-reword` project. This is the app's only Firebase entry point; all Firestore operations import `db` from here.
- `leaderboard.js` provides per-round solve rate tracking via Firestore. Two functions: `submitGameResults(dateStr, completedRounds)` atomically increments a counter document at `daily/{dateStr}` with `totalGames` and per-round `round{i}Solved` fields using Firestore `increment()`; `fetchSolveRates(dateStr)` reads the counter document and returns an array of 10 percentages (or `null` if no data exists). Both are called by `App.vue` at game end -- submit is fire-and-forget, fetch populates `solveRates` for `ScoreScreen`. The Firestore security rules (`@/firestore.rules`) enforce that `totalGames` can only increment by 1 per write.
- `sound.js` and `ui.js` are browser-side utilities consumed only by components
- `@/style.css` at the project root contains all CSS, including component-specific styles (no scoped styles in `.vue` files)
- `@/tests/components.test.js` tests both the pure game logic and the Vue components

### Core Implementation

- **Puzzle data model**: Each puzzle round has a `root` word, `expansions` (a map of letter-key to valid answer words), a `trivialAnswers` array of words that are trivial morphological inflections of the root (pre-computed at build time by `@/scripts/build-words.js`), and `offeredLetters` (the extra letters presented to the player, generated at runtime by `getOfferedLetters()` using the seeded PRNG, not stored in the puzzle data file). Words in `trivialAnswers` are already excluded from `expansions` -- the two are disjoint sets.
- **`completedRounds` data structure**: The central state for a finished game. Each entry contains `{ root, answer, timeMs, offeredLetters, possibleAnswers }`. This is persisted to localStorage and consumed by `ScoreScreen` and `WordListModal`. Old saved games that lack `offeredLetters` are backfilled from puzzle data on load (see `App.vue` onMounted).
- **`matchTypedToTiles()`**: Given typed letters, root letters, and offered letters, produces a matched array where each letter is tagged as `root`, `offered`, or `invalid`. Prioritizes matching against root letters first. Used by `GameBoard` for live input display and by `WordListModal` to color-code possible answer tiles.
- **`removeLetterAt(letters, index)`**: Pure function that returns a new array with the element at the given index removed. Used by `App.vue` to support click-to-remove on filled input tiles (position-specific removal, as opposed to `processKeyPress` Backspace which only removes the last letter).
- **`getAnswersForRound()`**: Collects all valid answers by iterating expansion keys that are subsets of the offered letters. Since the puzzle data's `expansions` are already pre-filtered to exclude trivial inflections at build time, this function does not perform any runtime trivial filtering. Then performs a stable partition: words present in `round.commonWords` are placed before all other words. If `commonWords` is absent or empty, original iteration order is preserved. Both the skip-round hint (up to 3 answers) and the score screen word list consume this function's output, so this is the single sort point for common word priority.
- **Answer validation**: `isValidAnswer()` checks that the answer exists in expansions whose keys are subsets of offered letters. It does not filter trivial inflections -- that filter ran at build time and trivials are stored separately in `round.trivialAnswers`.
- **Trivial inflection check**: `isTrivialAnswer(answer, round)` returns true if the answer is in `round.trivialAnswers` (case-insensitive). Tolerates missing/empty `trivialAnswers`. Used by `getSubmitFeedbackType` to return the `'trivial-suffix'` feedback type when a player types a trivial inflection of the root (e.g. `startled` for root `startle`).
- **Hint selection**: `getHintLetter(round)` picks the best offered letter to reveal as a hint. It prefers offered letters that appear as single-char `commonKeys` entries, breaking ties by counting how many `commonWords` that letter's expansion produces. If no offered letter is a common key, it falls back to the offered letter with the most total expansion words. Returns `null` if no offered letters have any expansions.
- **Share text**: `generateShareText()` maps each round to an emoji: `🟩` (solved), `🟡` (hinted and solved), or `⬜` (skipped). Skip takes precedence over hint (empty answer = skipped regardless of hint state). The output includes a solve count (and elapsed time when timer is enabled), and always ends with a `rewordgame.xyz` site link line.
- **"All solved" vs "perfect"**: Two distinct concepts. `isAllSolved(results)` returns true when all 10 rounds have non-empty answers -- hints are allowed, only skips disqualify. This is used to trigger the confetti celebration in `ScoreScreen`. In contrast, `isPerfect` (computed inside `updateLifetimeStats()`) requires all 10 rounds solved with no skips, no hints, and timer enabled. `isPerfect` affects `fastestTimeMs` and `perfectGamesPlayed` tracking.
- **Lifetime stats**: `updateLifetimeStats()` tracks `totalHints` across games.

### Things to Know

- `offeredLetters` is always exactly 3 letters, generated from expansion keys plus random alphabet fill. `getOfferedLetters()` uses a priority hierarchy for the first letter: (1) a single-letter key from `commonKeys` (expansion keys leading to common words), (2) any letter extracted from multi-letter common keys, (3) fallback to any valid expansion key if `commonKeys` is absent or empty. The `commonKeys` field is expected to come from the puzzle data; if absent, the function falls back to the pre-existing behavior of picking any valid expansion letter.
- Trivial inflection filtering happens at build time in `@/scripts/build-words.js` using `wink-lemmatizer` to detect morphological relationships (plurals, past tense, comparatives, superlatives, present participles) between each expansion word and its root. The runtime `isTrivialAnswer(answer, round)` simply consults the pre-computed `round.trivialAnswers` list, which is the single source of truth for whether a typed word is a trivial inflection. The runtime game logic does not re-derive this; it trusts the build output.
- The `expansions` map keys are letter combinations (e.g., "e", "el"), not full words -- `isKeySubsetOfOffered()` checks if the key's letters are all present in the offered set
- The `commonKeys` and `commonWords` fields from puzzle data are used both at puzzle generation time (for biasing offered letters) and at runtime (for hint selection via `getHintLetter`). These fields are optional; code falls back gracefully when they are absent.
- Timer gives 70s on touch devices vs 60s on pointer devices, detected once via `matchMedia` at module load
- `analytics.js` uses `window.dataLayer.push(arguments)` (not spread) as the boundary contract with GA4's `gtag.js`. The gtag.js script is loaded asynchronously via a `<script async>` tag in `@/index.html` with the measurement ID `G-B61TJ0H3MM` hardcoded (it is inherently public). `initGA` is called before `createApp()` in `main.js`.
- **Firestore data model**: One document per day at `daily/{dateStr}`. Fields are `totalGames` (number of players who finished) and `round0Solved` through `round9Solved` (number of players who solved each round). All writes use `setDoc` with `merge: true` and `increment()`, so the document is created on first write and atomically updated thereafter. This is the app's only network dependency; all Firebase calls are wrapped in `.catch(() => {})` at the call site in `App.vue`, so network failures are silently swallowed and the game functions identically offline.

Created and maintained by Nori.
