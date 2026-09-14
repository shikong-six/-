// 路由配置：hash 模式（兼容微信内置浏览器，history 模式在部分 WebView 有坑）
// 全局守卫：未登录只能访问登录页
import {createRouter, createWebHashHistory} from 'vue-router';
import {isLoggedIn} from '@/services/auth';

const routes = [
  {
    // 登录/注册页
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    // 首页：场景化入口
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    // 智能问答：聊天式对话页（新对话）
    path: '/ask',
    name: 'Ask',
    component: () => import('@/views/ChatView.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// ===== 全局路由守卫：未登录只能访问登录页 =====
router.beforeEach((to) => {
  // 已登录还想去登录页，直接送回首页
  if (to.path === '/login' && isLoggedIn()) {
    return '/';
  }
  // 未登录访问任何页面，都去登录页
  if (to.path !== '/login' && !isLoggedIn()) {
    return '/login';
  }
  // 其余情况放行
  return true;
});

export default router;
