<template>
  <div :class="['tile', tileClass]">
    <span v-if="letter" class="letter">{{ letter.toUpperCase() }}</span>
  </div>
</template>

<script setup>
defineProps({
  letter: { type: String, default: '' },
  tileClass: { type: String, default: '' },
});
</script>
