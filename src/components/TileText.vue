<template>
  <div class="tile-text">
    <div v-for="(word, wi) in words" :key="wi" class="tile-text-row">
      <ScrabbleTile
        v-for="(ch, ci) in word.split('')"
        :key="ci"
        :letter="ch"
        :tile-class="tileClass"
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
});

const words = computed(() => props.text ? props.text.split(' ') : []);
</script>
