// 引入 Vue Router 的两个函数
// createRouter 用于创建路由实例
// createWebHistory 用于使用 HTML5 的 history 模式
import {createRouter, createWebHistory} from 'vue-router';
// 引入登录状态判断，路由守卫用
import {isLoggedIn} from '@/services/auth';

// 定义路由表
// 结构：/login 是独立页面（不带侧边栏）
//      / 是布局父路由（AppLayout），业务页面都是它的子路由
//      /knowledge 下再嵌套二级子路由（列表/检索），演示多级嵌套路由
//      /chat/:sessionId 是动态路由，加载指定会话继续对话
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
        // 首页
        path: '',
        name: 'Home',
        component: () => import('@/views/HomeView.vue')
      },
      {
        // 智能问答（新对话，无会话 ID）
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/ChatView.vue')
      },
      {
        // 智能问答（带会话 ID）：加载该会话的历史消息，继续多轮对话
        // :sessionId 是动态段，组件里用 useRoute().params.sessionId 取值
        path: 'chat/:sessionId',
        name: 'ChatSession',
        component: () => import('@/views/ChatView.vue')
      },
      {
        // 知识库：一级父路由，本身不渲染页面，访问 /knowledge 时重定向到列表页
        path: 'knowledge',
        // redirect 让 /knowledge 自动跳到 /knowledge/list（默认落在文档列表）
        redirect: '/knowledge/list',
        children: [
          {
            // 文档列表（含上传）：/knowledge/list
            path: 'list',
            name: 'KnowledgeList',
            component: () => import('@/views/KnowledgeListView.vue')
          },
          {
            // 检索测试：/knowledge/search
            path: 'search',
            name: 'KnowledgeSearch',
            component: () => import('@/views/KnowledgeSearchView.vue')
          }
        ]
      },
      {
        // 会话历史管理（改名/删除/跳转继续对话）
        path: 'history',
        name: 'History',
        component: () => import('@/views/SessionsView.vue')
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
