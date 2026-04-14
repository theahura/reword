<template>
  <div class="tile-rack">
    <ScrabbleTile
      v-for="(letter, i) in letters"
      :key="i"
      :letter="letter"
      :tile-class="getTileClass(i)"
      @click="emit('tile-click', letter, i)"
    />
  </div>
</template>

<script setup>
import ScrabbleTile from './ScrabbleTile.vue';

const emit = defineEmits(['tile-click']);

const props = defineProps({
  letters: { type: Array, default: () => [] },
  tileClass: { type: String, default: '' },
  usedIndices: { type: Array, default: () => [] },
  highlightedIndex: { type: Number, default: null },
});

function getTileClass(i) {
  const classes = [];
  if (props.tileClass) classes.push(props.tileClass);
  if (props.usedIndices.includes(i)) classes.push('used');
  if (props.highlightedIndex === i) classes.push('highlighted');
  return classes.join(' ');
}
</script>
