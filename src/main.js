import { createApp } from 'vue';
import App from './components/App.vue';
import { initGA } from './analytics.js';

initGA('G-B61TJ0H3MM');

createApp(App).mount('#app');
