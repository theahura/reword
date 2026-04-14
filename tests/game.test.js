import { describe, it, expect } from 'vitest';
import {
  isValidAnswer,
  isTrivialSuffix,
  selectDailyPuzzle,
  getOfferedLetters,
  calculateScore,
  getAnswersForRound,
  generateShareText,
  matchTypedToTiles,
  getSubmitFeedbackType,
  isConsecutiveDay,
  updateStreakStats,
  updateLifetimeStats,
  processKeyPress,
  formatCountdown,
  getTimeUntilMidnightUTC,
} from '../src/game.js';

// Minimal puzzle data for testing
const testPuzzleData = {
  3: [
    { root: 'cat', expansions: { o: ['coat', 'taco'], r: ['cart'], s: ['cast', 'acts'] } },
    { root: 'dog', expansions: { s: ['gods'], n: ['dong'] } },
    { root: 'pen', expansions: { i: ['pine'], a: ['nape', 'pane'] } },
    { root: 'bat', expansions: { e: ['beat', 'beta'], s: ['stab', 'tabs'] } },
  ],
  4: [
    { root: 'rind', expansions: { e: ['diner'], k: ['drink'], a: ['nadir', 'drain'] } },
    { root: 'lamp', expansions: { c: ['clamp'], s: ['psalm'] } },
    { root: 'tone', expansions: { s: ['stone', 'notes', 'onset'], r: ['tenor', 'noter'] } },
    { root: 'mare', expansions: { d: ['dream'], s: ['smear'] } },
  ],
  5: [
    { root: 'bread', expansions: { k: ['barked'], e: ['beader'] } },
    { root: 'flame', expansions: { r: ['flamre'], i: ['flamie'] } },
    { root: 'plant', expansions: { e: ['planet', 'platen'] } },
    { root: 'heart', expansions: { d: ['thread', 'dearth', 'hatred'], w: ['wreath', 'thawer'] } },
  ],
  6: [
    { root: 'garden', expansions: { e: ['angered', 'enraged'], i: ['reading', 'gradine'] } },
    { root: 'listen', expansions: { g: ['singlet', 'tingler'], r: ['linters', 'slinter'] } },
  ],
  7: [
    { root: 'strange', expansions: { r: ['granters'], i: ['astringe'] } },
    { root: 'pointed', expansions: { s: ['deposits', 'topsides'] } },
  ],
};

describe('selectDailyPuzzle', () => {
  it('returns exactly 10 rounds', () => {
    const puzzle = selectDailyPuzzle(testPuzzleData, '2026-04-05');
    expect(puzzle).toHaveLength(10);
  });

  it('has correct difficulty progression (2+3+3+1+1)', () => {
    const puzzle = selectDailyPuzzle(testPuzzleData, '2026-04-05');
    // First 2 roots should be 3 letters
    for (let i = 0; i < 2; i++) {
      expect(puzzle[i].root.length).toBe(3);
    }
    // Next 3 roots should be 4 letters
    for (let i = 2; i < 5; i++) {
      expect(puzzle[i].root.length).toBe(4);
    }
    // Next 3 roots should be 5 letters
    for (let i = 5; i < 8; i++) {
      expect(puzzle[i].root.length).toBe(5);
    }
    // 9th root should be 6 letters
    expect(puzzle[8].root.length).toBe(6);
    // 10th root should be 7+ letters
    expect(puzzle[9].root.length).toBeGreaterThanOrEqual(7);
  });

  it('returns the same puzzle for the same date', () => {
    const puzzle1 = selectDailyPuzzle(testPuzzleData, '2026-04-05');
    const puzzle2 = selectDailyPuzzle(testPuzzleData, '2026-04-05');
    expect(puzzle1).toEqual(puzzle2);
  });

  it('returns different puzzles for different dates', () => {
    const puzzle1 = selectDailyPuzzle(testPuzzleData, '2026-04-05');
    const puzzle2 = selectDailyPuzzle(testPuzzleData, '2026-04-06');
    const roots1 = puzzle1.map(p => p.root);
    const roots2 = puzzle2.map(p => p.root);
    // They might occasionally match on some roots, but the full set should differ
    // (With our small test data, they'll likely share some, but the offered letters should differ)
    expect(puzzle1).not.toEqual(puzzle2);
  });
});

describe('isTrivialSuffix', () => {
  it('returns true for root + s', () => {
    expect(isTrivialSuffix('rinds', 'rind')).toBe(true);
  });

  it('returns true for root + ed', () => {
    expect(isTrivialSuffix('planted', 'plant')).toBe(true);
  });

  it('returns true for root + er', () => {
    expect(isTrivialSuffix('faster', 'fast')).toBe(true);
  });

  it('returns false for a genuine rearrangement', () => {
    expect(isTrivialSuffix('stream', 'aster')).toBe(false);
  });

  it('returns false for a prepend like master from aster', () => {
    expect(isTrivialSuffix('master', 'aster')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isTrivialSuffix('RINDS', 'rind')).toBe(true);
    expect(isTrivialSuffix('rinds', 'RIND')).toBe(true);
  });
});

describe('isValidAnswer', () => {
  it('accepts a valid answer', () => {
    const round = { root: 'rind', expansions: { e: ['diner'], k: ['drink'] }, offeredLetters: ['e', 'k', 'z'] };
    expect(isValidAnswer('diner', round)).toBe(true);
    expect(isValidAnswer('drink', round)).toBe(true);
  });

  it('rejects a word not in expansions', () => {
    const round = { root: 'rind', expansions: { e: ['diner'], k: ['drink'] }, offeredLetters: ['e', 'k', 'z'] };
    expect(isValidAnswer('pizza', round)).toBe(false);
  });

  it('rejects trivial suffix appends (root + s)', () => {
    const round = { root: 'rind', expansions: { s: ['rinds'] }, offeredLetters: ['s', 'g', 'e'] };
    expect(isValidAnswer('rinds', round)).toBe(false);
  });

  it('rejects trivial suffix appends (root + ed)', () => {
    const round = { root: 'plant', expansions: { ed: ['planted'] }, offeredLetters: ['e', 'd', 'z'] };
    expect(isValidAnswer('planted', round)).toBe(false);
  });

  it('rejects trivial suffix appends (root + er)', () => {
    const round = { root: 'fast', expansions: { er: ['faster'] }, offeredLetters: ['e', 'r', 'z'] };
    expect(isValidAnswer('faster', round)).toBe(false);
  });

  it('accepts words containing root as substring when rearranged', () => {
    const round = {
      root: 'aster',
      expansions: { m: ['armets', 'master', 'maters', 'matres', 'ramets', 'stream'] },
      offeredLetters: ['m', 'x', 'z'],
    };
    // master contains aster as substring, but other answers like stream are rearranged
    expect(isValidAnswer('stream', round)).toBe(true);
    expect(isValidAnswer('armets', round)).toBe(true);
  });

  it('still accepts master from aster (prepend, not suffix append)', () => {
    const round = {
      root: 'aster',
      expansions: { m: ['armets', 'master', 'maters', 'matres', 'ramets', 'stream'] },
      offeredLetters: ['m', 'x', 'z'],
    };
    expect(isValidAnswer('master', round)).toBe(true);
  });

  it('is case-insensitive', () => {
    const round = { root: 'rind', expansions: { e: ['diner'] }, offeredLetters: ['e', 'k', 'z'] };
    expect(isValidAnswer('DINER', round)).toBe(true);
    expect(isValidAnswer('Diner', round)).toBe(true);
  });

  it('rejects a valid expansion word if its letter is not in offeredLetters', () => {
    const round = {
      root: 'rind',
      expansions: { e: ['diner'], k: ['drink'], a: ['nadir', 'drain'] },
      offeredLetters: ['e', 'k', 'z'],
    };
    // 'nadir' is a valid expansion for letter 'a', but 'a' is not offered
    expect(isValidAnswer('nadir', round)).toBe(false);
    expect(isValidAnswer('drain', round)).toBe(false);
    // But 'diner' (letter 'e') and 'drink' (letter 'k') are offered
    expect(isValidAnswer('diner', round)).toBe(true);
    expect(isValidAnswer('drink', round)).toBe(true);
  });

  it('accepts a multi-letter expansion when all needed letters are offered', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat', 'taco'], 'el': ['cleat', 'eclat'] },
      offeredLetters: ['e', 'l', 'o'],
    };
    expect(isValidAnswer('cleat', round)).toBe(true);
    expect(isValidAnswer('eclat', round)).toBe(true);
  });

  it('accepts a multi-letter expansion even when word contains root as substring', () => {
    // "grinder" contains "rind" but should be accepted via multi-letter key "egr"
    const round = {
      root: 'rind',
      expansions: { 'egr': ['grinder'] },
      offeredLetters: ['e', 'g', 'r'],
    };
    expect(isValidAnswer('grinder', round)).toBe(true);
  });

  it('rejects a multi-letter expansion when not all needed letters are offered', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat'], 'el': ['cleat'] },
      offeredLetters: ['e', 'o', 'z'],  // has 'e' but not 'l'
    };
    expect(isValidAnswer('cleat', round)).toBe(false);
    // single-letter 'o' is still valid
    expect(isValidAnswer('coat', round)).toBe(true);
  });
});

describe('getOfferedLetters', () => {
  it('returns exactly 3 letters', () => {
    const puzzleEntry = { root: 'rind', expansions: { e: ['diner'], k: ['drink'], a: ['nadir'] } };
    const letters = getOfferedLetters(puzzleEntry, () => 0.5);
    expect(letters).toHaveLength(3);
  });

  it('includes at least one letter that leads to a valid answer', () => {
    const puzzleEntry = { root: 'cat', expansions: { o: ['coat', 'taco'], r: ['cart'] } };
    const letters = getOfferedLetters(puzzleEntry, () => 0.5);
    // At least one of the offered letters should be a key in expansions
    const validLetters = Object.keys(puzzleEntry.expansions);
    const hasValid = letters.some(l => validLetters.includes(l));
    expect(hasValid).toBe(true);
  });

  it('guarantees at least one letter from commonKeys when present', () => {
    const puzzleEntry = {
      root: 'cat',
      expansions: { o: ['coat', 'taco'], r: ['cart'], s: ['cats', 'cast'] },
      commonKeys: ['r'],
    };
    // Run with multiple RNG values to verify the guarantee holds
    for (let i = 0; i < 10; i++) {
      let callCount = 0;
      const rng = () => { callCount++; return (callCount * 0.1) % 1; };
      const letters = getOfferedLetters(puzzleEntry, rng);
      expect(letters).toContain('r');
    }
  });

  it('picks a constituent letter from multi-letter commonKeys', () => {
    const puzzleEntry = {
      root: 'cat',
      expansions: { el: ['cleat', 'eclat'] },
      commonKeys: ['el'],
    };
    // With only multi-letter common keys, should pick one of 'e' or 'l'
    for (let i = 0; i < 10; i++) {
      let callCount = 0;
      const rng = () => { callCount++; return (callCount * 0.1) % 1; };
      const letters = getOfferedLetters(puzzleEntry, rng);
      const hasCommonLetter = letters.includes('e') || letters.includes('l');
      expect(hasCommonLetter).toBe(true);
    }
  });

});

describe('getAnswersForRound', () => {
  it('returns only answer words for offered letters', () => {
    const round = {
      root: 'rind',
      expansions: { e: ['diner'], k: ['drink'], a: ['nadir', 'drain'] },
      offeredLetters: ['e', 'k', 'z'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('diner');
    expect(answers).toContain('drink');
    expect(answers).not.toContain('nadir');
    expect(answers).not.toContain('drain');
  });

  it('returns empty array when no offered letter has expansions', () => {
    const round = {
      root: 'rind',
      expansions: { e: ['diner'] },
      offeredLetters: ['x', 'y', 'z'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toEqual([]);
  });

  it('flattens multiple words from the same offered letter', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat', 'taco'], r: ['cart'] },
      offeredLetters: ['o', 'r', 'z'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('coat');
    expect(answers).toContain('taco');
    expect(answers).toContain('cart');
    expect(answers).toHaveLength(3);
  });

  it('includes multi-letter expansion answers when all letters are offered', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat'], 'el': ['cleat', 'eclat'] },
      offeredLetters: ['e', 'l', 'o'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('coat');
    expect(answers).toContain('cleat');
    expect(answers).toContain('eclat');
  });

  it('excludes multi-letter expansion answers when not all letters are offered', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat'], 'el': ['cleat'] },
      offeredLetters: ['e', 'o', 'z'],  // 'l' not offered
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('coat');
    expect(answers).not.toContain('cleat');
  });

  it('excludes trivial suffix words from results', () => {
    const round = {
      root: 'rind',
      expansions: { s: ['rinds'], e: ['diner'], g: ['grind'] },
      offeredLetters: ['s', 'e', 'g'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).not.toContain('rinds');
    expect(answers).toContain('diner');
    expect(answers).toContain('grind');
  });

  it('places common words before non-common words', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['taco', 'coat'], r: ['cart'] },
      offeredLetters: ['o', 'r', 'z'],
      commonWords: ['coat'],
    };
    const answers = getAnswersForRound(round);
    expect(answers[0]).toBe('coat');
    expect(answers).toContain('taco');
    expect(answers).toContain('cart');
  });

  it('preserves order within common and non-common groups', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['taco', 'coat'], r: ['cart'], s: ['cats', 'cast', 'scat', 'acts'] },
      offeredLetters: ['o', 'r', 's'],
      commonWords: ['coat', 'cart'],
    };
    const answers = getAnswersForRound(round);
    const coatIdx = answers.indexOf('coat');
    const cartIdx = answers.indexOf('cart');
    const tacoIdx = answers.indexOf('taco');
    // Common words come before non-common words
    expect(coatIdx).toBeLessThan(tacoIdx);
    expect(cartIdx).toBeLessThan(tacoIdx);
  });

  it('handles missing commonWords gracefully', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat', 'taco'] },
      offeredLetters: ['o', 'x', 'z'],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('coat');
    expect(answers).toContain('taco');
  });

  it('handles empty commonWords array', () => {
    const round = {
      root: 'cat',
      expansions: { o: ['coat', 'taco'] },
      offeredLetters: ['o', 'x', 'z'],
      commonWords: [],
    };
    const answers = getAnswersForRound(round);
    expect(answers).toContain('coat');
    expect(answers).toContain('taco');
  });
});

describe('generateShareText', () => {
  it('shows all green squares when all rounds are solved', () => {
    const results = Array.from({ length: 10 }, () => ({ answer: 'word', timeMs: 1000, root: 'wor' }));
    const text = generateShareText(results, '2026-04-05', 60000);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Reword 2026-04-05');
    expect(lines[1]).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
    expect(lines[2]).toBe('10/10 | 1:00');
  });

  it('shows white squares for skipped rounds', () => {
    const results = [
      { answer: 'word', timeMs: 1000, root: 'wor' },
      { answer: '', timeMs: 1000, root: 'abc' },
      { answer: 'test', timeMs: 1000, root: 'tes' },
      { answer: '', timeMs: 1000, root: 'def' },
      { answer: 'five', timeMs: 1000, root: 'fiv' },
      { answer: 'six', timeMs: 1000, root: 'si' },
      { answer: '', timeMs: 1000, root: 'ghi' },
      { answer: 'eight', timeMs: 1000, root: 'eigh' },
      { answer: 'nine', timeMs: 1000, root: 'nin' },
      { answer: 'ten', timeMs: 1000, root: 'te' },
    ];
    const text = generateShareText(results, '2026-04-05', 30000);
    const lines = text.split('\n');
    expect(lines[1]).toBe('🟩⬜🟩⬜🟩🟩⬜🟩🟩🟩');
    expect(lines[2]).toBe('7/10 | 0:30');
  });

  it('shows all white squares when no rounds solved', () => {
    const results = Array.from({ length: 10 }, () => ({ answer: '', timeMs: 1000, root: 'abc' }));
    const text = generateShareText(results, '2026-04-05', 120000);
    const lines = text.split('\n');
    expect(lines[1]).toBe('⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜');
    expect(lines[2]).toBe('0/10 | 2:00');
  });

  it('omits time from share text when timer is disabled', () => {
    const results = Array.from({ length: 10 }, () => ({ answer: 'word', timeMs: 1000, root: 'wor' }));
    const text = generateShareText(results, '2026-04-05', 60000, true);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Reword 2026-04-05');
    expect(lines[1]).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
    expect(lines[2]).toBe('10/10');
    expect(text).not.toContain('|');
    expect(text).not.toContain('1:00');
  });

  it('includes time in share text when timer is not disabled', () => {
    const results = Array.from({ length: 10 }, () => ({ answer: 'word', timeMs: 1000, root: 'wor' }));
    const text = generateShareText(results, '2026-04-05', 60000, false);
    const lines = text.split('\n');
    expect(lines[2]).toBe('10/10 | 1:00');
  });

});

describe('matchTypedToTiles', () => {
  it('marks all root tiles as used when all root letters are typed', () => {
    const { matched, pool } = matchTypedToTiles(['c', 'a', 't'], ['c', 'a', 't'], ['o', 'r', 'z']);
    const usedRoot = pool.filter(t => t.source === 'root' && t.used);
    expect(usedRoot).toHaveLength(3);
  });

  it('prefers root tiles over offered tiles for matching letters', () => {
    // 'r' exists in both root and offered
    const { matched } = matchTypedToTiles(['r'], ['r', 'i', 'n', 'd'], ['r', 'e', 'k']);
    expect(matched[0].source).toBe('root');
    expect(matched[0].index).toBe(0);
  });

  it('matches offered tiles after all root copies of a letter are used', () => {
    // root has one 'e', offered has one 'e' — typing two 'e's should use root first then offered
    const { matched } = matchTypedToTiles(['e', 'e'], ['e', 'x'], ['e', 'z']);
    expect(matched[0].source).toBe('root');
    expect(matched[1].source).toBe('offered');
  });

  it('marks unmatched typed letters as invalid', () => {
    const { matched } = matchTypedToTiles(['c', 'a', 't', 'q'], ['c', 'a', 't'], ['o', 'r', 'z']);
    expect(matched[3].source).toBe('invalid');
  });

  it('handles partial input — only typed tiles are matched', () => {
    const { matched, pool } = matchTypedToTiles(['c'], ['c', 'a', 't'], ['o', 'r', 'z']);
    expect(matched).toHaveLength(1);
    const usedCount = pool.filter(t => t.used).length;
    expect(usedCount).toBe(1);
  });

  it('handles duplicate letters in root correctly', () => {
    // root "sass" has two 's' — typing one 's' marks only one
    const { pool } = matchTypedToTiles(['s'], ['s', 'a', 's', 's'], ['e']);
    const usedS = pool.filter(t => t.source === 'root' && t.letter === 's' && t.used);
    expect(usedS).toHaveLength(1);
  });

  it('returns empty matched array for empty input', () => {
    const { matched, pool } = matchTypedToTiles([], ['c', 'a', 't'], ['o', 'r', 'z']);
    expect(matched).toHaveLength(0);
    expect(pool.every(t => !t.used)).toBe(true);
  });

  it('marks full valid answer with correct root and offered assignments', () => {
    // typing "coat" for root "cat" + offered "o" should use all 3 root tiles and 1 offered
    const { matched, pool } = matchTypedToTiles(
      ['c', 'o', 'a', 't'],
      ['c', 'a', 't'],
      ['o', 'r', 'z']
    );
    const usedRoot = pool.filter(t => t.source === 'root' && t.used);
    const usedOffered = pool.filter(t => t.source === 'offered' && t.used);
    expect(usedRoot).toHaveLength(3);
    expect(usedOffered).toHaveLength(1);
    expect(usedOffered[0].letter).toBe('o');
  });
});

describe('getSubmitFeedbackType', () => {
  const round = {
    root: 'rind',
    expansions: { e: ['diner'], k: ['drink'] },
    offeredLetters: ['e', 'k', 'z'],
  };

  it('returns correct for a valid answer', () => {
    expect(getSubmitFeedbackType('diner', round)).toBe('correct');
    expect(getSubmitFeedbackType('drink', round)).toBe('correct');
  });

  it('returns invalid-length when answer is too short', () => {
    expect(getSubmitFeedbackType('din', round)).toBe('invalid-length');
    expect(getSubmitFeedbackType('di', round)).toBe('invalid-length');
  });

  it('returns invalid-length when answer is too long', () => {
    expect(getSubmitFeedbackType('dinering', round)).toBe('invalid-length');
  });

  it('returns wrong for an incorrect word of valid length', () => {
    expect(getSubmitFeedbackType('pizza', round)).toBe('wrong');
  });

  it('returns wrong for a valid expansion word whose letter is not offered', () => {
    const roundWithExtra = {
      root: 'rind',
      expansions: { e: ['diner'], k: ['drink'], a: ['nadir'] },
      offeredLetters: ['e', 'k', 'z'],
    };
    expect(getSubmitFeedbackType('nadir', roundWithExtra)).toBe('wrong');
  });

  it('returns trivial-suffix for a word that is just root + s/ed/er', () => {
    const round = { root: 'rind', expansions: { s: ['rinds'] }, offeredLetters: ['s', 'g', 'e'] };
    expect(getSubmitFeedbackType('rinds', round)).toBe('trivial-suffix');
  });

  it('returns trivial-suffix even when suffix letter is not offered', () => {
    const round = { root: 'rind', expansions: { e: ['diner'] }, offeredLetters: ['e', 'g', 'x'] };
    expect(getSubmitFeedbackType('rinds', round)).toBe('trivial-suffix');
  });
});

describe('isConsecutiveDay', () => {
  it('returns true for consecutive days', () => {
    expect(isConsecutiveDay('2026-04-05', '2026-04-04')).toBe(true);
  });

  it('returns false for the same day', () => {
    expect(isConsecutiveDay('2026-04-05', '2026-04-05')).toBe(false);
  });

  it('returns false for a 2-day gap', () => {
    expect(isConsecutiveDay('2026-04-05', '2026-04-03')).toBe(false);
  });

  it('returns true across month boundary', () => {
    expect(isConsecutiveDay('2026-03-01', '2026-02-28')).toBe(true);
  });

  it('returns true across year boundary', () => {
    expect(isConsecutiveDay('2026-01-01', '2025-12-31')).toBe(true);
  });

  it('returns false when dates are in reverse order', () => {
    expect(isConsecutiveDay('2026-04-04', '2026-04-05')).toBe(false);
  });
});

describe('updateStreakStats', () => {
  it('returns initial stats for first play (null input)', () => {
    const stats = updateStreakStats(null, '2026-04-05');
    expect(stats).toEqual({
      currentStreak: 1,
      maxStreak: 1,
      lastPlayedDate: '2026-04-05',
      gamesPlayed: 1,
    });
  });

  it('increments streak on consecutive day play', () => {
    const existing = { currentStreak: 3, maxStreak: 5, lastPlayedDate: '2026-04-04', gamesPlayed: 10 };
    const stats = updateStreakStats(existing, '2026-04-05');
    expect(stats.currentStreak).toBe(4);
    expect(stats.gamesPlayed).toBe(11);
    expect(stats.lastPlayedDate).toBe('2026-04-05');
  });

  it('returns stats unchanged on same-day play', () => {
    const existing = { currentStreak: 3, maxStreak: 5, lastPlayedDate: '2026-04-05', gamesPlayed: 10 };
    const stats = updateStreakStats(existing, '2026-04-05');
    expect(stats).toEqual(existing);
  });

  it('resets streak on missed day', () => {
    const existing = { currentStreak: 5, maxStreak: 7, lastPlayedDate: '2026-04-03', gamesPlayed: 10 };
    const stats = updateStreakStats(existing, '2026-04-05');
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(7);
    expect(stats.gamesPlayed).toBe(11);
    expect(stats.lastPlayedDate).toBe('2026-04-05');
  });

  it('updates maxStreak when current surpasses it', () => {
    const existing = { currentStreak: 5, maxStreak: 5, lastPlayedDate: '2026-04-04', gamesPlayed: 10 };
    const stats = updateStreakStats(existing, '2026-04-05');
    expect(stats.currentStreak).toBe(6);
    expect(stats.maxStreak).toBe(6);
  });

  it('preserves maxStreak when current does not surpass it', () => {
    const existing = { currentStreak: 2, maxStreak: 10, lastPlayedDate: '2026-04-04', gamesPlayed: 20 };
    const stats = updateStreakStats(existing, '2026-04-05');
    expect(stats.currentStreak).toBe(3);
    expect(stats.maxStreak).toBe(10);
  });
});

describe('processKeyPress', () => {
  it('adds a letter to empty input', () => {
    expect(processKeyPress([], 'a', 5)).toEqual(['a']);
  });

  it('appends a letter to existing input', () => {
    expect(processKeyPress(['a', 'b'], 'c', 5)).toEqual(['a', 'b', 'c']);
  });

  it('does not exceed maxLen', () => {
    expect(processKeyPress(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c']);
  });

  it('removes last letter on Backspace', () => {
    expect(processKeyPress(['a', 'b'], 'Backspace', 5)).toEqual(['a']);
  });

  it('returns empty array on Backspace with empty input', () => {
    expect(processKeyPress([], 'Backspace', 5)).toEqual([]);
  });

  it('normalizes uppercase letters to lowercase', () => {
    expect(processKeyPress(['a'], 'B', 5)).toEqual(['a', 'b']);
  });

  it('ignores non-letter keys', () => {
    expect(processKeyPress(['a'], '1', 5)).toEqual(['a']);
    expect(processKeyPress(['a'], 'Shift', 5)).toEqual(['a']);
    expect(processKeyPress(['a'], ' ', 5)).toEqual(['a']);
    expect(processKeyPress(['a'], 'Enter', 5)).toEqual(['a']);
  });
});

describe('calculateScore', () => {
  it('sums total letters across all completed words', () => {
    const completedRounds = [
      { answer: 'grind', timeMs: 5000 },
      { answer: 'diner', timeMs: 3000 },
      { answer: 'coat', timeMs: 2000 },
    ];
    const score = calculateScore(completedRounds);
    expect(score.totalLetters).toBe(5 + 5 + 4);
  });

  it('tracks total elapsed time', () => {
    const completedRounds = [
      { answer: 'grind', timeMs: 5000 },
      { answer: 'diner', timeMs: 3000 },
    ];
    const score = calculateScore(completedRounds);
    expect(score.totalTimeMs).toBe(8000);
  });

  it('counts completed rounds', () => {
    const completedRounds = [
      { answer: 'grind', timeMs: 5000 },
      { answer: 'diner', timeMs: 3000 },
    ];
    const score = calculateScore(completedRounds);
    expect(score.roundsCompleted).toBe(2);
  });

  it('returns zeros for empty input', () => {
    const score = calculateScore([]);
    expect(score.totalLetters).toBe(0);
    expect(score.totalTimeMs).toBe(0);
    expect(score.roundsCompleted).toBe(0);
  });

  it('counts zero letters for skipped rounds (empty answer)', () => {
    const completedRounds = [
      { answer: 'grind', timeMs: 5000 },
      { answer: '', timeMs: 3000 },
      { answer: 'coat', timeMs: 2000 },
    ];
    const score = calculateScore(completedRounds);
    expect(score.totalLetters).toBe(5 + 0 + 4);
    expect(score.roundsCompleted).toBe(3);
  });
});

describe('formatCountdown', () => {
  it('formats zero milliseconds as 00:00:00', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('formats hours, minutes, and seconds with zero-padding', () => {
    // 2 hours, 5 minutes, 3 seconds = 7503000ms
    const ms = (2 * 3600 + 5 * 60 + 3) * 1000;
    expect(formatCountdown(ms)).toBe('02:05:03');
  });

  it('formats 23:59:59 correctly', () => {
    const ms = (23 * 3600 + 59 * 60 + 59) * 1000;
    expect(formatCountdown(ms)).toBe('23:59:59');
  });

  it('handles fractional seconds by flooring', () => {
    const ms = (1 * 3600 + 30 * 60 + 45) * 1000 + 999;
    expect(formatCountdown(ms)).toBe('01:30:45');
  });
});

describe('getTimeUntilMidnightUTC', () => {
  it('returns a positive number less than 86400000', () => {
    const ms = getTimeUntilMidnightUTC();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(86400000);
  });
});

describe('updateLifetimeStats', () => {
  // gameRounds has a skip — NOT a perfect game
  const gameRounds = [
    { answer: 'coat', timeMs: 5000, root: 'cat', possibleAnswers: ['coat', 'taco'] },
    { answer: '', timeMs: 3000, root: 'dog', possibleAnswers: ['gods'] },
    { answer: 'diner', timeMs: 4000, root: 'rind', possibleAnswers: ['diner', 'drink'] },
  ];
  const gameTotalTimeMs = 45000;

  // 10 solved rounds = perfect game
  const perfectGameRounds = Array.from({ length: 10 }, (_, i) => ({
    answer: 'word' + i, timeMs: 3000, root: 'wor', possibleAnswers: ['word' + i],
  }));

  it('returns correctly initialized stats for first game (null existing)', () => {
    const stats = updateLifetimeStats(null, gameRounds, gameTotalTimeMs);
    expect(stats.totalLetters).toBe(4 + 5); // coat + diner
    expect(stats.totalWords).toBe(2);
    expect(stats.totalTimeMs).toBe(45000);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.bestLetterScore).toBe(9);
    expect(stats.longestWord).toBe('diner');
    expect(stats.totalSkips).toBe(1);
  });

  it('accumulates totals across multiple games', () => {
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 30000,
      totalTimeMs: 60000, gamesPlayed: 2, bestLetterScore: 15,
      longestWord: 'strange', totalSkips: 3,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, gameTotalTimeMs);
    expect(stats.totalLetters).toBe(20 + 9);
    expect(stats.totalWords).toBe(5 + 2);
    expect(stats.totalTimeMs).toBe(60000 + 45000);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.totalSkips).toBe(3 + 1);
  });

  it('does not update fastest time for imperfect game', () => {
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 60000,
      totalTimeMs: 60000, gamesPlayed: 1, bestLetterScore: 15,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 60000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, 45000);
    expect(stats.fastestTimeMs).toBe(60000);
  });

  it('updates fastest time when perfect game is faster', () => {
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 60000,
      totalTimeMs: 60000, gamesPlayed: 1, bestLetterScore: 15,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 60000,
    };
    const stats = updateLifetimeStats(existing, perfectGameRounds, 45000);
    expect(stats.fastestTimeMs).toBe(45000);
  });

  it('keeps existing fastest time when perfect game is slower', () => {
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 30000,
      totalTimeMs: 30000, gamesPlayed: 1, bestLetterScore: 15,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, perfectGameRounds, 45000);
    expect(stats.fastestTimeMs).toBe(30000);
  });

  it('updates longest word when new game has a longer one', () => {
    const existing = {
      totalLetters: 10, totalWords: 3, fastestTimeMs: 30000,
      totalTimeMs: 30000, gamesPlayed: 1, bestLetterScore: 10,
      longestWord: 'cat', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, gameTotalTimeMs);
    expect(stats.longestWord).toBe('diner');
  });

  it('keeps existing longest word when new game words are shorter', () => {
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 30000,
      totalTimeMs: 60000, gamesPlayed: 2, bestLetterScore: 15,
      longestWord: 'strangest', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, gameTotalTimeMs);
    expect(stats.longestWord).toBe('strangest');
  });

  it('updates best letter score when new game scores higher', () => {
    const existing = {
      totalLetters: 5, totalWords: 2, fastestTimeMs: 30000,
      totalTimeMs: 30000, gamesPlayed: 1, bestLetterScore: 5,
      longestWord: 'coat', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, gameTotalTimeMs);
    expect(stats.bestLetterScore).toBe(9);
  });

  it('handles first game with all skips (null existing)', () => {
    const allSkips = [
      { answer: '', timeMs: 1000, root: 'cat', possibleAnswers: ['coat'] },
      { answer: '', timeMs: 2000, root: 'dog', possibleAnswers: ['gods'] },
    ];
    const stats = updateLifetimeStats(null, allSkips, 50000);
    expect(stats.totalLetters).toBe(0);
    expect(stats.totalWords).toBe(0);
    expect(stats.totalSkips).toBe(2);
    expect(stats.longestWord).toBe('');
    expect(stats.bestLetterScore).toBe(0);
    expect(stats.gamesPlayed).toBe(1);
  });

  it('handles a game with all skips', () => {
    const allSkips = [
      { answer: '', timeMs: 1000, root: 'cat', possibleAnswers: ['coat'] },
      { answer: '', timeMs: 1000, root: 'dog', possibleAnswers: ['gods'] },
    ];
    const existing = {
      totalLetters: 20, totalWords: 5, fastestTimeMs: 30000,
      totalTimeMs: 30000, gamesPlayed: 1, bestLetterScore: 15,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 30000,
    };
    const stats = updateLifetimeStats(existing, allSkips, 50000);
    expect(stats.totalLetters).toBe(20);
    expect(stats.totalWords).toBe(5);
    expect(stats.totalSkips).toBe(2);
    expect(stats.longestWord).toBe('strange');
    expect(stats.bestLetterScore).toBe(15);
  });

  it('tracks perfect game count and time for first perfect game', () => {
    const stats = updateLifetimeStats(null, perfectGameRounds, 33000);
    expect(stats.perfectGamesPlayed).toBe(1);
    expect(stats.perfectGamesTotalTimeMs).toBe(33000);
    expect(stats.fastestTimeMs).toBe(33000);
  });

  it('does not count imperfect game in perfect game stats', () => {
    const stats = updateLifetimeStats(null, gameRounds, gameTotalTimeMs);
    expect(stats.perfectGamesPlayed).toBe(0);
    expect(stats.perfectGamesTotalTimeMs).toBe(0);
    expect(stats.fastestTimeMs).toBe(null);
  });

  it('accumulates perfect game stats across multiple perfect games', () => {
    const existing = {
      totalLetters: 50, totalWords: 11, fastestTimeMs: 40000,
      totalTimeMs: 40000, gamesPlayed: 1, bestLetterScore: 50,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 40000,
    };
    const stats = updateLifetimeStats(existing, perfectGameRounds, 35000);
    expect(stats.perfectGamesPlayed).toBe(2);
    expect(stats.perfectGamesTotalTimeMs).toBe(40000 + 35000);
    expect(stats.fastestTimeMs).toBe(35000);
  });

  it('does not change perfect game stats when imperfect game is played', () => {
    const existing = {
      totalLetters: 50, totalWords: 11, fastestTimeMs: 40000,
      totalTimeMs: 40000, gamesPlayed: 1, bestLetterScore: 50,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 40000,
    };
    const stats = updateLifetimeStats(existing, gameRounds, gameTotalTimeMs);
    expect(stats.perfectGamesPlayed).toBe(1);
    expect(stats.perfectGamesTotalTimeMs).toBe(40000);
    expect(stats.fastestTimeMs).toBe(40000);
  });

  it('does not count timer-disabled game as perfect even with all rounds solved', () => {
    const existing = {
      totalLetters: 50, totalWords: 11, fastestTimeMs: 40000,
      totalTimeMs: 40000, gamesPlayed: 1, bestLetterScore: 50,
      longestWord: 'strange', totalSkips: 0,
      perfectGamesPlayed: 1, perfectGamesTotalTimeMs: 40000,
    };
    const stats = updateLifetimeStats(existing, perfectGameRounds, 20000, true);
    expect(stats.perfectGamesPlayed).toBe(1);
    expect(stats.perfectGamesTotalTimeMs).toBe(40000);
    expect(stats.fastestTimeMs).toBe(40000);
  });
});
