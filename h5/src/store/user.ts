// 用户登录态 store：全局唯一数据源
// 登录页写入（saveAuth），路由守卫/请求拦截器/各页面读取（isLoggedIn/username/token）
// 持久化到 localStorage，刷新不丢；内存里的 ref 保证响应式（顶部栏等处自动更新）
import {defineStore} from 'pinia';
import {computed, ref} from 'vue';

// localStorage 键名（与历史版本保持一致，两端共用）
const TOKEN_KEY = 'fazhitong_token';
const USERNAME_KEY = 'fazhitong_username';

export const useUserStore = defineStore('user', () => {
  // 初始值从 localStorage 恢复（刷新页面登录态不丢）
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const username = ref(localStorage.getItem(USERNAME_KEY) || '');
  // 是否已登录：token 的派生状态，computed 自动跟随
  const isLoggedIn = computed(() => !!token.value);

  // 登录/注册成功后写入（同时落 localStorage 持久化）
  function saveAuth(newToken: string, newUsername: string): void {
    token.value = newToken;
    username.value = newUsername;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USERNAME_KEY, newUsername);
  }

  // 退出登录 / 401 时清空（JWT 无状态，服务端不需要通知）
  function logout(): void {
    token.value = '';
    username.value = '';
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }

  return {token, username, isLoggedIn, saveAuth, logout};
});
