// 统一 Axios 实例：所有业务请求都走这里
// 职责：自动携带 Token、401 时清理凭证并跳回登录页
// 登录态统一从 user store 读写（Pinia），不再直接碰 localStorage
import axios from 'axios';
import {useUserStore} from '../store/user';

// 创建实例，baseURL 统一前缀 /api，业务代码里写 /chat 即可
const request = axios.create({baseURL: '/api'});

// ===== 请求拦截器：发请求前自动带上 token =====
request.interceptors.request.use((config) => {
  // 后端要求 Authorization: Bearer <token> 格式
  const {token} = useUserStore();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===== 响应拦截器：统一处理 401 =====
request.interceptors.response.use(
  // 正常响应直接放行
  (response) => response,
  (error) => {
    // 401 = 未登录或 token 过期
    if (error.response?.status === 401) {
      // 清掉失效凭证（store 内部同时清 localStorage）
      useUserStore().logout();
      // 跳回登录页（已经在登录页就不跳，避免死循环）
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    // 继续把错误抛给调用方，页面里还能弹具体的错误提示
    return Promise.reject(error);
  }
);

export default request;
