// 用户登录态 store：全局唯一数据源
// 登录页写入（saveAuth），路由守卫/请求拦截器/各页面读取（isLoggedIn/username/token）
// 默认持久化到 localStorage；未勾选「记住我」时只写 sessionStorage（关标签即失效）
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

  // remember=true → localStorage；false → 仅 sessionStorage
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
