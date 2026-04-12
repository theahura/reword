import { describe, it, expect } from 'vitest';
import { getDailyRng, seededShuffle, seededPick } from '../src/prng.js';

describe('getDailyRng', () => {
  it('produces the same sequence for the same date', () => {
    const rng1 = getDailyRng('2026-04-05');
    const rng2 = getDailyRng('2026-04-05');
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different dates', () => {
    const rng1 = getDailyRng('2026-04-05');
    const rng2 = getDailyRng('2026-04-06');
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('returns numbers between 0 and 1', () => {
    const rng = getDailyRng('2026-04-05');
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('seededShuffle', () => {
  it('shuffles deterministically with the same rng', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result1 = seededShuffle([...arr], getDailyRng('2026-04-05'));
    const result2 = seededShuffle([...arr], getDailyRng('2026-04-05'));
    expect(result1).toEqual(result2);
  });

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = seededShuffle([...arr], getDailyRng('2026-04-05'));
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('seededPick', () => {
  it('picks deterministically with the same rng', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const pick1 = seededPick(arr, getDailyRng('2026-04-05'));
    const pick2 = seededPick(arr, getDailyRng('2026-04-05'));
    expect(pick1).toBe(pick2);
  });

  it('picks an element from the array', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const pick = seededPick(arr, getDailyRng('2026-04-05'));
    expect(arr).toContain(pick);
  });
});
