// 统一 Axios 实例：所有业务请求都走这里
// 职责：自动携带 Token、401 时清理凭证并跳回登录页
import axios from 'axios';

// 创建实例，baseURL 统一前缀 /api，业务代码里写 /chat 即可
// 弱网兜底：20 秒无响应判超时（移动端网络不稳定，避免无限转圈）
const request = axios.create({baseURL: '/api', timeout: 20000});

// ===== 请求拦截器：发请求前自动带上 token =====
request.interceptors.request.use((config) => {
  // 从本地存储取 token（登录/注册成功后存进去的）
  const token = localStorage.getItem('fazhitong_token');
  if (token) {
    // 后端要求 Authorization: Bearer <token> 格式
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
      // 清掉失效凭证
      localStorage.removeItem('fazhitong_token');
      localStorage.removeItem('fazhitong_username');
      // 跳回登录页（已经在登录页就不跳，避免死循环）
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    // 继续把错误抛给调用方，页面里还能弹具体的错误提示
    return Promise.reject(error);
  }
);

export default request;
