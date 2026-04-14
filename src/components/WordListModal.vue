<template>
  <div class="word-list-overlay" @click.self="$emit('close')">
    <div class="word-list-modal">
      <button data-testid="close-word-list" class="close-btn" @click="$emit('close')">&times;</button>
      <h2>Round {{ roundIndex + 1 }}</h2>
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
            v-for="(word, wi) in round.possibleAnswers"
            :key="wi"
            data-testid="word-row"
            class="modal-tile-rack word-row"
          >
            <ScrabbleTile
              v-for="(tile, ti) in getTileClasses(word)"
              :key="ti"
              :letter="tile.letter"
              :tile-class="tile.source === 'offered' ? 'offered' : ''"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ScrabbleTile from './ScrabbleTile.vue';
import { matchTypedToTiles } from '../game.js';

const props = defineProps({
  round: { type: Object, required: true },
  roundIndex: { type: Number, required: true },
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
</script>
