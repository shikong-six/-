// 用户登录态：记住我 → localStorage；否则仅 sessionStorage
import {defineStore} from 'pinia';
import {computed, ref} from 'vue';

const TOKEN_KEY = 'fazhitong_token';
const USERNAME_KEY = 'fazhitong_username';

function readStored(key: string): string {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
}

export const useUserStore = defineStore('user', () => {
  const token = ref(readStored(TOKEN_KEY));
  const username = ref(readStored(USERNAME_KEY));
  const isLoggedIn = computed(() => !!token.value);

  function saveAuth(newToken: string, newUsername: string, remember = true): void {
    token.value = newToken;
    username.value = newUsername;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, newToken);
    storage.setItem(USERNAME_KEY, newUsername);
  }

  function logout(): void {
    token.value = '';
    username.value = '';
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
  }

  return {token, username, isLoggedIn, saveAuth, logout};
});
