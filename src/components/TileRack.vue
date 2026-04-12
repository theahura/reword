<template>
  <div class="tile-rack">
    <ScrabbleTile
      v-for="(letter, i) in letters"
      :key="i"
      :letter="letter"
      :tile-class="getTileClass(i)"
    />
  </div>
</template>

<script setup>
import ScrabbleTile from './ScrabbleTile.vue';

const props = defineProps({
  letters: { type: Array, default: () => [] },
  tileClass: { type: String, default: '' },
  usedIndices: { type: Array, default: () => [] },
});

function getTileClass(i) {
  const classes = [];
  if (props.tileClass) classes.push(props.tileClass);
  if (props.usedIndices.includes(i)) classes.push('used');
  return classes.join(' ');
}
</script>
