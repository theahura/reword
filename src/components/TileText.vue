<template>
  <div class="tile-text">
    <div v-for="(word, wi) in words" :key="wi" class="tile-text-row">
      <ScrabbleTile
        v-for="(ch, ci) in word.split('')"
        :key="ci"
        :letter="ch"
        :tile-class="tileClass + (animate ? ' tile-animate' : '')"
        :style="animate ? { animationDelay: globalIndex(wi, ci) * 0.07 + 's' } : undefined"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ScrabbleTile from './ScrabbleTile.vue';

const props = defineProps({
  text: { type: String, default: '' },
  tileClass: { type: String, default: '' },
  animate: { type: Boolean, default: false },
});

const words = computed(() => props.text ? props.text.split(' ') : []);

function globalIndex(wordIdx, charIdx) {
  let idx = charIdx;
  for (let i = 0; i < wordIdx; i++) {
    idx += words.value[i].length;
  }
  return idx;
}
</script>
