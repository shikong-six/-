<!-- 整个应用的根组件：登录 ↔ 业务布局也带过渡 -->
<template>
  <router-view v-slot="{ Component, route }">
    <transition name="root-fade" mode="out-in">
      <component :is="Component" :key="route.path === '/login' ? 'login' : 'app'" />
    </transition>
  </router-view>
</template>

<script setup lang="ts">
</script>

<style>
/* 全局设计令牌（对齐 exchange：主色青绿 / 深色深蓝 / 浅灰底 / 白卡片） */
:root {
  --fz-primary: #0f9d8f;
  --fz-primary-hover: #0c8a7e;
  --fz-primary-soft: #e6f7f5;
  --fz-dark: #0f2d40;
  --fz-bg: #f3f5f7;
  --fz-card: #ffffff;
  --fz-text: #303133;
  --fz-text-secondary: #606266;
  --fz-muted: #909399;
  --fz-border: #E5E7EB;
  --fz-error: #f56c6c;
  --fz-radius: 12px;
  --fz-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  --fz-shadow-hover: 0 6px 16px rgba(15, 157, 143, 0.14);
  --fz-page-max: 1400px;
  --fz-chat-max: 1200px;
  --fz-title: 28px;
  --fz-module: 20px;
  --fz-card-title: 17px;
  --fz-body: 14px;
  --fz-aux: 13px;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: var(--fz-bg);
  color: var(--fz-text);
  font-size: var(--fz-body);
}

/* 统一主按钮状态 */
.el-button--primary {
  --el-button-bg-color: var(--fz-primary);
  --el-button-border-color: var(--fz-primary);
  --el-button-hover-bg-color: var(--fz-primary-hover);
  --el-button-hover-border-color: var(--fz-primary-hover);
  --el-button-active-bg-color: #0a7369;
  --el-button-active-border-color: #0a7369;
}

/* 根级切换（登录页 ↔ 主布局） */
.root-fade-enter-active,
.root-fade-leave-active {
  transition: opacity 0.25s ease;
}
.root-fade-enter-from,
.root-fade-leave-to {
  opacity: 0;
}
</style>
