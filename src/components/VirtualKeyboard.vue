<template>
  <div id="virtual-keyboard">
    <div v-for="(row, ri) in keyRows" :key="ri" class="keyboard-row">
      <button
        v-for="key in row"
        :key="key"
        class="keyboard-key"
        :class="{ 'key-wide': key === 'Enter' || key === 'Backspace' }"
        :data-key="key"
        type="button"
        @click="$emit('key-press', key === 'Enter' || key === 'Backspace' ? key : key.toLowerCase())"
      >
        {{ displayKey(key) }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineEmits(['key-press']);

const keyRows = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['Enter','z','x','c','v','b','n','m','Backspace'],
];

function displayKey(key) {
  if (key === 'Backspace') return '\u232B';
  if (key === 'Enter') return '\u23CE';
  return key.toUpperCase();
}
</script>
