import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAdminStore = defineStore('admin', () => {
  const isOpen = ref(false);
  const activeTab = ref('users');

  function open(tab?: string) {
    isOpen.value = true;
    if (tab) activeTab.value = tab;
  }

  function close() {
    isOpen.value = false;
  }

  function switchTab(tab: string) {
    activeTab.value = tab;
  }

  return { isOpen, activeTab, open, close, switchTab };
});
