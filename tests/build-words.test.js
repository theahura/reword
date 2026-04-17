import { describe, it, expect } from 'vitest';
import { letterSignature, findExpansions } from '../src/words.js';
import {
  buildPuzzleData,
  trimPuzzleData,
  filterByCommonWords,
  isTrivialInflection,
  filterTrivialInflections,
  filterProfanity,
} from '../scripts/build-words.js';

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
  // 6-letter root + 3 extra letters test words
  'trones', 'trombones',  // trones + b,m,o -> trombones
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

describe('findExpansions with 6-letter roots', () => {
  it('finds words requiring 3 extra letters for 6-letter roots when maxExtra is 3', () => {
    const expansions = findExpansions('trones', testDictionary, 3);
    // 'trombones' = trones + b,m,o (sorted key: "bmo")
    expect(expansions).toHaveProperty('bmo');
    expect(expansions['bmo']).toContain('trombones');
  });

  it('misses words requiring 3 extra letters when maxExtra is only 2', () => {
    const expansions = findExpansions('trones', testDictionary, 2);
    expect(expansions).not.toHaveProperty('bmo');
  });
});

describe('buildPuzzleData', () => {
  it('includes 3-letter expansion keys for 6-letter roots', () => {
    const dictionary = [
      'trones',
      'trombones',  // trones + b,m,o
      'stonier',    // trones + i
      'tonners',    // trones + n
      'snorter',    // trones + r
      'stoner',
    ];
    const result = buildPuzzleData(dictionary);
    const tronesEntry = (result[6] || []).find(e => e.root === 'trones');
    expect(tronesEntry).toBeDefined();
    expect(tronesEntry.expansions).toHaveProperty('bmo');
    expect(tronesEntry.expansions['bmo']).toContain('trombones');
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

  it('preserves commonWords through trimming', () => {
    const puzzleData = {
      3: [{ root: 'test', expansions: { a: ['wa'], b: ['wb'] }, commonWords: ['wa'] }],
    };
    const trimmed = trimPuzzleData(puzzleData);
    expect(trimmed['3'][0].commonWords).toEqual(['wa']);
  });

  it('preserves all words for each expansion key without capping', () => {
    const manyWords = Array.from({ length: 20 }, (_, i) => 'w' + i);
    const puzzleData = { 3: [{ root: 'test', expansions: { a: manyWords } }] };

    const trimmed = trimPuzzleData(puzzleData);
    const words = trimmed['3'][0].expansions['a'];

    expect(words).toHaveLength(20);
    expect(words).toEqual(manyWords);
  });

  it('caps roots per length at 500 but preserves all words within each root', () => {
    const roots = Array.from({ length: 600 }, (_, i) => ({
      root: 'r' + i,
      expansions: { a: ['wa'], b: ['wb'], c: ['wc'] },
    }));
    const puzzleData = { 3: roots };

    const trimmed = trimPuzzleData(puzzleData);

    expect(trimmed['3']).toHaveLength(500);
    for (const entry of trimmed['3']) {
      expect(entry.expansions['a']).toEqual(['wa']);
      expect(entry.expansions['b']).toEqual(['wb']);
      expect(entry.expansions['c']).toEqual(['wc']);
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

  it('adds commonWords listing individual words that are in the common set', () => {
    const commonWords = new Set(['cats', 'coat']);
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
    expect(filtered[3][0].commonWords).toEqual(expect.arrayContaining(['cats', 'coat']));
    expect(filtered[3][0].commonWords).not.toContain('cast');
    expect(filtered[3][0].commonWords).not.toContain('taco');
    expect(filtered[3][0].commonWords).not.toContain('cart');
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

describe('isTrivialInflection', () => {
  // Regular inflections
  it('detects regular past tense with drop-e (startled from startle)', () => {
    expect(isTrivialInflection('startled', 'startle')).toBe(true);
  });

  it('detects regular past tense for root ending in e (baked from bake)', () => {
    expect(isTrivialInflection('baked', 'bake')).toBe(true);
  });

  it('detects simple plural (cats from cat)', () => {
    expect(isTrivialInflection('cats', 'cat')).toBe(true);
  });

  it('detects regular past tense (walked from walk)', () => {
    expect(isTrivialInflection('walked', 'walk')).toBe(true);
  });

  it('detects present participle with drop-e (baking from bake)', () => {
    expect(isTrivialInflection('baking', 'bake')).toBe(true);
  });

  it('detects present participle (walking from walk)', () => {
    expect(isTrivialInflection('walking', 'walk')).toBe(true);
  });

  it('detects adjective comparative (faster from fast)', () => {
    expect(isTrivialInflection('faster', 'fast')).toBe(true);
  });

  it('detects adjective superlative (fastest from fast)', () => {
    expect(isTrivialInflection('fastest', 'fast')).toBe(true);
  });

  it('detects comparative with drop-e (safer from safe)', () => {
    expect(isTrivialInflection('safer', 'safe')).toBe(true);
  });

  it('detects superlative with drop-e (safest from safe)', () => {
    expect(isTrivialInflection('safest', 'safe')).toBe(true);
  });

  // Irregular inflections (the string approach misses these)
  it('detects irregular plural (children from child)', () => {
    expect(isTrivialInflection('children', 'child')).toBe(true);
  });

  it('detects irregular past tense (ate from eat)', () => {
    expect(isTrivialInflection('ate', 'eat')).toBe(true);
  });

  it('detects irregular past tense (went from go)', () => {
    expect(isTrivialInflection('went', 'go')).toBe(true);
  });

  it('detects doubled-consonant past tense (sinned from sin)', () => {
    expect(isTrivialInflection('sinned', 'sin')).toBe(true);
  });

  it('detects past participle (seen from see)', () => {
    expect(isTrivialInflection('seen', 'see')).toBe(true);
  });

  // True negatives (unrelated words that string rules would wrongly block)
  it('keeps unrelated word that shares prefix (card keeps from car)', () => {
    expect(isTrivialInflection('card', 'car')).toBe(false);
  });

  it('keeps unrelated word lead from lea', () => {
    expect(isTrivialInflection('lead', 'lea')).toBe(false);
  });

  it('keeps unrelated word send from sen', () => {
    expect(isTrivialInflection('send', 'sen')).toBe(false);
  });

  it('keeps unrelated word burst from bur', () => {
    expect(isTrivialInflection('burst', 'bur')).toBe(false);
  });

  it('keeps unrelated word seed from see', () => {
    expect(isTrivialInflection('seed', 'see')).toBe(false);
  });

  it('keeps agent-noun derivation (baker from bake)', () => {
    expect(isTrivialInflection('baker', 'bake')).toBe(false);
  });

  it('keeps agent-noun derivation (teacher from teach)', () => {
    expect(isTrivialInflection('teacher', 'teach')).toBe(false);
  });

  it('keeps adverb derivation (sadly from sad)', () => {
    expect(isTrivialInflection('sadly', 'sad')).toBe(false);
  });

  it('keeps adverb derivation (early from ear)', () => {
    expect(isTrivialInflection('early', 'ear')).toBe(false);
  });

  // Overrides: cases where lemmatizer is wrong and FORCE_NON_TRIVIAL fixes it
  it('keeps rated for root rat (override: rated is from rate, not rat)', () => {
    expect(isTrivialInflection('rated', 'rat')).toBe(false);
  });

  it('keeps tares for root tar (override: tares is plural of tare)', () => {
    expect(isTrivialInflection('tares', 'tar')).toBe(false);
  });

  it('keeps mares for root mar (override: mares is plural of mare)', () => {
    expect(isTrivialInflection('mares', 'mar')).toBe(false);
  });

  it('marks severed as trivial for root sever', () => {
    expect(isTrivialInflection('severed', 'sever')).toBe(true);
  });

  it('marks lower as trivial for root low (comparative)', () => {
    expect(isTrivialInflection('lower', 'low')).toBe(true);
  });

  it('marks aided as trivial for root aid', () => {
    expect(isTrivialInflection('aided', 'aid')).toBe(true);
  });

  // Wink-lemmatizer over-reduces past "root[:-1]" when root ends in 'e'.
  // We compensate by also accepting lemma + 'e' === root when the answer
  // starts with the root (i.e., it's literally root + some suffix letters).
  it('marks rated as trivial for root rate (lemmatizer over-reduces to rat)', () => {
    expect(isTrivialInflection('rated', 'rate')).toBe(true);
  });

  it('marks hoped as trivial for root hope', () => {
    expect(isTrivialInflection('hoped', 'hope')).toBe(true);
  });

  it('marks mated as trivial for root mate', () => {
    expect(isTrivialInflection('mated', 'mate')).toBe(true);
  });

  it('marks hating as trivial for root hate', () => {
    expect(isTrivialInflection('hating', 'hate')).toBe(true);
  });

  it('marks rating as trivial for root rate', () => {
    expect(isTrivialInflection('rating', 'rate')).toBe(true);
  });

  it('does NOT mark rats as trivial for root rate (rats is plural of rat, not inflection of rate)', () => {
    expect(isTrivialInflection('rats', 'rate')).toBe(false);
  });
});

describe('filterTrivialInflections', () => {
  it('moves trivial inflections out of expansions and into trivialAnswers', () => {
    const puzzleData = {
      7: [{
        root: 'startle',
        expansions: {
          d: ['startled'],
          r: ['startler'],
          s: ['startles'],
        },
      }],
    };

    const result = filterTrivialInflections(puzzleData);
    const entry = result[7][0];

    // startled, startles are trivial inflections; startler is agent-noun derivation (kept)
    expect(entry.expansions.d).toBeUndefined();
    expect(entry.expansions.s).toBeUndefined();
    expect(entry.expansions.r).toEqual(['startler']);
    expect(entry.trivialAnswers).toEqual(expect.arrayContaining(['startled', 'startles']));
    expect(entry.trivialAnswers).not.toContain('startler');
  });

  it('keeps legitimate anagrams that coincidentally share a prefix', () => {
    const puzzleData = {
      3: [{
        root: 'car',
        expansions: {
          d: ['card'],  // legitimate anagram; NOT trivial
          t: ['cart'],
        },
      }],
    };

    const result = filterTrivialInflections(puzzleData);
    const entry = result[3][0];

    expect(entry.expansions.d).toEqual(['card']);
    expect(entry.expansions.t).toEqual(['cart']);
    expect(entry.trivialAnswers || []).not.toContain('card');
  });

  it('removes expansion keys that become empty after filtering', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: {
          s: ['cats'],           // all trivial
          o: ['coat', 'taco'],   // all legitimate
        },
      }],
    };

    const result = filterTrivialInflections(puzzleData);
    const entry = result[3][0];

    expect(entry.expansions.s).toBeUndefined();
    expect(entry.expansions.o).toEqual(expect.arrayContaining(['coat', 'taco']));
    expect(entry.trivialAnswers).toEqual(['cats']);
  });

  it('partitions words within a shared expansion key', () => {
    const puzzleData = {
      4: [{
        root: 'bake',
        expansions: {
          d: ['baked'],                      // trivial past tense
          r: ['baker'],                      // kept (agent noun)
        },
      }],
    };

    const result = filterTrivialInflections(puzzleData);
    const entry = result[4][0];

    expect(entry.expansions.d).toBeUndefined();
    expect(entry.expansions.r).toEqual(['baker']);
    expect(entry.trivialAnswers).toEqual(['baked']);
  });

  it('preserves other entry fields (commonKeys, commonWords)', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { s: ['cats'], o: ['coat'] },
        commonKeys: ['o'],
        commonWords: ['coat'],
      }],
    };

    const result = filterTrivialInflections(puzzleData);
    const entry = result[3][0];

    expect(entry.commonKeys).toEqual(['o']);
    expect(entry.commonWords).toEqual(['coat']);
  });

  it('handles multiple root lengths', () => {
    const puzzleData = {
      3: [{ root: 'cat', expansions: { s: ['cats'] } }],
      4: [{ root: 'walk', expansions: { ing: ['walking'] } }],
    };

    const result = filterTrivialInflections(puzzleData);

    expect(result[3][0].trivialAnswers).toEqual(['cats']);
    expect(result[4][0].trivialAnswers).toEqual(['walking']);
  });
});

describe('filterProfanity', () => {
  it('removes roots that are profane words', () => {
    const puzzleData = {
      4: [
        { root: 'shit', expansions: { e: ['shite'], s: ['shits'], r: ['shirt'] }, trivialAnswers: [], commonKeys: ['e'], commonWords: ['shite'] },
        { root: 'lamp', expansions: { c: ['clamp'], s: ['psalm'], e: ['ample'] }, trivialAnswers: [], commonKeys: ['c'], commonWords: ['clamp'] },
      ],
    };
    const result = filterProfanity(puzzleData);
    expect(result[4]).toHaveLength(1);
    expect(result[4][0].root).toBe('lamp');
  });

  it('removes profane words from expansion lists', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { o: ['coat', 'taco'], r: ['cart'], u: ['fuck', 'cute'] },
        trivialAnswers: [],
        commonKeys: ['o'],
        commonWords: ['coat'],
      }],
    };
    const result = filterProfanity(puzzleData);
    expect(result[3][0].expansions.u).not.toContain('fuck');
  });

  it('removes expansion keys that become empty after profanity removal', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { o: ['coat'], r: ['cart'], s: ['cast'], u: ['cunt'] },
        trivialAnswers: [],
        commonKeys: ['o'],
        commonWords: ['coat'],
      }],
    };
    const result = filterProfanity(puzzleData);
    expect(result[3][0].expansions.u).toBeUndefined();
    expect(result[3][0].expansions.o).toEqual(['coat']);
  });

  it('drops roots that fall below MIN_EXPANSIONS after profanity removal', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { a: ['damn'], b: ['crap'], c: ['shit'] },
        trivialAnswers: [],
        commonKeys: [],
        commonWords: [],
      }],
    };
    const result = filterProfanity(puzzleData);
    // All expansion words are profane, so all keys removed, root should be dropped
    expect(result[3]).toHaveLength(0);
  });

  it('removes profane words from trivialAnswers', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { o: ['coat'], r: ['cart'], s: ['cast'] },
        trivialAnswers: ['shit', 'cats'],
        commonKeys: ['o'],
        commonWords: ['coat'],
      }],
    };
    const result = filterProfanity(puzzleData);
    expect(result[3][0].trivialAnswers).not.toContain('shit');
    expect(result[3][0].trivialAnswers).toContain('cats');
  });

  it('removes profane words from commonWords', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { o: ['coat'], r: ['cart'], s: ['cast'] },
        trivialAnswers: [],
        commonKeys: ['o', 'r', 's'],
        commonWords: ['coat', 'shit', 'cast'],
      }],
    };
    const result = filterProfanity(puzzleData);
    expect(result[3][0].commonWords).not.toContain('shit');
    expect(result[3][0].commonWords).toContain('coat');
    expect(result[3][0].commonWords).toContain('cast');
  });

  it('preserves clean roots and words unchanged', () => {
    const puzzleData = {
      3: [{
        root: 'cat',
        expansions: { o: ['coat', 'taco'], r: ['cart'], s: ['cast', 'acts'] },
        trivialAnswers: ['cats'],
        commonKeys: ['o', 'r'],
        commonWords: ['coat', 'cart'],
      }],
    };
    const result = filterProfanity(puzzleData);
    expect(result[3]).toHaveLength(1);
    expect(result[3][0].root).toBe('cat');
    expect(result[3][0].expansions.o).toEqual(['coat', 'taco']);
    expect(result[3][0].expansions.r).toEqual(['cart']);
    expect(result[3][0].expansions.s).toEqual(['cast', 'acts']);
  });

});
