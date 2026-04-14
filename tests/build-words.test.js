import { describe, it, expect } from 'vitest';
import { letterSignature, findExpansions } from '../src/words.js';
import { trimPuzzleData, filterByCommonWords } from '../scripts/build-words.js';

const testDictionary = [
  'at', 'bat', 'cat', 'sat', 'tab', 'act',
  'cats', 'cast', 'scat', 'acts', 'coat', 'taco', 'cart',
  'rind', 'grind', 'diner', 'drink', 'rinds',
  'dog', 'doge', 'dogs', 'gods',
  // Multi-letter expansion test words
  'cleat', 'eclat',  // cat + e,l
  'steam', 'mates', 'meats', 'teams', 'tames',  // at + e,m,s
  'grinder',  // rind + e,g,r
  'risk', 'irks', 'kirs', 'kris',  // ski + r (regression test)
  'ski',
];

describe('letterSignature', () => {
  it('returns sorted lowercase letters', () => {
    expect(letterSignature('cat')).toBe('act');
    expect(letterSignature('taco')).toBe('acot');
    expect(letterSignature('CAT')).toBe('act');
  });
});

describe('findExpansions', () => {
  it('finds words formed by adding one letter to root', () => {
    const expansions = findExpansions('cat', testDictionary);
    expect(expansions).toHaveProperty('o');
    expect(expansions['o']).toContain('coat');
    expect(expansions['o']).toContain('taco');
    expect(expansions).toHaveProperty('r');
    expect(expansions['r']).toContain('cart');
    expect(expansions).toHaveProperty('s');
    expect(expansions['s']).toContain('cats');
    expect(expansions['s']).toContain('cast');
    expect(expansions['s']).toContain('scat');
    expect(expansions['s']).toContain('acts');
  });

  it('includes words of length root+1 through root+maxExtra', () => {
    const expansions = findExpansions('cat', testDictionary);
    for (const key of Object.keys(expansions)) {
      for (const word of expansions[key]) {
        expect(word.length).toBe(3 + key.length); // cat is 3 letters, word should be root + key length
      }
    }
  });
});

describe('findExpansions with multi-letter support', () => {
  it('finds +2 letter expansions', () => {
    const expansions = findExpansions('cat', testDictionary);
    // 'cleat' = cat + e,l (sorted: "el")
    expect(expansions).toHaveProperty('el');
    expect(expansions['el']).toContain('cleat');
    expect(expansions['el']).toContain('eclat');
  });

  it('finds +3 letter expansions', () => {
    const expansions = findExpansions('at', testDictionary);
    // 'steam' = at + e,m,s (sorted: "ems")
    expect(expansions).toHaveProperty('ems');
    expect(expansions['ems']).toContain('steam');
  });

  it('includes all valid words for ski+r without truncation', () => {
    const expansions = findExpansions('ski', testDictionary);
    expect(expansions).toHaveProperty('r');
    expect(expansions['r']).toContain('risk');
    expect(expansions['r']).toContain('irks');
    expect(expansions['r']).toContain('kirs');
    expect(expansions['r']).toContain('kris');
  });
});

describe('trimPuzzleData', () => {
  it('does not drop expansion keys when a root has many distinct letter additions', () => {
    const expansions = {};
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    for (const ch of alphabet) expansions[ch] = ['word_' + ch];
    expansions['ab'] = ['combo1'];
    expansions['cd'] = ['combo2'];
    expansions['ef'] = ['combo3'];
    expansions['gh'] = ['combo4'];
    expansions['ij'] = ['combo5'];
    expansions['kl'] = ['combo6'];

    const inputKeys = Object.keys(expansions);
    const puzzleData = { 3: [{ root: 'test', expansions }] };

    const trimmed = trimPuzzleData(puzzleData);
    const result = trimmed['3'][0].expansions;

    for (const key of inputKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('preserves commonKeys through trimming', () => {
    const puzzleData = {
      3: [{ root: 'test', expansions: { a: ['wa'], b: ['wb'] }, commonKeys: ['a'] }],
    };
    const trimmed = trimPuzzleData(puzzleData);
    expect(trimmed['3'][0].commonKeys).toEqual(['a']);
  });

  it('limits the number of words returned for each expansion key', () => {
    const manyWords = Array.from({ length: 20 }, (_, i) => 'w' + i);
    const puzzleData = { 3: [{ root: 'test', expansions: { a: manyWords } }] };

    const trimmed = trimPuzzleData(puzzleData);
    const words = trimmed['3'][0].expansions['a'];

    expect(words).toHaveLength(5);
    for (const w of words) {
      expect(manyWords).toContain(w);
    }
  });
});

describe('filterByCommonWords', () => {
  const commonWords = new Set(['cats', 'coat', 'cart', 'risk', 'grind']);

  it('keeps roots that have at least one common expansion word', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: {
          s: ['cats', 'cast', 'scat', 'acts'],
          o: ['coat', 'taco'],
          r: ['cart'],
        },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    expect(filtered[3]).toHaveLength(1);
    expect(filtered[3][0].root).toBe('cat');
  });

  it('drops roots where no expansion word is common', () => {
    const puzzleData = {
      3: [{
        root: 'xyz',
        expansions: {
          a: ['xyza', 'xzya'],
          b: ['xyzb'],
        },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    expect(filtered[3]).toHaveLength(0);
  });

  it('preserves all words including uncommon ones on surviving roots', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: {
          s: ['cats', 'cast', 'scat', 'acts'],
          o: ['coat', 'taco'],
        },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    // 'cast', 'scat', 'acts', 'taco' are not in commonWords but should be preserved
    expect(filtered[3][0].expansions.s).toHaveLength(4);
    expect(filtered[3][0].expansions.s).toContain('cast');
    expect(filtered[3][0].expansions.s).toContain('scat');
    expect(filtered[3][0].expansions.s).toContain('acts');
    expect(filtered[3][0].expansions.o).toHaveLength(2);
    expect(filtered[3][0].expansions.o).toContain('taco');
  });

  it('adds commonKeys listing expansion keys that contain common words', () => {
    const commonWords = new Set(['cats', 'cart']);
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: {
          s: ['cats', 'cast', 'scat', 'acts'],
          o: ['coat', 'taco'],
          r: ['cart'],
        },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    expect(filtered[3][0].commonKeys).toEqual(expect.arrayContaining(['s', 'r']));
    expect(filtered[3][0].commonKeys).not.toContain('o');
  });

  it('includes multi-letter keys in commonKeys when they have common words', () => {
    const commonWords = new Set(['cleat']);
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: {
          o: ['coat', 'taco'],
          el: ['cleat', 'eclat'],
        },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    expect(filtered[3][0].commonKeys).toEqual(['el']);
  });

  it('works across multiple root lengths', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { s: ['cats'] },
      }],
      4: [{
        root: 'rind',
        expansions: { g: ['grind'] },
      }, {
        root: 'xxxx',
        expansions: { a: ['xxxxa'] },
      }],
    };

    const filtered = filterByCommonWords(puzzleData, commonWords);
    expect(filtered[3]).toHaveLength(1);
    expect(filtered[4]).toHaveLength(1);
    expect(filtered[4][0].root).toBe('rind');
  });
});
