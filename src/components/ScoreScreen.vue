<template>
  <div id="score-screen">
    <h2>Game Complete!</h2>
    <div class="stats-row">
      <div class="stat">Words Solved<br><span class="stat-value">{{ solved }} / 10</span></div>
      <div class="stat">Total Letters<br><span class="stat-value">{{ totalLetters }}</span></div>
      <div v-if="!timerDisabled" class="stat">Total Time<br><span class="stat-value">{{ formattedTime }}</span></div>
    </div>
    <div v-if="streakStats" class="stats-row streak-stats">
      <div class="stat">Played<br><span class="stat-value">{{ streakStats.gamesPlayed }}</span></div>
      <div class="stat">Current Streak<br><span class="stat-value">{{ streakStats.currentStreak }}</span></div>
      <div class="stat">Max Streak<br><span class="stat-value">{{ streakStats.maxStreak }}</span></div>
    </div>
    <div v-if="lifetimeStats" class="stats-row lifetime-stats">
      <h3 class="stats-section-title">Lifetime Stats</h3>
      <div class="stat">Total Letters<br><span class="stat-value">{{ lifetimeStats.totalLetters }}</span></div>
      <div class="stat">Total Words<br><span class="stat-value">{{ lifetimeStats.totalWords }}</span></div>
      <div class="stat">Fastest Time<br><span class="stat-value">{{ lifetimeStats.fastestTimeMs != null ? formatTime(lifetimeStats.fastestTimeMs) : 'N/A' }}</span></div>
      <div class="stat">Avg Time<br><span class="stat-value">{{ lifetimeStats.perfectGamesPlayed > 0 ? formatTime(lifetimeStats.perfectGamesTotalTimeMs / lifetimeStats.perfectGamesPlayed) : 'N/A' }}</span></div>
      <div class="stat">Best Score<br><span class="stat-value">{{ lifetimeStats.bestLetterScore }}</span></div>
      <div class="stat">Longest Word<br><span class="stat-value">{{ lifetimeStats.longestWord.toUpperCase() }}</span></div>
    </div>
    <div class="countdown-section">
      <span class="countdown-label">Next puzzle in</span>
      <span class="countdown-timer">{{ countdown }}</span>
    </div>
    <button id="share-btn" @click="$emit('share')">{{ shareButtonText }}</button>
    <div class="rounds-summary">
      <div
        v-for="(r, i) in results"
        :key="i"
        class="round-result"
        :class="[r.answer.length > 0 ? 'solved' : 'skipped', r.hinted && r.answer.length > 0 ? 'hinted' : '']"
      >
        <span class="round-num">{{ i + 1 }}</span>
        <span class="round-root">{{ r.root.toUpperCase() }}</span>
        <span class="round-arrow">&rarr;</span>
        <span class="round-answer">{{ r.answer.length > 0 ? r.answer.toUpperCase() : 'SKIPPED' }}</span>
        <span class="round-spacer"></span>
        <span
          v-if="r.possibleAnswers && r.possibleAnswers.length"
          class="more-answers-link"
          @click="$emit('show-word-list', i)"
        >{{ r.possibleAnswers.length }} {{ r.possibleAnswers.length === 1 ? 'word' : 'words' }} ›</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import confetti from 'canvas-confetti';
import { calculateScore, formatCountdown, getTimeUntilMidnightUTC, isAllSolved } from '../game.js';

const props = defineProps({
  results: { type: Array, required: true },
  dateStr: { type: String, required: true },
  totalTimeMs: { type: Number, required: true },
  shareButtonText: { type: String, default: 'Share Results' },
  streakStats: { type: Object, default: null },
  lifetimeStats: { type: Object, default: null },
  timerDisabled: { type: Boolean, default: false },
  isFreshGame: { type: Boolean, default: false },
});

defineEmits(['share', 'show-word-list']);

const solved = props.results.filter(r => r.answer.length > 0).length;
const score = calculateScore(props.results.filter(r => r.answer.length > 0));
const totalLetters = score.totalLetters;

const mins = Math.floor(props.totalTimeMs / 1000 / 60);
const secs = Math.floor(props.totalTimeMs / 1000) % 60;
const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;

function formatTime(ms) {
  const mins = Math.floor(ms / 1000 / 60);
  const secs = Math.floor(ms / 1000) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const countdown = ref(formatCountdown(getTimeUntilMidnightUTC()));
let countdownInterval = null;

onMounted(() => {
  countdownInterval = setInterval(() => {
    countdown.value = formatCountdown(getTimeUntilMidnightUTC());
  }, 1000);

  if (props.isFreshGame && isAllSolved(props.results)) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
  }
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});
</script>
