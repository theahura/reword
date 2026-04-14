import { describe, it, expect, beforeEach } from 'vitest';
import { initGA, trackEvent } from '../src/analytics.js';

describe('analytics', () => {
  beforeEach(() => {
    delete window.dataLayer;
    delete window.gtag;
  });

  describe('initGA', () => {
    it('sets up dataLayer and gtag when given a measurement ID', () => {
      initGA('G-TEST123');

      expect(window.dataLayer).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    });

    it('does not set up anything when measurement ID is falsy', () => {
      initGA('');

      expect(window.dataLayer).toBeUndefined();
      expect(window.gtag).toBeUndefined();
    });
  });

  describe('trackEvent', () => {
    it('pushes event to dataLayer when GA is initialized', () => {
      initGA('G-TEST123');
      const countBefore = window.dataLayer.length;

      trackEvent('game_complete', { letter_score: 42 });

      const lastEntry = window.dataLayer[window.dataLayer.length - 1];
      expect(lastEntry[0]).toBe('event');
      expect(lastEntry[1]).toBe('game_complete');
      expect(lastEntry[2]).toEqual({ letter_score: 42 });
      expect(window.dataLayer.length).toBe(countBefore + 1);
    });

    it('does not throw when GA is not initialized', () => {
      expect(() => trackEvent('game_complete', { letter_score: 42 })).not.toThrow();
    });

    it('is a no-op when GA was initialized with falsy ID', () => {
      initGA('');
      trackEvent('game_complete', { letter_score: 42 });

      expect(window.dataLayer).toBeUndefined();
    });
  });
});
