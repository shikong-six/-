<!-- H5 根组件：主题令牌 + 路由过渡 + ChatView keep-alive -->
<template>
  <router-view v-slot="{ Component, route }">
    <transition name="page-fade" mode="out-in">
      <keep-alive include="ChatView">
        <component :is="Component" :key="pageKey(route)" />
      </keep-alive>
    </transition>
  </router-view>
</template>

<script setup lang="ts">
function pageKey(route: {name?: string | null | symbol; path: string}) {
  // 新对话 / 续聊共用缓存实例，避免生成中切会话丢现场
  if (route.name === 'Ask' || route.name === 'ChatSession') return 'chat';
  return route.path;
}
</script>

<style>
:root {
  --fz-primary: #0f9d8f;
  --fz-primary-hover: #0c8a7e;
  --fz-primary-soft: #e6f7f5;
  --fz-dark: #0f2d40;
  --fz-bg: #f3f5f7;
  --fz-card: #ffffff;
  --fz-text: #323233;
  --fz-muted: #969799;
  --fz-border: #ebedf0;
  --fz-error: #ee0a24;
  --fz-radius: 12px;
  /* 覆盖 Vant 主色，与 Web 端青绿统一 */
  --van-primary-color: #0f9d8f;
  --van-primary-color-light: #e6f7f5;
}

html,
body,
#app {
  margin: 0;
  min-height: 100%;
  background: var(--fz-bg);
  color: var(--fz-text);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
