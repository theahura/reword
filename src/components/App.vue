<template>
  <div id="game-container">
    <LoadingScreen v-if="loading" />

    <template v-else>
      <header>
        <h1>Reword</h1>
        <button class="header-icon" @click="showHowToPlay = true" aria-label="How to play">?</button>
        <button v-if="hintAvailable && hintIndex === null && !gameComplete" id="hint-btn" aria-label="Hint" @click="handleHint">💡</button>
        <button id="mute-btn" role="switch" :aria-checked="String(!muted)" :aria-label="'Sound'" @click="toggleMute">
          {{ muted ? '\u{1F507}' : '\u{1F50A}' }}
        </button>
      </header>

      <HowToPlay v-if="showHowToPlay" :timer-disabled="timerDisabled" :game-in-progress="gameInProgress" @close="showHowToPlay = false" @toggle-timer="toggleTimer" />

      <template v-if="!gameComplete">
        <GameBoard
          :round="currentRound"
          :round-number="state.currentRound + 1"
          :input-letters="state.inputLetters"
          :message="message"
          :message-type="messageType"
          :fly-up="flyUp"
          :tiles-fading-in="tilesFadingIn"
          :hint-index="hintIndex"
          @submit="handleSubmit"
          @skip="handleSkip"
        >
          <template #timer>
            <span id="letter-score">Letters: {{ runningLetterScore }}</span>
            <span v-if="!timerDisabled" class="timer-display" :class="{ 'timer-warning': timerWarning }">{{ timerDisplay }}</span>
          </template>
        </GameBoard>

        <VirtualKeyboard @key-press="handleKeyInput" />
      </template>

      <ScoreScreen
        v-if="gameComplete"
        :results="state.completedRounds"
        :date-str="dateStr"
        :total-time-ms="totalTimeMs"
        :share-button-text="shareButtonText"
        :streak-stats="streakStats"
        :lifetime-stats="lifetimeStats"
        :timer-disabled="timerDisabled"
        @share="handleShare"
        @show-word-list="i => wordListRoundIndex = i"
      />

      <WordListModal
        v-if="wordListRoundIndex != null"
        :round="state.completedRounds[wordListRoundIndex]"
        :round-index="wordListRoundIndex"
        @close="wordListRoundIndex = null"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { selectDailyPuzzle, isValidAnswer, calculateScore, getAnswersForRound, generateShareText, getSubmitFeedbackType, updateStreakStats, updateLifetimeStats, processKeyPress, getHintLetter } from '../game.js';
import { getAudioContext, initSound } from '../sound.js';
import { trackEvent } from '../analytics.js';
import GameBoard from './GameBoard.vue';
import VirtualKeyboard from './VirtualKeyboard.vue';
import ScoreScreen from './ScoreScreen.vue';
import HowToPlay from './HowToPlay.vue';
import LoadingScreen from './LoadingScreen.vue';
import WordListModal from './WordListModal.vue';

const loading = ref(true);
const puzzle = ref(null);
const dateStr = ref('');
const showHowToPlay = ref(false);
const wordListRoundIndex = ref(null);
const message = ref('');
const messageType = ref('');
const flyUp = ref(false);
const tilesFadingIn = ref(false);
const gameComplete = ref(false);
const totalTimeMs = ref(0);
const muted = ref(false);
const timerDisabled = ref(false);

const state = reactive({
  currentRound: 0,
  completedRounds: [],
  inputLetters: [],
  startTime: null,
  roundStartTime: null,
  roundDeadline: null,
  transitioning: false,
});

let timerInterval = null;
const ROUND_TIME_MS = window.matchMedia('(pointer: coarse)').matches ? 70000 : 60000;
const timerDisplay = ref(formatRoundTime(ROUND_TIME_MS));
const timerWarning = ref(false);
const hintIndex = ref(null);
const hintAvailable = ref(false);

function formatRoundTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

let audio = null;

function ensureAudio() {
  if (audio) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  audio = initSound(ctx);
  const savedMute = localStorage.getItem('reword-sound-muted') || localStorage.getItem('anagram-trainer-sound-muted');
  if (savedMute === '1') {
    audio.setMuted(true);
    muted.value = true;
  }
}

function playSound(name) {
  if (!audio) return;
  audio.sounds[name]();
}

function toggleMute() {
  ensureAudio();
  if (!audio) return;
  audio.setMuted(!audio.isMuted());
  muted.value = audio.isMuted();
  try { localStorage.setItem('reword-sound-muted', muted.value ? '1' : '0'); } catch (e) {}
}

function toggleTimer() {
  timerDisabled.value = !timerDisabled.value;
  try { localStorage.setItem('reword-timer-disabled', timerDisabled.value ? '1' : '0'); } catch (e) {}
}

const gameInProgress = computed(() => state.startTime !== null && !gameComplete.value);

const currentRound = computed(() => puzzle.value ? puzzle.value[state.currentRound] : null);
const runningLetterScore = computed(() => state.completedRounds.reduce((sum, r) => sum + r.answer.length, 0));
const streakStats = ref(null);
const lifetimeStats = ref(null);

function startTimer() {
  if (!state.startTime) state.startTime = Date.now();
  state.roundStartTime = Date.now();
  if (timerDisabled.value) {
    hintAvailable.value = true;
    return;
  }
  state.roundDeadline = Date.now() + ROUND_TIME_MS;
  timerWarning.value = false;
  hintAvailable.value = false;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const remaining = state.roundDeadline - Date.now();
    timerDisplay.value = formatRoundTime(remaining);
    timerWarning.value = remaining <= 10000;
    if (!hintAvailable.value && remaining <= 30000) hintAvailable.value = true;
    if (remaining <= 0) {
      handleSkip();
    }
  }, 100);
}

function handleSubmit() {
  ensureAudio();
  if (state.transitioning || state.currentRound >= 10) return;
  if (!state.startTime) startTimer();
  const round = puzzle.value[state.currentRound];
  const answer = state.inputLetters.join('');
  const feedback = getSubmitFeedbackType(answer, round);

  if (feedback === 'invalid-length') {
    const minLen = round.root.length + 1;
    const maxLen = round.root.length + round.offeredLetters.length;
    message.value = `Word must be ${minLen}-${maxLen} letters`;
    messageType.value = 'error';
    playSound('playWrong');
    return;
  }

  if (feedback === 'trivial-suffix') {
    message.value = 'Not a true anagram — try rearranging the letters';
    messageType.value = 'error';
    playSound('playWrong');
    return;
  }

  if (feedback === 'wrong') {
    message.value = 'Not a valid answer. Try again!';
    messageType.value = 'error';
    playSound('playWrong');
    return;
  }

  const timeMs = Date.now() - state.roundStartTime;
  const possibleAnswers = getAnswersForRound(round);
  state.completedRounds.push({ answer, timeMs, root: round.root, offeredLetters: round.offeredLetters, possibleAnswers, hinted: hintIndex.value !== null });
  trackEvent('round_complete', { round: state.currentRound + 1, answer_length: answer.length, time_ms: timeMs });
  flyUp.value = true;
  message.value = 'Correct!';
  messageType.value = 'success';
  playSound('playCorrect');
  state.transitioning = true;
  setTimeout(() => advanceRound(), 700);
}

function handleHint() {
  ensureAudio();
  if (state.transitioning || state.currentRound >= 10) return;
  if (hintIndex.value !== null) return;
  if (!state.startTime) startTimer();
  const round = puzzle.value[state.currentRound];
  const letter = getHintLetter(round);
  if (letter === null) return;
  const idx = round.offeredLetters.indexOf(letter);
  if (idx === -1) return;
  hintIndex.value = idx;
  trackEvent('hint_used', { round: state.currentRound + 1 });
  playSound('playHint');
}

function handleSkip() {
  ensureAudio();
  if (state.transitioning || state.currentRound >= 10) return;
  if (!state.startTime) startTimer();
  const round = puzzle.value[state.currentRound];
  const timeMs = Date.now() - state.roundStartTime;
  const possibleAnswers = getAnswersForRound(round);
  state.completedRounds.push({ answer: '', timeMs, root: round.root, offeredLetters: round.offeredLetters, possibleAnswers, hinted: hintIndex.value !== null });
  trackEvent('round_skip', { round: state.currentRound + 1 });
  playSound('playSkip');
  if (possibleAnswers.length > 0) {
    message.value = `Possible: ${possibleAnswers.slice(0, 3).join(', ')}`;
    messageType.value = '';
    state.transitioning = true;
    setTimeout(() => advanceRound(), 2500);
  } else {
    message.value = 'Skipped';
    messageType.value = '';
    state.transitioning = true;
    advanceRound();
  }
}

function advanceRound() {
  if (state.currentRound + 1 >= 10) {
    state.currentRound++;
    showScore();
    return;
  }
  const alreadyFlying = flyUp.value;
  flyUp.value = true;
  setTimeout(() => {
    state.currentRound++;
    state.inputLetters = [];
    message.value = '';
    messageType.value = '';
    flyUp.value = false;
    hintIndex.value = null;
    tilesFadingIn.value = true;
    startTimer();
    setTimeout(() => {
      tilesFadingIn.value = false;
      state.transitioning = false;
    }, 200);
  }, alreadyFlying ? 0 : 400);
}

function showScore(savedResults) {
  clearInterval(timerInterval);
  gameComplete.value = true;

  if (savedResults) {
    totalTimeMs.value = savedResults.reduce((sum, r) => sum + r.timeMs, 0);
  } else {
    totalTimeMs.value = Date.now() - state.startTime;
    playSound('playGameComplete');
    trackEvent('game_complete', {
      letter_score: runningLetterScore.value,
      total_time_ms: totalTimeMs.value,
      timer_disabled: timerDisabled.value,
    });
  }

  if (!savedResults && dateStr.value) {
    try {
      localStorage.setItem('reword-' + dateStr.value, JSON.stringify({
        results: state.completedRounds,
        totalTimeMs: totalTimeMs.value,
        timerDisabled: timerDisabled.value,
      }));
    } catch (e) {}

    try {
      const rawStats = localStorage.getItem('reword-stats') || localStorage.getItem('anagram-trainer-stats');
      const existingStats = rawStats ? JSON.parse(rawStats) : null;
      const updatedStats = updateStreakStats(existingStats, dateStr.value);
      localStorage.setItem('reword-stats', JSON.stringify(updatedStats));
    } catch (e) {}

    try {
      const rawLifetime = localStorage.getItem('reword-lifetime-stats');
      const existingLifetime = rawLifetime ? JSON.parse(rawLifetime) : null;
      const updatedLifetime = updateLifetimeStats(existingLifetime, state.completedRounds, totalTimeMs.value, timerDisabled.value);
      localStorage.setItem('reword-lifetime-stats', JSON.stringify(updatedLifetime));
    } catch (e) {}
  }

  // Load streak stats for display
  try {
    const rawStats = localStorage.getItem('reword-stats') || localStorage.getItem('anagram-trainer-stats');
    if (rawStats) streakStats.value = JSON.parse(rawStats);
  } catch (e) {}

  // Load lifetime stats for display
  try {
    const rawLifetime = localStorage.getItem('reword-lifetime-stats');
    if (rawLifetime) lifetimeStats.value = JSON.parse(rawLifetime);
  } catch (e) {}
}

function handleKeyInput(key) {
  ensureAudio();
  if (state.transitioning || state.currentRound >= 10) return;
  if (!state.startTime) startTimer();
  if (key === 'Enter') {
    handleSubmit();
    return;
  }
  const round = puzzle.value[state.currentRound];
  const maxLen = round.root.length + round.offeredLetters.length;
  const prevLen = state.inputLetters.length;
  state.inputLetters = processKeyPress(state.inputLetters, key, maxLen);
  if (state.inputLetters.length !== prevLen) playSound('playKeyClick');
  message.value = '';
  messageType.value = '';
}

const shareButtonText = ref('Share Results');

async function handleShare() {
  const results = state.completedRounds;
  trackEvent('share_results');
  const shareText = generateShareText(results, dateStr.value, totalTimeMs.value, timerDisabled.value);
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    shareButtonText.value = 'Copied!';
  } catch (e) {
    shareButtonText.value = 'Could not copy';
  }
  setTimeout(() => { shareButtonText.value = 'Share Results'; }, 2000);
}

let keydownHandler = null;

onMounted(async () => {
  // Physical keyboard support
  keydownHandler = (e) => {
    if (gameComplete.value || loading.value || showHowToPlay.value) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleKeyInput('Backspace');
    } else if (e.key.length === 1 && /^[a-z]$/i.test(e.key)) {
      handleKeyInput(e.key.toLowerCase());
    }
  };
  document.addEventListener('keydown', keydownHandler);

  // Check first visit
  try {
    if (!localStorage.getItem('reword-seen-how-to-play')) {
      showHowToPlay.value = true;
      localStorage.setItem('reword-seen-how-to-play', '1');
    }
  } catch (e) {}

  // Load mute state
  try {
    const savedMuteState = localStorage.getItem('reword-sound-muted') || localStorage.getItem('anagram-trainer-sound-muted');
    if (savedMuteState === '1') muted.value = true;
  } catch (e) {}

  // Load timer disabled state
  try {
    if (localStorage.getItem('reword-timer-disabled') === '1') timerDisabled.value = true;
  } catch (e) {}

  // Load puzzle
  const response = await fetch(new URL('../../data/puzzles.json', import.meta.url));
  const puzzleData = await response.json();

  const today = new Date();
  dateStr.value = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

  puzzle.value = selectDailyPuzzle(puzzleData, dateStr.value);
  loading.value = false;

  // Check for saved game
  try {
    const saved = localStorage.getItem('reword-' + dateStr.value) || localStorage.getItem('anagram-trainer-' + dateStr.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.completedRounds = parsed.results.map((r, i) => ({
        ...r,
        offeredLetters: r.offeredLetters || (puzzle.value[i] && puzzle.value[i].offeredLetters) || [],
      }));
      state.currentRound = 10;
      timerDisabled.value = !!parsed.timerDisabled;
      showScore(parsed.results);
      return;
    }
  } catch (e) {}
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
});
</script>
