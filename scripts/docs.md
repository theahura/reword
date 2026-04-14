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
- `buildPuzzleData` iterates root word lengths 3-8. For each root in the dictionary, it finds all valid expansions (anagram words formed by adding letters). Roots with fewer than 3 expansion letter-groups are dropped. The `maxExtra` letters allowed decreases as root length increases (3 extra for roots <= 5 letters, 2 for 6, 1 for 7-8).
- `filterByCommonWords` drops any root whose expansion words contain zero words from the 50K common word set. For surviving roots, it also annotates each entry with a `commonKeys` array listing which expansion keys contain at least one common word. This enables the runtime letter selection in `@/src/game.js` to bias toward letters that lead to common word answers.
- `trimPuzzleData` caps roots at 500 per length (preferring roots with more single-letter expansions) and caps words per expansion key at 5. It preserves `root`, `expansions`, and `commonKeys` from each entry.
- The script auto-detects whether it was invoked directly via `process.argv[1]` matching the file URL, so the exported functions (`filterByCommonWords`, `trimPuzzleData`) can be imported in tests without triggering the main pipeline.

### Things to Know

- The common word filter runs *before* trimming. This means roots are dropped for lacking common words before the 500-per-length cap is applied, so the final set is entirely composed of roots that have at least one recognizable answer.
- `filterByCommonWords` expects `commonWords` as a `Set` for O(1) lookup. The `downloadCommonWords` function returns a `Set`.
- The output JSON structure is keyed by root length (string keys like `"3"`, `"4"`, etc.), with each value being an array of `{ root, expansions, commonKeys }` objects where `expansions` maps added-letter strings to arrays of valid words and `commonKeys` lists which expansion keys lead to common words.

Created and maintained by Nori.
