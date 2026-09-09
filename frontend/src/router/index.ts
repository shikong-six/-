// 引入 Vue Router 的两个函数
// createRouter 用于创建路由实例
// createWebHistory 用于使用 HTML5 的 history 模式
import {createRouter, createWebHistory} from 'vue-router';
// 引入登录状态判断，路由守卫用
import {isLoggedIn} from '@/services/auth';

// 定义路由表
// 结构：/login 是独立页面（不带侧边栏），其余页面都是 AppLayout 的子路由（带布局）
const routes = [
  {
    // 登录页：独立页面
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    // 布局父路由：所有业务页面共用侧边栏
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/HomeView.vue')
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/ChatView.vue')
      },
      {
        path: 'knowledge',
        name: 'Knowledge',
        component: () => import('@/views/KnowledgeView.vue')
      },
      {
        path: 'history',
        name: 'History',
        component: () => import('@/views/HistoryView.vue')
      }
    ]
  }
];

// 创建路由实例
const router = createRouter({
  // 使用 history 模式，URL 不要 #
  history: createWebHistory(),
  routes
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

// 导出路由实例，供 main.ts 使用
export default router;
