<!-- 门户布局：深色顶部导航栏（左 logo + 横向菜单 + 右操作区）+ 全宽主内容区 -->
<template>
  <div class="portal-layout">
    <!-- ===== 顶部导航栏 ===== -->
    <header class="topbar">
      <div class="topbar-inner">
        <!-- 左侧：Logo -->
        <div class="logo-area" @click="$router.push('/')">
          <span class="logo-icon">⚖️</span>
          <div class="logo-text">
            <span class="logo-name">法制通</span>
            <span class="logo-sub">LEGAL KNOWLEDGE PLATFORM</span>
          </div>
        </div>

        <!-- 中部：横向菜单，各项样式一致 -->
        <nav class="nav-menu">
          <div
            v-for="item in navItems"
            :key="item.path"
            :class="['nav-pill', {active: isActive(item.path)}]"
            @click="goNav(item)"
          >
            {{ item.title }}
          </div>
        </nav>

        <!-- 右侧：操作区 -->
        <div class="topbar-actions">
          <!-- 全屏切换 -->
          <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
            <el-icon class="action-icon" @click="toggleFullscreen">
              <FullScreen />
            </el-icon>
          </el-tooltip>

          <!-- 设置 -->
          <el-tooltip content="设置" placement="bottom">
            <el-icon class="action-icon" @click="onSettings">
              <Setting />
            </el-icon>
          </el-tooltip>

          <!-- 用户菜单 -->
          <el-dropdown trigger="click" @command="onUserCommand">
            <span class="user-chip">
              <span class="avatar">{{ initial }}</span>
              <span class="username">{{ userStore.username }}</span>
              <el-icon class="caret"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="settings">设置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <!-- ===== 主内容区：页面切换淡入上移；AI 咨询 keep-alive 保住对话现场 ===== -->
    <main class="main">
      <router-view v-slot="{ Component, route: viewRoute }">
        <transition name="page-fade" mode="out-in">
          <keep-alive include="ChatView">
            <component :is="Component" :key="pageKey(viewRoute)" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {FullScreen, Setting, ArrowDown} from '@element-plus/icons-vue';
import {useUserStore} from '@/store/user';
import {logout} from '@/services/auth';

const route = useRoute();
const router = useRouter();
// 用户登录态（Pinia store：token/username/isLoggedIn 单一数据源）
const userStore = useUserStore();
// 头像显示用户名首字符
const initial = computed(() => (userStore.username ? userStore.username[0].toUpperCase() : '用'));

// 过渡用 key：AI 咨询 /chat 与 /chat/:id 共用同一实例，避免切会话打断流式
function pageKey(viewRoute: {name?: string | symbol | symbol; path: string}) {
  if (viewRoute.name === 'Chat' || viewRoute.name === 'ChatSession') return 'chat';
  if (viewRoute.name === 'Cases' || viewRoute.name === 'CaseDetail') return viewRoute.path;
  return viewRoute.path;
}

// ===== 顶部横向菜单项（原侧边导航项平移到顶部）=====
const navItems = [
  {path: '/', title: '首页'},
  {path: '/cases', title: '案例'},
  {path: '/laws', title: '法律条文'},
  {path: '/chat', title: 'AI咨询'},
  {path: '/profile', title: '个人中心'},
];

// 当前要高亮的菜单项：/chat/123 高亮 AI咨询，其余按路径前缀处理
function isActive(path: string) {
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(path + '/');
}

// 菜单跳转：AI咨询恢复最近的对话现场（新提问/历史会话），其余直达
function goNav(item: {path: string; title: string}) {
  // AI咨询：ChatView 实时把最近对话路径记在 sessionStorage，没有则进新对话
  const target = item.path === '/chat'
    ? (sessionStorage.getItem('fazhitong_last_chat') || '/chat')
    : item.path;
  // 已在目标页就不重复跳转（避免路由冗余警告）
  if (route.path !== target) {
    router.push(target);
  }
}

// ===== 全屏切换 =====
const isFullscreen = ref(false);
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
// 监听全屏状态变化（比如按 ESC 退出），同步按钮提示
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

// 设置：尚未实现，先给提示
function onSettings() {
  ElMessage.info('设置功能开发中');
}

// ===== 用户菜单命令 =====
function onUserCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile');
  } else if (command === 'settings') {
    onSettings();
  } else if (command === 'logout') {
    sessionStorage.removeItem('fazhitong_last_chat');
    logout();
    router.replace('/login');
  }
}
</script>

<style scoped>
/* 整体：上下两栏（顶部导航 + 内容），浅灰背景 */
.portal-layout {
  min-height: 100vh;
  background: #f3f5f7;
}

/* ===== 顶部导航栏 ===== */
.topbar {
  background: linear-gradient(90deg, #0f2d40 0%, #16324a 100%);
  box-shadow: 0 2px 8px rgba(15, 45, 64, 0.25);
  position: sticky;
  top: 0;
  z-index: 100;
}
.topbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 20px;
}

/* Logo 区 */
.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.logo-icon {
  font-size: 26px;
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.logo-name {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
}
.logo-sub {
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
  letter-spacing: 1.5px;
  transform: scale(0.92);
  transform-origin: left;
}

/* 横向菜单：药丸式 */
.nav-menu {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-pill {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  text-decoration: none;
  padding: 7px 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.nav-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
/* 选中态与未选中相同，不单独铺底 */
.nav-pill.active {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
}

/* 右侧操作区 */
.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.action-icon {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}
.action-icon:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

/* 用户芯片 */
.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  outline: none;
}
.user-chip:hover {
  background: rgba(255, 255, 255, 0.12);
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6, #0f9d8f);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.username {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

/* ===== 主内容区 ===== */
.main {
  padding: 20px;
}

/* 页面切换过渡：旧页淡出 → 新页淡入上移 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
