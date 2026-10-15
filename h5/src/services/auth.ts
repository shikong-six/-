import request from './request';
import {useUserStore} from '@/store/user';

interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    username: string;
  };
  message?: string;
}

export async function register(username: string, password: string, remember = true): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/register', {username, password});
  if (response.data.success) {
    useUserStore().saveAuth(response.data.data.token, response.data.data.username, remember);
    return;
  }
  throw new Error(response.data.message || '注册失败');
}

export async function login(username: string, password: string, remember = true): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/login', {username, password});
  if (response.data.success) {
    useUserStore().saveAuth(response.data.data.token, response.data.data.username, remember);
    return;
  }
  throw new Error(response.data.message || '登录失败');
}

export function logout(): void {
  useUserStore().logout();
}

export function isLoggedIn(): boolean {
  return useUserStore().isLoggedIn;
}

export function getUsername(): string {
  return useUserStore().username;
}
