// 用户认证 API 封装：注册、登录、退出、token 存取
// 登录态本身由 Pinia 的 user store 统一管理（src/store/user.ts），这里只负责调接口和写入 store
import request from './request';
import {useUserStore} from '../store/user';

// 登录/注册成功的返回数据
interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    username: string;
  };
  message?: string;
}

// 注册（注册成功后端直接返回 token，即注册即登录）
export async function register(username: string, password: string): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/register', {username, password});
  if (response.data.success) {
    // 凭证写入 user store（store 内部同时落 localStorage 持久化）
    useUserStore().saveAuth(response.data.data.token, response.data.data.username);
    return;
  }
  throw new Error(response.data.message || '注册失败');
}

// 登录
export async function login(username: string, password: string): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/login', {username, password});
  if (response.data.success) {
    useUserStore().saveAuth(response.data.data.token, response.data.data.username);
    return;
  }
  throw new Error(response.data.message || '登录失败');
}

// ===== 以下三个是 user store 的便捷代理：老调用方（页面/路由守卫）无需改动 =====

// 退出登录：清掉本地凭证即可（JWT 无状态，服务端不需要通知）
export function logout(): void {
  useUserStore().logout();
}

// 是否已登录
export function isLoggedIn(): boolean {
  return useUserStore().isLoggedIn;
}

// 当前登录用户名（用于页面顶部显示）
export function getUsername(): string {
  return useUserStore().username;
}
