import { describe, it, expect, vi } from 'vitest';
import { createSoundEffects, initSound } from '../src/sound.js';

function createMockAudioContext() {
  const mockOscillator = {
    type: '',
    frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockGain = {
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  return {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator: vi.fn(() => ({ ...mockOscillator, frequency: { ...mockOscillator.frequency } })),
    createGain: vi.fn(() => ({ ...mockGain, gain: { ...mockGain.gain } })),
    resume: vi.fn(),
  };
}

describe('createSoundEffects', () => {
  it('returns playable sound methods for all game events', () => {
    const ctx = createMockAudioContext();
    const masterGain = ctx.createGain();
    const sounds = createSoundEffects(ctx, masterGain);

    // All game events have corresponding sound methods
    expect(typeof sounds.playKeyClick).toBe('function');
    expect(typeof sounds.playCorrect).toBe('function');
    expect(typeof sounds.playWrong).toBe('function');
    expect(typeof sounds.playSkip).toBe('function');
    expect(typeof sounds.playGameComplete).toBe('function');
  });
});

describe('initSound', () => {
  it('setMuted(true) causes isMuted() to return true', () => {
    const ctx = createMockAudioContext();
    const result = initSound(ctx);

    result.setMuted(true);
    expect(result.isMuted()).toBe(true);
  });

  it('setMuted(false) causes isMuted() to return false after being muted', () => {
    const ctx = createMockAudioContext();
    const result = initSound(ctx);

    result.setMuted(true);
    result.setMuted(false);
    expect(result.isMuted()).toBe(false);
  });

  it('defaults to unmuted', () => {
    const ctx = createMockAudioContext();
    const result = initSound(ctx);

    expect(result.isMuted()).toBe(false);
  });
});
