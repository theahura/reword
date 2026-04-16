# Noridoc: components

Path: @/src/components

### Overview

- All Vue 3 components for the Reword game, using `<script setup>` composition API
- `App.vue` is the root component that owns all game state and orchestrates the game lifecycle
- Components communicate via props down and events up; no shared store

### How it fits into the larger codebase

- Mounted by `@/src/main.js` as the root app
- All game logic (validation, scoring, puzzle selection, tile matching) is imported from `@/src/game.js` -- components are presentation and state orchestration only
- `App.vue` imports from `@/src/leaderboard.js` to submit game results and fetch solve rates from Firestore at game end
- All styling lives in `@/style.css` at the project root; components use class names but no scoped styles
- Game state is persisted to/from localStorage by `App.vue`, including `completedRounds` and stats

### Core Implementation

- **App.vue** -- Root component. Owns the `state` reactive object (`currentRound`, `completedRounds`, `inputLetters`, timing state, `transitioning` flag), a `hintIndex` ref tracking which offered letter is highlighted as a hint (or `null`), an `isFreshGame` ref distinguishing first-time completion from saved game reload, and a `solveRates` ref (Array or null) for per-round solve percentages. Loads puzzle data on mount, checks localStorage for saved games (with backfill of `offeredLetters` for old saves), runs the round timer, and handles submit/skip/hint/advance lifecycle. At game end (`showScore()`), submits results to Firestore fire-and-forget for fresh games and always fetches solve rates for display. Emits nothing; receives events from children. Supports two input paths: keyboard input (physical + virtual) via `handleKeyInput`, and click-to-place/remove via the same `handleKeyInput` for source tile clicks and `handleInputTileClick` for removing specific input letters by index.

- **Game flow**: `handleSubmit()` validates input via `getSubmitFeedbackType()`, pushes to `completedRounds` with `offeredLetters`, `possibleAnswers`, and `hinted` flag, triggers fly-up animation, then calls `advanceRound()`. `handleSkip()` pushes an empty-answer entry with the same fields. `handleHint()` calls `getHintLetter()` from `@/src/game.js`, finds its index in `offeredLetters`, and sets `hintIndex`. Hint is a one-shot action per round: the button hides once `hintIndex` is set, and `hintIndex` resets to `null` on `advanceRound()`. After round 10, `showScore()` persists to localStorage and displays `ScoreScreen`. Each of these lifecycle events fires a GA4 analytics event via `trackEvent()` from `@/src/analytics.js` (`round_complete`, `round_skip`, `hint_used`, `game_complete`, `share_results`). The `game_complete` event is deliberately NOT fired when restoring a saved game (the `savedResults` guard in `showScore()`).

- **ScoreScreen.vue** -- Receives `results` (the `completedRounds` array), `isFreshGame`, and `solveRates` (Array or null) as props. Displays stats, streak info, lifetime stats, countdown to next puzzle, share button, and a per-round summary. When `solveRates` is provided, each round row displays a percentage showing what fraction of players solved that round (Sporcle-style social comparison). On mount, if `isFreshGame` is true and `isAllSolved(results)` passes, fires a `canvas-confetti` burst (with `disableForReducedMotion: true` for accessibility). This ensures confetti only fires on first completion, not on saved game reload. For each round, `otherAnswers()` filters the player's own answer out of `possibleAnswers` and displays up to 3 inline. A "+N more" button emits `show-word-list` with the round index.

- **WordListModal.vue** -- Overlay modal opened when the user clicks "+N more" on any round in `ScoreScreen`. Receives a single `round` object (from `completedRounds`) and `roundIndex`. The modal has a fixed header (close button + h2 title) and a scrollable `.modal-body` div that wraps the three content sections (root word tiles, offered letter tiles, and possible word rows). The body scrolls independently via `overflow-y: auto` with `max-height: calc(80vh - 120px)`, keeping the header pinned. Uses `matchTypedToTiles()` from `@/src/game.js` to determine which letters in each word came from root vs offered pool, applying green styling to offered-source tiles.

- **ScrabbleTile.vue** -- Renders a single letter tile. Accepts `letter` and optional `tile-class` prop. Used by `GameBoard`, `TileRack`, and `WordListModal`.

```
App.vue
  |-- LoadingScreen.vue
  |-- HowToPlay.vue (overlay)
  |-- GameBoard.vue
  |     |-- TileRack.vue
  |           |-- ScrabbleTile.vue
  |-- VirtualKeyboard.vue
  |-- ScoreScreen.vue
  |-- WordListModal.vue (overlay)
        |-- ScrabbleTile.vue
```

### Things to Know

- **`completedRounds` shape**: `{ root: string, answer: string, timeMs: number, offeredLetters: string[], possibleAnswers: string[], hinted: boolean }`. The `offeredLetters` field was added to support `WordListModal`; old localStorage saves without it are backfilled from `puzzle.value[i].offeredLetters` on load in `App.vue`. The `hinted` field is `true` if the player used the hint button during that round (regardless of whether they solved or skipped). Old saves without `hinted` are treated as `false`.
- **Click-to-place event flow**: `TileRack` emits `tile-click(letter, index)` when any tile is clicked. `GameBoard` forwards the `tile-click` event (letter only, index dropped) from both the root and offered `TileRack` instances to `App.vue`, which routes it into `handleKeyInput(letter)` -- the same handler used by keyboard input, so all existing guards (transitioning, max length, timer start) apply. `GameBoard` also emits `input-tile-click(index)` when a filled input tile is clicked (empty tiles are excluded via an `i < inputLetters.length` guard). `App.vue` handles `input-tile-click` with `handleInputTileClick`, which calls `removeLetterAt()` from `@/src/game.js` for position-specific removal.
- **Hint data flow**: `App.vue` owns `hintIndex` (ref, Number or null). It passes `hintIndex` as a prop to `GameBoard`, which passes it as `highlightedIndex` to the offered `TileRack`. `TileRack` applies the `.highlighted` CSS class to the tile at that index, producing a pulsing amber border animation. `GameBoard` conditionally renders the Hint button only when `hintIndex` is null. `ScoreScreen` applies the `.hinted` CSS class (amber text color) to round results where `r.hinted` is true.
- **Modal pattern**: Both `HowToPlay` and `WordListModal` use the same overlay-with-click-outside-to-close pattern. The overlay class handles backdrop; `@click.self` on the overlay div closes the modal.
- **`otherAnswers()` in ScoreScreen**: For solved rounds, filters out the player's submitted answer (case-insensitive) so the "possible answers" list shows alternatives. For skipped rounds, shows all possible answers.
- **Tile coloring in WordListModal**: Each word is decomposed via `matchTypedToTiles()` which returns `source: 'root'` or `source: 'offered'` per letter. Offered-source letters get the `.offered` CSS class (green background).
- **`isFreshGame` data flow**: `App.vue` owns `isFreshGame` (ref, boolean, default `false`). `showScore()` sets it to `true` when called without `savedResults` (i.e., the game was just completed), and `false` when restoring a saved game. Passed as a prop to `ScoreScreen`, which uses it to gate the confetti animation. The `canvas-confetti` library creates a temporary canvas on `document.body` at fire time; it is a zero-dependency production dependency.
- **`solveRates` data flow**: `App.vue` owns `solveRates` (ref, Array or null, default `null`). In `showScore()`, for fresh games, `submitGameResults()` is called fire-and-forget (errors silently caught). For both fresh and saved games, `fetchSolveRates()` is called and the result populates `solveRates`. Passed as a prop to `ScoreScreen`, which conditionally renders a `<span class="solve-rate">` with the percentage next to each round when the array is present. Since fetch is async and can fail, the UI gracefully omits percentages when `solveRates` is null.
- **`wordListRoundIndex`** ref in App.vue controls which round's modal is open (`null` = closed). Set by the `show-word-list` event from ScoreScreen, cleared by `close` event from WordListModal.

Created and maintained by Nori.
