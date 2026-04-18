import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';

const { mockConfetti } = vi.hoisted(() => ({ mockConfetti: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: mockConfetti }));
import ScrabbleTile from '../src/components/ScrabbleTile.vue';
import TileRack from '../src/components/TileRack.vue';
import VirtualKeyboard from '../src/components/VirtualKeyboard.vue';
import ScoreScreen from '../src/components/ScoreScreen.vue';
import GameBoard from '../src/components/GameBoard.vue';
import HowToPlay from '../src/components/HowToPlay.vue';
import LoadingScreen from '../src/components/LoadingScreen.vue';
import WordListModal from '../src/components/WordListModal.vue';
import TileText from '../src/components/TileText.vue';
import App from '../src/components/App.vue';

describe('ScrabbleTile', () => {
  it('renders the letter in uppercase', () => {
    const wrapper = mount(ScrabbleTile, { props: { letter: 'a' } });
    expect(wrapper.text()).toContain('A');
  });

  it('does not display Scrabble point values', () => {
    const wrapper = mount(ScrabbleTile, { props: { letter: 'q' } });
    expect(wrapper.find('.points').exists()).toBe(false);
  });

  it('renders an empty tile when letter is empty string', () => {
    const wrapper = mount(ScrabbleTile, { props: { letter: '', tileClass: 'empty' } });
    expect(wrapper.find('.tile').classes()).toContain('empty');
  });

  it('applies the tileClass prop', () => {
    const wrapper = mount(ScrabbleTile, { props: { letter: 'r', tileClass: 'offered' } });
    expect(wrapper.find('.tile').classes()).toContain('offered');
  });
});

describe('TileRack', () => {
  it('renders each letter visibly', () => {
    const wrapper = mount(TileRack, { props: { letters: ['c', 'a', 't'] } });
    expect(wrapper.text()).toContain('C');
    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('T');
  });

  it('renders nothing for empty array', () => {
    const wrapper = mount(TileRack, { props: { letters: [] } });
    expect(wrapper.text()).toBe('');
  });

  it('applies tileClass to rendered tiles', () => {
    const wrapper = mount(TileRack, { props: { letters: ['x', 'y'], tileClass: 'offered' } });
    const tiles = wrapper.findAll('.tile');
    tiles.forEach(tile => expect(tile.classes()).toContain('offered'));
  });

  it('emits tile-click with letter and index when a tile is clicked', async () => {
    const wrapper = mount(TileRack, { props: { letters: ['a', 'b', 'c'] } });
    const tiles = wrapper.findAll('.tile');
    await tiles[1].trigger('click');
    expect(wrapper.emitted('tile-click')).toBeTruthy();
    expect(wrapper.emitted('tile-click')[0]).toEqual(['b', 1]);
  });
});

describe('VirtualKeyboard', () => {
  it('renders all letter keys and action keys', () => {
    const wrapper = mount(VirtualKeyboard);
    const text = wrapper.text();
    for (const letter of 'QWERTYUIOPASDFGHJKLZXCVBNM') {
      expect(text).toContain(letter);
    }
  });

  it('emits key-press with the letter when a letter key is clicked', async () => {
    const wrapper = mount(VirtualKeyboard);
    const qKey = wrapper.findAll('.keyboard-key').find(k => k.text() === 'Q');
    await qKey.trigger('click');
    expect(wrapper.emitted('key-press')).toBeTruthy();
    expect(wrapper.emitted('key-press')[0]).toEqual(['q']);
  });

  it('emits key-press with Enter when Enter key is clicked', async () => {
    const wrapper = mount(VirtualKeyboard);
    const enterKey = wrapper.findAll('.keyboard-key').find(k => k.attributes('data-key') === 'Enter');
    await enterKey.trigger('click');
    expect(wrapper.emitted('key-press')[0]).toEqual(['Enter']);
  });

  it('emits key-press with Backspace when Backspace key is clicked', async () => {
    const wrapper = mount(VirtualKeyboard);
    const bsKey = wrapper.findAll('.keyboard-key').find(k => k.attributes('data-key') === 'Backspace');
    await bsKey.trigger('click');
    expect(wrapper.emitted('key-press')[0]).toEqual(['Backspace']);
  });
});

describe('ScoreScreen', () => {
  const results = [
    { answer: 'coat', timeMs: 5000, root: 'cat', possibleAnswers: ['coat', 'taco'] },
    { answer: '', timeMs: 3000, root: 'dog', possibleAnswers: ['gods'] },
    { answer: 'diner', timeMs: 4000, root: 'rind', possibleAnswers: ['diner', 'drink'] },
  ];

  it('displays the correct number of solved rounds', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    expect(wrapper.text()).toContain('2 / 10');
  });

  it('displays total letters', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    // coat(4) + diner(5) = 9
    expect(wrapper.text()).toContain('9');
  });

  it('shows SKIPPED for rounds with no answer', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    expect(wrapper.text()).toContain('SKIPPED');
  });

  it('displays per-round root words', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    expect(wrapper.text()).toContain('CAT');
    expect(wrapper.text()).toContain('DOG');
    expect(wrapper.text()).toContain('RIND');
  });

  it('displays a countdown timer for next puzzle', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    // Should show "Next puzzle in:" label
    expect(wrapper.text()).toContain('Next puzzle in');
  });

  it('hides Total Time stat when timerDisabled is true', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000, timerDisabled: true },
    });
    expect(wrapper.text()).not.toContain('Total Time');
  });

  it('shows Total Time stat when timerDisabled is false', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000, timerDisabled: false },
    });
    expect(wrapper.text()).toContain('Total Time');
  });

  it('shows Solved By header only when solveRates is provided', () => {
    const solveRates = [90, 80, 70];
    const withRates = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000, solveRates },
    });
    expect(withRates.find('.rounds-summary').text()).toContain('Solved by');

    const withoutRates = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000, solveRates: null },
    });
    expect(withoutRates.find('.rounds-summary').text()).not.toContain('Solved by');
  });

  it('applies hinted class to round results where hinted is true', () => {
    const hintedResults = [
      { answer: 'coat', timeMs: 5000, root: 'cat', possibleAnswers: ['coat', 'taco'], hinted: true },
      { answer: '', timeMs: 3000, root: 'dog', possibleAnswers: ['gods'] },
      { answer: 'diner', timeMs: 4000, root: 'rind', possibleAnswers: ['diner', 'drink'], hinted: false },
    ];
    const wrapper = mount(ScoreScreen, {
      props: { results: hintedResults, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    const roundResults = wrapper.findAll('.round-result');
    expect(roundResults[0].classes()).toContain('hinted');
    expect(roundResults[1].classes()).not.toContain('hinted');
    expect(roundResults[2].classes()).not.toContain('hinted');
  });

  it('shows a word count link for rounds with possible answers', () => {
    const manyAnswersResults = [
      {
        answer: 'coat',
        timeMs: 5000,
        root: 'cat',
        offeredLetters: ['o', 'r', 'e'],
        possibleAnswers: ['coat', 'taco', 'cart', 'race', 'acre'],
      },
    ];
    const wrapper = mount(ScoreScreen, {
      props: { results: manyAnswersResults, dateStr: '2026-04-05', totalTimeMs: 5000 },
    });
    const link = wrapper.find('.more-answers-link');
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe('5 words ›');
  });

  it('emits show-word-list when word count link is clicked', async () => {
    const manyAnswersResults = [
      {
        answer: 'coat',
        timeMs: 5000,
        root: 'cat',
        offeredLetters: ['o', 'r', 'e'],
        possibleAnswers: ['coat', 'taco', 'cart', 'race', 'acre'],
      },
    ];
    const wrapper = mount(ScoreScreen, {
      props: { results: manyAnswersResults, dateStr: '2026-04-05', totalTimeMs: 5000 },
    });
    const link = wrapper.find('.more-answers-link');
    await link.trigger('click');
    expect(wrapper.emitted('show-word-list')).toBeTruthy();
    expect(wrapper.emitted('show-word-list')[0][0]).toBe(0);
  });

  it('fires confetti when all 10 rounds are solved and isFreshGame is true', async () => {
    mockConfetti.mockClear();
    const allSolvedResults = Array.from({ length: 10 }, (_, i) => ({
      answer: 'word' + i,
      timeMs: 5000,
      root: 'root',
      possibleAnswers: ['word' + i],
    }));
    mount(ScoreScreen, {
      props: { results: allSolvedResults, dateStr: '2026-04-05', totalTimeMs: 50000, isFreshGame: true },
    });
    await flushPromises();
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({ disableForReducedMotion: true })
    );
  });

  it('does not fire confetti when some rounds are skipped', async () => {
    mockConfetti.mockClear();
    const partialResults = [
      { answer: 'coat', timeMs: 5000, root: 'cat', possibleAnswers: ['coat'] },
      { answer: '', timeMs: 3000, root: 'dog', possibleAnswers: ['gods'] },
      ...Array.from({ length: 8 }, (_, i) => ({
        answer: 'word' + i,
        timeMs: 5000,
        root: 'root',
        possibleAnswers: ['word' + i],
      })),
    ];
    mount(ScoreScreen, {
      props: { results: partialResults, dateStr: '2026-04-05', totalTimeMs: 50000, isFreshGame: true },
    });
    await flushPromises();
    expect(mockConfetti).not.toHaveBeenCalled();
  });

  it('does not fire confetti when isFreshGame is false (saved game reload)', async () => {
    mockConfetti.mockClear();
    const allSolvedResults = Array.from({ length: 10 }, (_, i) => ({
      answer: 'word' + i,
      timeMs: 5000,
      root: 'root',
      possibleAnswers: ['word' + i],
    }));
    mount(ScoreScreen, {
      props: { results: allSolvedResults, dateStr: '2026-04-05', totalTimeMs: 50000, isFreshGame: false },
    });
    await flushPromises();
    expect(mockConfetti).not.toHaveBeenCalled();
  });

  it('displays solve rate percentages next to each round when solveRates is provided', () => {
    const tenResults = Array.from({ length: 10 }, (_, i) => ({
      answer: i < 8 ? 'word' + i : '',
      timeMs: 5000,
      root: 'root' + i,
      possibleAnswers: ['word' + i],
    }));
    const solveRates = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5];
    const wrapper = mount(ScoreScreen, {
      props: { results: tenResults, dateStr: '2026-04-05', totalTimeMs: 50000, solveRates },
    });
    const roundResults = wrapper.findAll('.round-result:not(.rounds-header)');
    expect(roundResults[0].text()).toContain('90%');
    expect(roundResults[4].text()).toContain('50%');
    expect(roundResults[9].text()).toContain('5%');
  });

  it('does not show solve rate percentages when solveRates is null', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000, solveRates: null },
    });
    const roundResults = wrapper.findAll('.round-result');
    roundResults.forEach(rr => {
      expect(rr.find('.solve-rate').exists()).toBe(false);
    });
  });
});

describe('TileText', () => {
  it('renders each letter of a single word as an individual tile', () => {
    const wrapper = mount(TileText, { props: { text: 'Hello' } });
    const tiles = wrapper.findAll('.tile');
    expect(tiles).toHaveLength(5);
    expect(wrapper.text()).toContain('H');
    expect(wrapper.text()).toContain('E');
    expect(wrapper.text()).toContain('L');
    expect(wrapper.text()).toContain('O');
  });

  it('renders multi-word text with a separate row per word', () => {
    const wrapper = mount(TileText, { props: { text: 'Share Results' } });
    const rows = wrapper.findAll('.tile-text-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text().replace(/\s/g, '')).toBe('SHARE');
    expect(rows[1].text().replace(/\s/g, '')).toBe('RESULTS');
  });

  it('passes tileClass through to each tile', () => {
    const wrapper = mount(TileText, { props: { text: 'Hi', tileClass: 'offered' } });
    const tiles = wrapper.findAll('.tile');
    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach(tile => {
      expect(tile.classes()).toContain('offered');
    });
  });

  it('renders punctuation as tiles', () => {
    const wrapper = mount(TileText, { props: { text: 'Wow!' } });
    const tiles = wrapper.findAll('.tile');
    expect(tiles).toHaveLength(4);
    expect(wrapper.text()).toContain('!');
  });

  it('renders nothing for empty string', () => {
    const wrapper = mount(TileText, { props: { text: '' } });
    expect(wrapper.findAll('.tile')).toHaveLength(0);
  });

  it('assigns staggered animation delays when animate is true', () => {
    const wrapper = mount(TileText, { props: { text: 'Hi', animate: true } });
    const tiles = wrapper.findAll('.tile');
    expect(tiles).toHaveLength(2);
    const delay0 = tiles[0].attributes('style');
    const delay1 = tiles[1].attributes('style');
    expect(delay0).toContain('animation-delay');
    expect(delay1).toContain('animation-delay');
    // Second tile should have a larger delay than the first
    const parseDelay = (s) => parseFloat(s.match(/animation-delay:\s*([\d.]+)/)[1]);
    expect(parseDelay(delay1)).toBeGreaterThan(parseDelay(delay0));
  });

  it('does not add animation delays when animate is false', () => {
    const wrapper = mount(TileText, { props: { text: 'Hi', animate: false } });
    const tiles = wrapper.findAll('.tile');
    tiles.forEach(tile => {
      const style = tile.attributes('style') || '';
      expect(style).not.toContain('animation-delay');
    });
  });
});

describe('ScoreScreen tile heading', () => {
  const results = [
    { answer: 'coat', timeMs: 5000, root: 'cat', possibleAnswers: ['coat', 'taco'] },
    { answer: '', timeMs: 3000, root: 'dog', possibleAnswers: ['gods'] },
    { answer: 'diner', timeMs: 4000, root: 'rind', possibleAnswers: ['diner', 'drink'] },
  ];

  it('renders the heading as tiles instead of plain text', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    const heading = wrapper.find('.tile-text');
    expect(heading.exists()).toBe(true);
    expect(heading.findAll('.tile').length).toBeGreaterThan(0);
  });

  it('renders share button text as green tiles', () => {
    const wrapper = mount(ScoreScreen, {
      props: { results, dateStr: '2026-04-05', totalTimeMs: 12000 },
    });
    const shareBtn = wrapper.find('#share-btn');
    const tilesInButton = shareBtn.findAll('.tile');
    expect(tilesInButton.length).toBeGreaterThan(0);
    tilesInButton.forEach(tile => {
      expect(tile.classes()).toContain('share-tile');
    });
  });
});

describe('WordListModal', () => {
  const round = {
    root: 'cat',
    offeredLetters: ['o', 'r', 'z'],
    possibleAnswers: ['coat', 'taco', 'cart'],
  };

  it('renders the root word as tiles', () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const rootSection = wrapper.find('[data-testid="modal-root-tiles"]');
    expect(rootSection.text()).toContain('C');
    expect(rootSection.text()).toContain('A');
    expect(rootSection.text()).toContain('T');
  });

  it('renders the offered letters as tiles', () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const offeredSection = wrapper.find('[data-testid="modal-offered-tiles"]');
    expect(offeredSection.text()).toContain('O');
    expect(offeredSection.text()).toContain('R');
    expect(offeredSection.text()).toContain('Z');
  });

  it('renders all possible words as tile rows', () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const wordRows = wrapper.findAll('[data-testid="word-row"]');
    expect(wordRows.length).toBe(3);
  });

  it('marks added letters with green tile class in word rows', () => {
    const simpleRound = {
      root: 'rind',
      offeredLetters: ['e', 'x', 'z'],
      possibleAnswers: ['diner'],
    };
    const wrapper = mount(WordListModal, {
      props: { round: simpleRound, roundIndex: 0 },
    });
    const wordRow = wrapper.find('[data-testid="word-row"]');
    const tiles = wordRow.findAll('.tile');
    // 'diner' with root 'rind': letters d, i, n, e, r
    // root letters are r, i, n, d — the 'e' is the added letter
    // At least one tile should be green (the 'e')
    expect(tiles.some(t => t.classes().includes('offered'))).toBe(true);
  });

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const closeBtn = wrapper.find('[data-testid="close-word-list"]');
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('wraps modal sections in a scrollable body container', () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const modalBody = wrapper.find('.modal-body');
    expect(modalBody.exists()).toBe(true);
    // All word rows should be inside the scrollable body
    const wordRows = modalBody.findAll('[data-testid="word-row"]');
    expect(wordRows.length).toBe(3);
  });

  it('renders close button outside the scrollable body', () => {
    const wrapper = mount(WordListModal, {
      props: { round, roundIndex: 0 },
    });
    const modal = wrapper.find('.word-list-modal');
    const closeBtn = modal.find('[data-testid="close-word-list"]');
    expect(closeBtn.exists()).toBe(true);
    // Close button should not be inside .modal-body
    const modalBody = wrapper.find('.modal-body');
    const closeBtnInBody = modalBody.find('[data-testid="close-word-list"]');
    expect(closeBtnInBody.exists()).toBe(false);
  });
});

describe('GameBoard', () => {
  const round = {
    root: 'cat',
    expansions: { o: ['coat', 'taco'], r: ['cart'] },
    offeredLetters: ['o', 'r', 'z'],
  };

  it('renders root word tiles', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '' },
    });
    expect(wrapper.text()).toContain('C');
    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('T');
  });

  it('renders offered letter tiles', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '' },
    });
    expect(wrapper.text()).toContain('O');
    expect(wrapper.text()).toContain('R');
    expect(wrapper.text()).toContain('Z');
  });

  it('renders input tiles for typed letters', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c', 'o'], message: '', messageType: '' },
    });
    const inputArea = wrapper.find('#input-area');
    const tiles = inputArea.findAll('.tile');
    expect(tiles.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the round number', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 5, inputLetters: [], message: '', messageType: '' },
    });
    expect(wrapper.text()).toContain('Round 5 of 10');
  });

  it('displays an error message', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: 'Not a valid answer', messageType: 'error' },
    });
    const msg = wrapper.find('#message');
    expect(msg.text()).toBe('Not a valid answer');
    expect(msg.classes()).toContain('error');
  });

  it('emits submit when submit button is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c', 'o', 'a', 't'], message: '', messageType: '' },
    });
    await wrapper.find('#submit-btn').trigger('click');
    expect(wrapper.emitted('submit')).toBeTruthy();
  });

  it('emits skip when skip button is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '' },
    });
    await wrapper.find('#skip-btn').trigger('click');
    expect(wrapper.emitted('skip')).toBeTruthy();
  });

  it('applies highlighted class to the correct offered tile when hintIndex is set', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '', hintIndex: 1 },
    });
    // The offered TileRack is the second tile-rack
    const offeredRack = wrapper.findAll('.tile-rack')[1];
    const tiles = offeredRack.findAll('.tile');
    expect(tiles[1].classes()).toContain('highlighted');
  });

  it('renders all input tiles in the input area when there are many letters', () => {
    const bigRound = {
      root: 'strange',
      expansions: { r: ['granters'], i: ['astringe'], er: ['estrangers'] },
      offeredLetters: ['r', 'e', 's'],
    };
    const inputLetters = ['e', 's', 't', 'r', 'a', 'n', 'g', 'e', 'r', 's'];
    const wrapper = mount(GameBoard, {
      props: { round: bigRound, roundNumber: 1, inputLetters, message: '', messageType: '' },
    });
    const inputArea = wrapper.find('#input-area');
    const tiles = inputArea.findAll('.tile');
    expect(tiles.length).toBe(10);
    expect(tiles.every(t => t.text().length > 0)).toBe(true);
  });

  it('applies fly-up class to game-board when flyUp prop is true', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c', 'o', 'a', 't'], message: '', messageType: '', flyUp: true },
    });
    expect(wrapper.find('.game-board').classes()).toContain('fly-up');
  });

  it('sets tile-index style on input tiles when flyUp is true', () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c', 'o', 'a', 't'], message: '', messageType: '', flyUp: true },
    });
    const inputArea = wrapper.find('#input-area');
    const tiles = inputArea.findAll('.tile');
    tiles.forEach((tile, i) => {
      expect(tile.attributes('style')).toContain(`--tile-index: ${i}`);
    });
  });

  it('emits tile-click with letter when a root tile is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '' },
    });
    const rootRack = wrapper.findAll('.tile-rack')[0];
    const tiles = rootRack.findAll('.tile');
    await tiles[0].trigger('click');
    expect(wrapper.emitted('tile-click')).toBeTruthy();
    expect(wrapper.emitted('tile-click')[0][0]).toBe('c');
  });

  it('emits tile-click with letter when an offered tile is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: [], message: '', messageType: '' },
    });
    const offeredRack = wrapper.findAll('.tile-rack')[1];
    const tiles = offeredRack.findAll('.tile');
    await tiles[1].trigger('click');
    expect(wrapper.emitted('tile-click')).toBeTruthy();
    expect(wrapper.emitted('tile-click')[0][0]).toBe('r');
  });

  it('emits input-tile-click with index when a filled input tile is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c', 'o'], message: '', messageType: '' },
    });
    const inputArea = wrapper.find('#input-area');
    const tiles = inputArea.findAll('.tile');
    await tiles[1].trigger('click');
    expect(wrapper.emitted('input-tile-click')).toBeTruthy();
    expect(wrapper.emitted('input-tile-click')[0][0]).toBe(1);
  });

  it('does not emit input-tile-click when an empty input tile is clicked', async () => {
    const wrapper = mount(GameBoard, {
      props: { round, roundNumber: 1, inputLetters: ['c'], message: '', messageType: '' },
    });
    const inputArea = wrapper.find('#input-area');
    const tiles = inputArea.findAll('.tile');
    // Click the last tile which should be empty (display length is at least root.length + 1 = 4)
    await tiles[tiles.length - 1].trigger('click');
    expect(wrapper.emitted('input-tile-click')).toBeFalsy();
  });
});

describe('HowToPlay', () => {
  it('renders game rules', () => {
    const wrapper = mount(HowToPlay);
    expect(wrapper.text()).toContain('How to Play');
  });

  it('describes the core mechanic of adding letters', () => {
    const wrapper = mount(HowToPlay);
    const text = wrapper.text().toLowerCase();
    // Should mention adding a letter and rearranging
    expect(text).toMatch(/add.*letter|letter.*add/);
  });

  it('mentions Scrabble dictionary as the word source', () => {
    const wrapper = mount(HowToPlay);
    const text = wrapper.text().toLowerCase();
    expect(text).toMatch(/scrabble/);
  });

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(HowToPlay);
    const closeBtn = wrapper.find('[data-testid="close-how-to-play"]');
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('renders a timer toggle control', () => {
    const wrapper = mount(HowToPlay, {
      props: { timerDisabled: false, gameInProgress: false },
    });
    const toggle = wrapper.find('[data-testid="timer-toggle"]');
    expect(toggle.exists()).toBe(true);
  });

  it('emits toggle-timer when timer toggle is clicked', async () => {
    const wrapper = mount(HowToPlay, {
      props: { timerDisabled: false, gameInProgress: false },
    });
    const toggle = wrapper.find('[data-testid="timer-toggle"]');
    await toggle.trigger('click');
    expect(wrapper.emitted('toggle-timer')).toBeTruthy();
  });

  it('shows checked state when timerDisabled is true', () => {
    const wrapper = mount(HowToPlay, {
      props: { timerDisabled: true, gameInProgress: false },
    });
    const toggle = wrapper.find('[data-testid="timer-toggle"]');
    expect(toggle.element.checked).toBe(true);
  });

  it('disables timer toggle when game is in progress', () => {
    const wrapper = mount(HowToPlay, {
      props: { timerDisabled: false, gameInProgress: true },
    });
    const toggle = wrapper.find('[data-testid="timer-toggle"]');
    expect(toggle.element.disabled).toBe(true);
  });

  it('mentions that simply adding an s is not allowed', () => {
    const wrapper = mount(HowToPlay);
    const text = wrapper.text().toLowerCase();
    expect(text).toMatch(/simply adding an 's' doesn't count/i);
  });

  it('does not emit toggle-timer when toggle is disabled and clicked', async () => {
    const wrapper = mount(HowToPlay, {
      props: { timerDisabled: false, gameInProgress: true },
    });
    const toggle = wrapper.find('[data-testid="timer-toggle"]');
    await toggle.trigger('click');
    expect(wrapper.emitted('toggle-timer')).toBeFalsy();
  });
});

describe('App – typing during transition', () => {
  const puzzleData = {
    3: [
      { root: 'cat', expansions: { o: ['coat', 'taco'], r: ['cart'] } },
      { root: 'dog', expansions: { s: ['gods'] } },
      { root: 'pen', expansions: { i: ['pine'] } },
      { root: 'bat', expansions: { e: ['beat'] } },
    ],
    4: [
      { root: 'rind', expansions: { e: ['diner'] } },
      { root: 'lamp', expansions: { c: ['clamp'] } },
      { root: 'tone', expansions: { s: ['stone'] } },
      { root: 'mare', expansions: { d: ['dream'] } },
    ],
    5: [
      { root: 'bread', expansions: { k: ['barked'] } },
      { root: 'flame', expansions: { r: ['flamer'] } },
      { root: 'plant', expansions: { e: ['planet'] } },
      { root: 'heart', expansions: { d: ['thread'] } },
    ],
    6: [
      { root: 'garden', expansions: { e: ['angered'] } },
      { root: 'listen', expansions: { g: ['singlet'] } },
    ],
    7: [
      { root: 'strange', expansions: { r: ['granters'] } },
      { root: 'pointed', expansions: { s: ['deposits'] } },
    ],
  };

  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(puzzleData),
    });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not clear the suggested words message when typing after skip', async () => {
    const wrapper = mount(App, {
      global: { stubs: { Transition: true } },
    });
    await flushPromises();

    // Skip the first round
    await wrapper.find('#skip-btn').trigger('click');
    await flushPromises();

    // Message should show possible answers
    const messageEl = wrapper.find('#message');
    expect(messageEl.text()).toMatch(/Possible:/);

    // Simulate typing via virtual keyboard during the transition
    const keyboard = wrapper.findComponent(VirtualKeyboard);
    keyboard.vm.$emit('key-press', 'a');
    await flushPromises();

    // Message should still show the possible answers, not be cleared
    expect(wrapper.find('#message').text()).toMatch(/Possible:/);
  });

  it('shows family friendly message when profane word is submitted', async () => {
    const wrapper = mount(App, {
      global: { stubs: { Transition: true } },
    });
    await flushPromises();

    // Type a profane word via virtual keyboard
    const keyboard = wrapper.findComponent(VirtualKeyboard);
    for (const letter of 'shit') {
      keyboard.vm.$emit('key-press', letter);
      await flushPromises();
    }

    // Submit
    keyboard.vm.$emit('key-press', 'Enter');
    await flushPromises();

    const messageEl = wrapper.find('#message');
    expect(messageEl.text()).toBe('This is a family friendly game');
    expect(messageEl.classes()).toContain('error');
  });

  it('does not add input letters when typing during transition', async () => {
    const wrapper = mount(App, {
      global: { stubs: { Transition: true } },
    });
    await flushPromises();

    // Skip the first round
    await wrapper.find('#skip-btn').trigger('click');
    await flushPromises();

    // Type via virtual keyboard during transition
    const keyboard = wrapper.findComponent(VirtualKeyboard);
    keyboard.vm.$emit('key-press', 'x');
    await flushPromises();

    // Input area should not have any typed letters (only empty placeholder tiles)
    const inputTiles = wrapper.find('#input-area').findAll('.tile');
    const nonEmptyTiles = inputTiles.filter(t => t.text().trim().length > 0);
    expect(nonEmptyTiles.length).toBe(0);
  });
});

describe('LoadingScreen', () => {
  it('renders a loading indicator icon', () => {
    const wrapper = mount(LoadingScreen);
    expect(wrapper.find('.loading-icon').exists()).toBe(true);
  });

  it('displays loading text', () => {
    const wrapper = mount(LoadingScreen);
    expect(wrapper.text()).toContain('Loading puzzle data');
  });

  it('has role="status" for screen reader accessibility', () => {
    const wrapper = mount(LoadingScreen);
    expect(wrapper.attributes('role')).toBe('status');
  });
});
