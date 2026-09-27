<!-- 后台管理布局：顶部栏（左 logo + 右操作区）+ 可折叠左侧导航 + 主内容区 -->
<template>
  <el-container class="layout">
    <!-- ===== 顶部栏 ===== -->
    <el-header class="topbar" height="56px">
      <!-- 左侧：Logo 位 -->
      <div class="logo-area">
        <span class="logo-icon">⚖️</span>
        <span class="logo-text">法制通</span>
      </div>

      <!-- 右侧：操作区 -->
      <div class="topbar-actions">
        <!-- 折叠/展开左侧导航 -->
        <el-tooltip :content="collapsed ? '展开导航' : '收起导航'" placement="bottom">
          <el-icon class="action-icon" @click="collapsed = !collapsed">
            <Expand v-if="collapsed" />
            <Fold v-else />
          </el-icon>
        </el-tooltip>

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
              <el-dropdown-item command="history">问答历史</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <!-- ===== 主体：左侧导航 + 内容区 ===== -->
    <el-container class="body">
      <el-aside :width="collapsed ? '64px' : '200px'" class="aside">
        <el-menu
          :default-active="activeMenu"
          :collapse="collapsed"
          router
          class="side-menu"
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <span>首页</span>
          </el-menu-item>
          <!-- 案例：展开六大分类（嵌套路由 /cases/:category） -->
          <el-sub-menu index="/cases">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>案例</span>
            </template>
            <el-menu-item index="/cases/marriage"><span>婚姻家庭</span></el-menu-item>
            <el-menu-item index="/cases/traffic"><span>交通事故</span></el-menu-item>
            <el-menu-item index="/cases/contract"><span>合同纠纷</span></el-menu-item>
            <el-menu-item index="/cases/labor"><span>劳动纠纷</span></el-menu-item>
            <el-menu-item index="/cases/property"><span>房产物业</span></el-menu-item>
            <el-menu-item index="/cases/criminal"><span>刑事辩护</span></el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/knowledge/list">
            <el-icon><Collection /></el-icon>
            <span>法律条文</span>
          </el-menu-item>
          <el-menu-item index="/chat">
            <el-icon><ChatDotRound /></el-icon>
            <span>AI咨询</span>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <span>个人中心</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {
  HomeFilled, Document, Collection, ChatDotRound, User,
  Fold, Expand, FullScreen, Setting, ArrowDown
} from '@element-plus/icons-vue';
import {useUserStore} from '@/store/user';
import {logout} from '@/services/auth';

const route = useRoute();
const router = useRouter();
// 用户登录态（Pinia store：token/username/isLoggedIn 单一数据源）
const userStore = useUserStore();
// 头像显示用户名首字符
const initial = computed(() => (userStore.username ? userStore.username[0].toUpperCase() : '用'));

// ===== 左侧导航折叠 =====
const collapsed = ref(false);

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
  } else if (command === 'history') {
    router.push('/history');
  } else if (command === 'logout') {
    logout();
    // 守卫会把未登录用户送回登录页
    router.replace('/login');
  }
}

// 当前要高亮的菜单项：/chat/123 高亮 AI咨询（/chat），其余按路径前缀处理
const activeMenu = computed(() => {
  if (route.path.startsWith('/chat')) return '/chat';
  if (route.path.startsWith('/knowledge')) return '/knowledge/list';
  return route.path;
});
</script>

<style scoped>
/* 整体占满视口，上下两栏（顶部栏 + 主体） */
.layout {
  height: 100vh;
}

/* ===== 顶部栏 ===== */
.topbar {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 20px;
}

/* Logo 区：留位，可换图片 */
.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
.logo-icon {
  font-size: 22px;
}
.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  letter-spacing: 1px;
}

/* 右侧操作区 */
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.action-icon {
  font-size: 18px;
  color: #606266;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}
.action-icon:hover {
  background: #f0f2f5;
  color: #409eff;
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
  background: #f0f2f5;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a6cf7, #7a9bff);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.username {
  font-size: 14px;
  color: #303133;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  font-size: 12px;
  color: #909399;
}

/* ===== 主体区 ===== */
.body {
  height: calc(100vh - 56px);
}

/* 左侧导航：宽度随折叠状态变化（ aside 动画过渡） */
.aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
  transition: width 0.2s;
  overflow: hidden;
}
.side-menu {
  border-right: none;
}
/* 未折叠时不折行隐藏文字 */
.side-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 主内容区 */
.main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>
