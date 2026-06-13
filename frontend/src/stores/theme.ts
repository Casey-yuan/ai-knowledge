import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  function applyTheme(t: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    theme.value = t;
  }

  function toggle() {
    applyTheme(theme.value === 'light' ? 'dark' : 'light');
  }

  function init() {
    applyTheme(theme.value);
  }

  return { theme, toggle, init, applyTheme };
});
