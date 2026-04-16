# Noridoc: scripts

Path: @/scripts

### Overview
- Build-time tooling for generating puzzle data from external word lists
- Runs offline (not part of the runtime app) to produce `@/data/puzzles.json`
- Invoked via `npm run build-words`

### How it fits into the larger codebase

- Imports core word logic (`letterSignature`, `buildSignatureIndex`, `findExpansions`) from `@/src/words.js` -- the same functions used at runtime
- Outputs to `@/data/puzzles.json`, which is consumed by the game at runtime
- Has two external network dependencies at build time:
  - **TWL06** scrabble dictionary from `cviebrock/wordlists` on GitHub
  - **50K common English words** from `david47k/top-english-wordlists` on GitHub
- Depends on `wink-lemmatizer` (npm, devDependency) for morphology-aware detection of trivial inflections (plurals, past tense, comparatives, superlatives, present participles). Build-time use only -- not shipped to the browser bundle.
- Tests live in `@/tests/build-words.test.js`

### Core Implementation

- **Pipeline order**: download TWL06 dictionary -> download 50K common words -> `buildPuzzleData` -> `filterTrivialInflections` -> `filterByCommonWords` -> `trimPuzzleData` -> write JSON
- `buildPuzzleData` (exported for testability) iterates root word lengths 3-8. For each root in the dictionary, it finds all valid expansions (anagram words formed by adding letters). Roots with fewer than 3 expansion letter-groups are dropped. `maxExtra` is a uniform `3` for all root lengths -- this matches the game's runtime behavior of always offering 3 letters to the player, ensuring that words requiring all 3 offered letters are discoverable.
- `filterTrivialInflections` (exported for testability) walks every expansion word of every root and partitions it via `isTrivialInflection(answer, root)`. Words classified as trivial inflections are removed from `expansions` and collected into a new per-entry `trivialAnswers` array. Expansion keys that become empty are dropped. Any pre-existing `trivialAnswers` on the entry are merged with the newly-detected ones.
- `isTrivialInflection(answer, root)` (exported) decides whether an answer is a trivial morphological inflection of the root. Logic:
  1. Consult the `FORCE_TRIVIAL` / `FORCE_NON_TRIVIAL` manual override sets first (keyed as `` `${root}|${answer}` ``). Overrides short-circuit the lemmatizer.
  2. Otherwise, check if `wink-lemmatizer`'s `verb`, `noun`, or `adjective` lemmatizer maps `answer` back to `root`. If any POS lemma matches, the answer is classified as trivial.
  3. Drop-e compensation: `wink-lemmatizer` over-reduces forms like `startled -> startl` (dropping the final `e` from root `startle`). When the root ends in `e` and the answer looks like a literal `root+suffix` or `root[:-1]+'ing'` form, the comparison is retried against `lemma + 'e'`. This catches past-tense `-d` forms and `-ing` forms of e-ending roots.
- The override sets exist because `wink-lemmatizer` has a finite WordNet exception table and gets some pairs wrong in both directions:
  - `FORCE_TRIVIAL`: lemmatizer missed a true trivial inflection -- add the pair to force-block it.
  - `FORCE_NON_TRIVIAL`: lemmatizer incorrectly flagged a legitimate answer as trivial -- add the pair to preserve it in `expansions`.
- `filterByCommonWords` drops any root whose expansion words contain zero words from the 50K common word set. For surviving roots, it annotates each entry with two fields: a `commonKeys` array (which expansion keys have at least one common word) and a `commonWords` array (the actual common words across all expansions). These enable the runtime in `@/src/game.js` to bias letter selection (`commonKeys`) and sort answer lists with common words first (`commonWords`).
- `trimPuzzleData` performs a shallow copy of the puzzle data, preserving `root`, `expansions`, `trivialAnswers`, `commonKeys`, and `commonWords` from each entry. It applies no truncation -- all roots and all words per expansion key are kept. Caps were historically present but repeatedly caused valid common words to be silently dropped (alphabetically late words like "spear" fell past the cap limit), so they were permanently removed.
- The script auto-detects whether it was invoked directly via `process.argv[1]` matching the file URL, so the exported functions (`buildPuzzleData`, `filterTrivialInflections`, `isTrivialInflection`, `filterByCommonWords`, `trimPuzzleData`) can be imported in tests without triggering the main pipeline.

### Things to Know

- The common word filter runs *before* `trimPuzzleData`, and the trivial-inflection filter runs *before* the common word filter. Ordering matters: trivial inflections are removed first, so any `commonWords` annotation produced downstream only considers non-trivial expansion words. This prevents a root from "qualifying" solely because its plural is in the common word list.
- **No caps or truncation are applied anywhere in the pipeline.** This is a deliberate project invariant codified in `@/.claude/CLAUDE.md`. Data size is explicitly not a concern; correctness (no silently dropped words) is the priority.
- The trivial-inflection filter is the single source of truth for what counts as a "trivial suffix" at runtime. Runtime `@/src/game.js` does not re-derive morphology; it only reads `round.trivialAnswers`. Adding a new override requires regenerating `@/data/puzzles.json` via `npm run build-words`.
- `filterByCommonWords` expects `commonWords` as a `Set` for O(1) lookup. The `downloadCommonWords` function returns a `Set`.
- The output JSON structure is keyed by root length (string keys like `"3"`, `"4"`, etc.), with each value being an array of `{ root, expansions, trivialAnswers, commonKeys, commonWords }` objects. `expansions` maps added-letter strings to arrays of valid non-trivial words; `trivialAnswers` lists the removed trivial inflections; `commonKeys` lists which expansion keys lead to common words; `commonWords` lists the actual common words for the root.

Created and maintained by Nori.
