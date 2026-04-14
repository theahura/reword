<template>
  <div :class="['game-board', { 'fly-up': flyUp, 'tiles-fade-in': tilesFadingIn }]">
    <div class="game-info">
      <span id="round-indicator">Round {{ roundNumber }} of 10</span>
      <span id="timer"><slot name="timer"></slot></span>
    </div>

    <div class="section-label">Root Word</div>
    <TileRack :letters="round.root.split('')" :used-indices="rootUsedIndices" />

    <div class="section-label">Add Letters</div>
    <TileRack :letters="round.offeredLetters" tile-class="offered" :used-indices="offeredUsedIndices" :highlighted-index="hintIndex" />

    <div class="instructions">Type a new word using all root letters + one or more offered letters</div>

    <div id="input-area">
      <ScrabbleTile
        v-for="(letter, i) in displayedInput"
        :key="i"
        :letter="letter"
        :tile-class="inputTileClass(i)"
        :style="{ '--tile-index': i }"
      />
    </div>

    <div id="message" :class="messageType">
      <Transition name="message-fade">
        <span v-if="message" :key="message">{{ message }}</span>
      </Transition>
    </div>

    <div class="submit-wrapper">
      <button id="submit-btn" @click="$emit('submit')">Submit</button>
      <button v-if="hintAvailable && hintIndex == null" id="hint-btn" @click="$emit('hint')">💡</button>
    </div>
    <button id="skip-btn" @click="$emit('skip')">Skip</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ScrabbleTile from './ScrabbleTile.vue';
import TileRack from './TileRack.vue';
import { matchTypedToTiles } from '../game.js';

const props = defineProps({
  round: { type: Object, required: true },
  roundNumber: { type: Number, required: true },
  inputLetters: { type: Array, default: () => [] },
  message: { type: String, default: '' },
  messageType: { type: String, default: '' },
  flyUp: { type: Boolean, default: false },
  tilesFadingIn: { type: Boolean, default: false },
  hintIndex: { type: Number, default: null },
  hintAvailable: { type: Boolean, default: false },
});

defineEmits(['submit', 'skip', 'hint']);

const minLen = computed(() => props.round.root.length + 1);
const displayLen = computed(() => Math.max(minLen.value, props.inputLetters.length));

const tileMatch = computed(() =>
  matchTypedToTiles(
    props.inputLetters,
    props.round.root.split(''),
    props.round.offeredLetters
  )
);

const rootUsedIndices = computed(() => {
  const pool = tileMatch.value.pool;
  const indices = [];
  for (let i = 0; i < props.round.root.length; i++) {
    if (pool[i] && pool[i].used) indices.push(i);
  }
  return indices;
});

const offeredUsedIndices = computed(() => {
  const pool = tileMatch.value.pool;
  const rootLen = props.round.root.length;
  const indices = [];
  for (let i = 0; i < props.round.offeredLetters.length; i++) {
    if (pool[rootLen + i] && pool[rootLen + i].used) indices.push(i);
  }
  return indices;
});

const displayedInput = computed(() => {
  const result = [];
  for (let i = 0; i < displayLen.value; i++) {
    result.push(i < props.inputLetters.length ? props.inputLetters[i] : '');
  }
  return result;
});

function inputTileClass(i) {
  if (i >= props.inputLetters.length) return 'empty';
  const m = tileMatch.value.matched[i];
  return m && m.source === 'invalid' ? 'invalid' : '';
}
</script>
