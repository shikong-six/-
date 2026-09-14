// 用户认证 API 封装：注册、登录、退出、token 存取
// 与 Web 端共用同一套后端接口和 localStorage 键名，两端登录态互通
import request from './request';

// 登录/注册成功的返回数据
interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    username: string;
  };
  message?: string;
}

// localStorage 里存 token 的键名
const TOKEN_KEY = 'fazhitong_token';
const USERNAME_KEY = 'fazhitong_username';

// 注册（注册成功后端直接返回 token，即注册即登录）
export async function register(username: string, password: string): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/register', {username, password});
  if (response.data.success) {
    // 把凭证存到本地
    saveAuth(response.data.data.token, response.data.data.username);
    return;
  }
  throw new Error(response.data.message || '注册失败');
}

// 登录
export async function login(username: string, password: string): Promise<void> {
  const response = await request.post<AuthResponse>('/auth/login', {username, password});
  if (response.data.success) {
    saveAuth(response.data.data.token, response.data.data.username);
    return;
  }
  throw new Error(response.data.message || '登录失败');
}

// 退出登录：清掉本地凭证即可（JWT 无状态，服务端不需要通知）
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

// 是否已登录（本地有没有 token）
export function isLoggedIn(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

// 当前登录用户名（用于页面显示）
export function getUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || '';
}

// 保存登录凭证
function saveAuth(token: string, username: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}
