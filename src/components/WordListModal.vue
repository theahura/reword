<template>
  <div class="word-list-overlay" @click.self="$emit('close')">
    <div class="word-list-modal">
      <button data-testid="close-word-list" class="close-btn" @click="$emit('close')">&times;</button>
      <h2>Round {{ roundIndex + 1 }}</h2>
      <div class="modal-body">
        <div class="modal-section">
          <div class="section-label">Root Word</div>
          <div data-testid="modal-root-tiles" class="modal-tile-rack">
            <ScrabbleTile
              v-for="(letter, i) in round.root.split('')"
              :key="'root-' + i"
              :letter="letter"
            />
          </div>
        </div>
        <div class="modal-section">
          <div class="section-label">Offered Letters</div>
          <div data-testid="modal-offered-tiles" class="modal-tile-rack">
            <ScrabbleTile
              v-for="(letter, i) in round.offeredLetters"
              :key="'offered-' + i"
              :letter="letter"
              tile-class="offered"
            />
          </div>
        </div>
        <div class="modal-section">
          <div class="section-label">Possible Words ({{ round.possibleAnswers.length }})</div>
          <div class="word-list-grid">
            <div
              v-for="entry in displayedAnswers"
              :key="entry.word"
              data-testid="word-row"
              class="modal-tile-rack word-row"
              :class="{ 'player-answer': entry.word === round.answer }"
            >
              <ScrabbleTile
                v-for="(tile, ti) in getTileClasses(entry.word)"
                :key="ti"
                :letter="tile.letter"
                :tile-class="tile.source === 'offered' ? 'offered' : ''"
              />
              <span v-if="answerCounts" class="word-popularity">{{ entry.percent }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ScrabbleTile from './ScrabbleTile.vue';
import { matchTypedToTiles } from '../game.js';

const props = defineProps({
  round: { type: Object, required: true },
  roundIndex: { type: Number, required: true },
  answerCounts: { type: Object, default: null },
});
defineEmits(['close']);

function getTileClasses(word) {
  const { matched } = matchTypedToTiles(
    word.split(''),
    props.round.root.split(''),
    props.round.offeredLetters
  );
  return matched;
}

const displayedAnswers = computed(() => {
  const words = props.round.possibleAnswers;
  if (!props.answerCounts) {
    return words.map(word => ({ word, percent: 0 }));
  }
  const total = Object.values(props.answerCounts).reduce((sum, n) => sum + n, 0);
  const entries = words.map(word => {
    const count = props.answerCounts[word] || 0;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return { word, percent, count };
  });
  entries.sort((a, b) => b.count - a.count);
  return entries;
});
</script>
