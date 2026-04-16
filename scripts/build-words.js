import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { buildSignatureIndex, findExpansions } from '../src/words.js';

const WORD_LIST_URL = 'https://raw.githubusercontent.com/cviebrock/wordlists/master/TWL06.txt';
const COMMON_WORDS_URL = 'https://raw.githubusercontent.com/david47k/top-english-wordlists/master/top_english_words_lower_50000.txt';
const OUTPUT_PATH = new URL('../data/puzzles.json', import.meta.url).pathname;
const MIN_EXPANSIONS = 3;

async function downloadWordList() {
  console.log('Downloading TWL06 word list...');
  const response = await fetch(WORD_LIST_URL);
  if (!response.ok) throw new Error(`Failed to download word list: ${response.status}`);
  const text = await response.text();
  const words = text.trim().split('\n').map(w => w.trim().toLowerCase());
  console.log(`Downloaded ${words.length} words`);
  return words;
}

export function buildPuzzleData(dictionary) {
  console.log('Building signature index...');
  const index = buildSignatureIndex(dictionary);
  console.log(`Index has ${index.size} signatures`);

  const puzzleData = {};

  for (const rootLen of [3, 4, 5, 6, 7, 8]) {
    const maxExtra = 3;
    console.log(`Processing ${rootLen}-letter roots (max +${maxExtra} letters)...`);
    const roots = dictionary.filter(w => w.length === rootLen);
    const validRoots = [];

    for (const root of roots) {
      const expansions = findExpansions(root, index, maxExtra);
      const validLetterCount = Object.keys(expansions).length;

      if (validLetterCount >= MIN_EXPANSIONS) {
        validRoots.push({ root, expansions });
      }
    }

    console.log(`  Found ${validRoots.length} roots with ${MIN_EXPANSIONS}+ valid expansions`);
    puzzleData[rootLen] = validRoots;
  }

  return puzzleData;
}

export function filterByCommonWords(puzzleData, commonWords) {
  const result = {};
  for (const [len, roots] of Object.entries(puzzleData)) {
    result[len] = roots
      .map(entry => {
        const commonKeys = Object.entries(entry.expansions)
          .filter(([, words]) => words.some(w => commonWords.has(w)))
          .map(([key]) => key);
        if (commonKeys.length === 0) return null;
        const entryCommonWords = Object.values(entry.expansions)
          .flat()
          .filter(w => commonWords.has(w));
        return { ...entry, commonKeys, commonWords: entryCommonWords };
      })
      .filter(Boolean);
  }
  return result;
}

async function downloadCommonWords() {
  console.log('Downloading common words list...');
  const response = await fetch(COMMON_WORDS_URL);
  if (!response.ok) throw new Error(`Failed to download common words: ${response.status}`);
  const text = await response.text();
  const words = new Set(text.trim().split('\n').map(w => w.trim().toLowerCase()));
  console.log(`Downloaded ${words.size} common words`);
  return words;
}

export function trimPuzzleData(puzzleData) {
  const MAX_ROOTS_PER_LENGTH = 500;

  const result = {};
  for (const [len, roots] of Object.entries(puzzleData)) {
    let trimmedRoots = roots.map(entry => ({
      root: entry.root,
      expansions: { ...entry.expansions },
      commonKeys: entry.commonKeys || [],
      commonWords: entry.commonWords || [],
    }));

    if (trimmedRoots.length > MAX_ROOTS_PER_LENGTH) {
      trimmedRoots.sort((a, b) => {
        const aSingle = Object.keys(a.expansions).filter(k => k.length === 1).length;
        const bSingle = Object.keys(b.expansions).filter(k => k.length === 1).length;
        return bSingle - aSingle || Object.keys(b.expansions).length - Object.keys(a.expansions).length;
      });
      trimmedRoots = trimmedRoots.slice(0, MAX_ROOTS_PER_LENGTH);
    }

    result[len] = trimmedRoots;
  }

  return result;
}

async function main() {
  const dictionary = await downloadWordList();
  const commonWords = await downloadCommonWords();
  const puzzleData = buildPuzzleData(dictionary);

  const filtered = filterByCommonWords(puzzleData, commonWords);
  for (const [len, roots] of Object.entries(filtered)) {
    const original = puzzleData[len].length;
    console.log(`${len}-letter roots: ${roots.length}/${original} (${original - roots.length} dropped)`);
  }

  const trimmed = trimPuzzleData(filtered);

  writeFileSync(OUTPUT_PATH, JSON.stringify(trimmed));
  console.log(`Wrote puzzle data to ${OUTPUT_PATH}`);

  const sizeKB = (JSON.stringify(trimmed).length / 1024).toFixed(1);
  console.log(`Data size: ${sizeKB} KB`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
