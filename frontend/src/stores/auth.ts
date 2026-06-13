import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<any>(null);

  async function login(data: { username: string; password: string }) {
    const res: any = await authApi.login(data);
    token.value = res.accessToken;
    user.value = res.user;
    localStorage.setItem('token', res.accessToken);
  }

  async function phoneLogin(data: { phone: string; code: string }) {
    const res: any = await authApi.phoneLogin(data);
    token.value = res.accessToken;
    user.value = res.user;
    localStorage.setItem('token', res.accessToken);
  }

  async function fetchUserProfile() {
    if (!token.value) return;
    try {
      const res: any = await authApi.getProfile();
      user.value = res.data || res;
    } catch {
      // Token invalid/expired, clear it
      token.value = '';
      user.value = null;
      localStorage.removeItem('token');
    }
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, login, phoneLogin, fetchUserProfile, logout };
});
