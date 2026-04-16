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
- Tests live in `@/tests/build-words.test.js`

### Core Implementation

- **Pipeline order**: download TWL06 dictionary -> download 50K common words -> `buildPuzzleData` -> `filterByCommonWords` -> `trimPuzzleData` -> write JSON
- `buildPuzzleData` (exported for testability) iterates root word lengths 3-8. For each root in the dictionary, it finds all valid expansions (anagram words formed by adding letters). Roots with fewer than 3 expansion letter-groups are dropped. `maxExtra` is a uniform `3` for all root lengths -- this matches the game's runtime behavior of always offering 3 letters to the player, ensuring that words requiring all 3 offered letters are discoverable.
- `filterByCommonWords` drops any root whose expansion words contain zero words from the 50K common word set. For surviving roots, it annotates each entry with two fields: a `commonKeys` array (which expansion keys have at least one common word) and a `commonWords` array (the actual common words across all expansions). These enable the runtime in `@/src/game.js` to bias letter selection (`commonKeys`) and sort answer lists with common words first (`commonWords`).
- `trimPuzzleData` performs a shallow copy of the puzzle data, preserving `root`, `expansions`, `commonKeys`, and `commonWords` from each entry. It applies no truncation -- all roots and all words per expansion key are kept. Caps were historically present but repeatedly caused valid common words to be silently dropped (alphabetically late words like "spear" fell past the cap limit), so they were permanently removed.
- The script auto-detects whether it was invoked directly via `process.argv[1]` matching the file URL, so the exported functions (`buildPuzzleData`, `filterByCommonWords`, `trimPuzzleData`) can be imported in tests without triggering the main pipeline.

### Things to Know

- The common word filter runs *before* `trimPuzzleData`. This means roots without any common words are dropped first, so the final set is entirely composed of roots that have at least one recognizable answer.
- **No caps or truncation are applied anywhere in the pipeline.** This is a deliberate project invariant codified in `@/.claude/CLAUDE.md`. Data size is explicitly not a concern; correctness (no silently dropped words) is the priority.
- `filterByCommonWords` expects `commonWords` as a `Set` for O(1) lookup. The `downloadCommonWords` function returns a `Set`.
- The output JSON structure is keyed by root length (string keys like `"3"`, `"4"`, etc.), with each value being an array of `{ root, expansions, commonKeys, commonWords }` objects where `expansions` maps added-letter strings to arrays of valid words, `commonKeys` lists which expansion keys lead to common words, and `commonWords` lists the actual common words for the root.

Created and maintained by Nori.
