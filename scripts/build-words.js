import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import lem from 'wink-lemmatizer';
import { Filter } from 'bad-words';
import { buildSignatureIndex, findExpansions } from '../src/words.js';

const WORD_LIST_URL = 'https://raw.githubusercontent.com/cviebrock/wordlists/master/TWL06.txt';
const COMMON_WORDS_URL = 'https://raw.githubusercontent.com/david47k/top-english-wordlists/master/top_english_words_lower_50000.txt';
const OUTPUT_PATH = new URL('../data/puzzles.json', import.meta.url).pathname;
const MIN_EXPANSIONS = 3;

// Manual overrides for wink-lemmatizer edge cases, keyed as `${root}|${answer}`.
// FORCE_TRIVIAL: lemmatizer missed a true trivial inflection.
// FORCE_NON_TRIVIAL: lemmatizer incorrectly flagged a legitimate answer as trivial.
// These were derived by running the lemmatizer across the full TWL06 corpus
// and manually reviewing flagged pairs. The dominant false-positive pattern is
// root + 'e' is a word, and answer is really the inflection of root+'e'
// (e.g., 'rated' is from 'rate', not 'rat'; 'mares' is from 'mare', not 'mar').
const FORCE_TRIVIAL = new Set();
const FORCE_NON_TRIVIAL = new Set([
  'sin|sines', 'sag|sages', 'rot|rotes', 'ras|rases', 'sit|sited',
  'pas|pases', 'sip|siped', 'sip|sipes', 'rat|rated', 'tar|tared',
  'tar|tares', 'mar|mares', 'tin|tined', 'tin|tines', 'lam|lamed',
  'hat|hated', 'bar|bared', 'par|pared', 'rap|raped', 'sup|supes',
  'sol|soles', 'far|farer', 'rub|rubes', 'lop|loped', 'din|dined',
  'rag|raged', 'pal|paled', 'wan|waned', 'low|lowes', 'aid|aides',
  'war|wared', 'log|loges', 'hop|hoped', 'sic|sices', 'cat|cates',
  'pat|pated', 'pat|pates', 'tap|taped', 'lob|lobed', 'lob|lobes',
  'cap|caped', 'cap|capes', 'nod|nodes', 'con|coned', 'rob|robed',
  'rim|rimed', 'lug|luged', 'cop|coped', 'run|runes', 'nap|napes',
  'pan|paned', 'pan|panes', 'mat|mated', 'mat|mater', 'top|toped',
  'dun|dunes', 'win|wined', 'wad|waded', 'fat|fated', 'man|maned',
  'man|manes', 'pin|pined', 'rip|riped', 'rip|ripes', 'eros|eroses',
  'sire|sirees', 'scar|scared', 'star|stared', 'rage|ragees',
  'mars|marses', 'spar|spared', 'sell|selles', 'slat|slated',
  'agon|agones', 'loos|looses', 'slop|sloped', 'slim|slimed',
  'char|chared', 'char|chares', 'regal|regaler', 'indorse|indorsees',
  'relocate|relocatees',
]);

export function isTrivialInflection(answer, root) {
  const a = answer.toLowerCase();
  const r = root.toLowerCase();
  if (a === r) return false;
  const key = `${r}|${a}`;
  if (FORCE_TRIVIAL.has(key)) return true;
  if (FORCE_NON_TRIVIAL.has(key)) return false;

  // Direct match: wink returns the root as lemma for one of the POS tags.
  for (const fn of [lem.verb, lem.noun, lem.adjective]) {
    if (fn(a) === r) return true;
  }

  // Drop-e compensation: wink over-reduces (e.g., 'rated' -> 'rat' instead of
  // 'rate'). When root ends in 'e' we accept the lemma if wink's output plus
  // 'e' equals the root, but guard against false positives by requiring the
  // answer to be a literal root+suffix inflection: either starts with the
  // full root (rated, rates, rater), or is the drop-e present participle
  // (root[:-1] + 'ing', e.g., hating, rating). This distinguishes 'rated'
  // (from 'rate') from 'rats' (from 'rat', which does not satisfy either shape).
  if (r.endsWith('e')) {
    const dropE = r.slice(0, -1);
    const looksLikeInflection = a.startsWith(r) || a === dropE + 'ing';
    if (looksLikeInflection) {
      for (const fn of [lem.verb, lem.noun, lem.adjective]) {
        if (fn(a) + 'e' === r) return true;
      }
    }
  }

  return false;
}

export function filterTrivialInflections(puzzleData) {
  const result = {};
  for (const [len, roots] of Object.entries(puzzleData)) {
    result[len] = roots.map(entry => {
      const newExpansions = {};
      const trivialAnswers = [];
      for (const [key, words] of Object.entries(entry.expansions)) {
        const keep = [];
        for (const w of words) {
          if (isTrivialInflection(w, entry.root)) {
            trivialAnswers.push(w);
          } else {
            keep.push(w);
          }
        }
        if (keep.length > 0) newExpansions[key] = keep;
      }
      const mergedTrivial = [...(entry.trivialAnswers || []), ...trivialAnswers];
      return { ...entry, expansions: newExpansions, trivialAnswers: mergedTrivial };
    });
  }
  return result;
}

function buildProfanitySet() {
  const filter = new Filter();
  return new Set(filter.list.map(w => w.toLowerCase()));
}

export function filterProfanity(puzzleData, profaneWords) {
  const profane = profaneWords || buildProfanitySet();
  const check = w => profane.has(w.toLowerCase());
  const result = {};
  for (const [len, roots] of Object.entries(puzzleData)) {
    result[len] = roots
      .filter(entry => !check(entry.root))
      .map(entry => {
        const newExpansions = {};
        for (const [key, words] of Object.entries(entry.expansions)) {
          const clean = words.filter(w => !check(w));
          if (clean.length > 0) newExpansions[key] = clean;
        }
        const trivialAnswers = (entry.trivialAnswers || []).filter(w => !check(w));
        const commonWords = (entry.commonWords || []).filter(w => !check(w));
        const commonKeys = (entry.commonKeys || []).filter(k => k in newExpansions);
        return { ...entry, expansions: newExpansions, trivialAnswers, commonWords, commonKeys };
      })
      .filter(entry => Object.keys(entry.expansions).length >= MIN_EXPANSIONS);
  }
  return result;
}

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
      trivialAnswers: entry.trivialAnswers || [],
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

  console.log('Filtering profanity...');
  const deProfaned = filterProfanity(puzzleData);
  let totalProfaneRemoved = 0;
  for (const [len, roots] of Object.entries(puzzleData)) {
    totalProfaneRemoved += roots.length - (deProfaned[len] || []).length;
  }
  console.log(`  Removed ${totalProfaneRemoved} profane roots`);

  console.log('Filtering trivial inflections...');
  const deTrivialized = filterTrivialInflections(deProfaned);
  let totalTrivial = 0;
  for (const roots of Object.values(deTrivialized)) {
    for (const entry of roots) totalTrivial += entry.trivialAnswers.length;
  }
  console.log(`  Moved ${totalTrivial} trivial inflections out of expansions into trivialAnswers`);

  const filtered = filterByCommonWords(deTrivialized, commonWords);
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
