<template>
  <div id="score-screen">
    <h2><TileText :text="heading" animate /></h2>
    <div class="stats-grid" :class="{ 'two-col': timerDisabled }">
      <div class="stat">Words Solved<br><span class="stat-value">{{ solved }} / 10</span></div>
      <div class="stat">Total Letters<br><span class="stat-value">{{ totalLetters }}</span></div>
      <div v-if="!timerDisabled" class="stat">Total Time<br><span class="stat-value">{{ formattedTime }}</span></div>
      <div></div>
      <div class="countdown-section">
        <span class="countdown-label">Next puzzle in</span>
        <span class="countdown-timer">{{ countdown }}</span>
      </div>
      <div></div>
    </div>
    <button id="share-btn" @click="$emit('share')"><TileText :text="shareButtonText" /></button>
    <div class="rounds-summary-wrap">
    <table class="rounds-summary">
      <thead class="rounds-header">
        <tr>
          <th class="round-num"></th>
          <th class="round-root">Root</th>
          <th class="round-answer">Result</th>
          <th v-if="solveRates" class="solve-rate-header">Solved by</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in results"
          :key="i"
          class="round-result"
          :class="[r.answer.length > 0 ? 'solved' : 'skipped', r.hinted && r.answer.length > 0 ? 'hinted' : '']"
        >
          <td class="round-num">{{ i + 1 }}</td>
          <td class="round-root">{{ r.root.toUpperCase() }}</td>
          <td class="round-answer">{{ r.answer.length > 0 ? r.answer.toUpperCase() : 'SKIPPED' }}</td>
          <td v-if="solveRates" class="solve-rate">{{ solveRates[i] }}%</td>
          <td
            v-if="r.possibleAnswers && r.possibleAnswers.length"
            class="more-answers-link"
            @click="$emit('show-word-list', i)"
          >{{ r.possibleAnswers.length }} {{ r.possibleAnswers.length === 1 ? 'word' : 'words' }} ›</td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import confetti from 'canvas-confetti';
import { calculateScore, formatCountdown, getTimeUntilMidnightUTC, isAllSolved } from '../game.js';
import TileText from './TileText.vue';

const props = defineProps({
  results: { type: Array, required: true },
  dateStr: { type: String, required: true },
  totalTimeMs: { type: Number, required: true },
  shareButtonText: { type: String, default: 'Share Results' },
  timerDisabled: { type: Boolean, default: false },
  isFreshGame: { type: Boolean, default: false },
  solveRates: { type: Array, default: null },
});

defineEmits(['share', 'show-word-list']);

const solved = props.results.filter(r => r.answer.length > 0).length;
const heading = solved === 10 ? 'Congrats!' : solved >= 7 ? 'Great job!' : solved >= 4 ? 'Not bad!' : 'Better luck next time!';
const score = calculateScore(props.results.filter(r => r.answer.length > 0));
const totalLetters = score.totalLetters;

const mins = Math.floor(props.totalTimeMs / 1000 / 60);
const secs = Math.floor(props.totalTimeMs / 1000) % 60;
const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;

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
