<!-- 个人中心：账号信息 + 常用入口 -->
<template>
  <div class="profile-page">
    <el-card shadow="never" class="user-card">
      <div class="user-header">
        <span class="avatar">{{ initial }}</span>
        <div class="user-meta">
          <div class="username">{{ userStore.username }}</div>
          <div class="muted">法制通账号</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="menu-card">
      <div class="menu-row" @click="$router.push('/history')">
        <el-icon><Clock /></el-icon>
        <span>问答历史</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="menu-row" @click="$router.push('/knowledge/search')">
        <el-icon><Search /></el-icon>
        <span>检索测试</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="menu-row danger" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>
        <span>退出登录</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {useRouter} from 'vue-router';
import {Clock, Search, SwitchButton, ArrowRight} from '@element-plus/icons-vue';
import {useUserStore} from '@/store/user';
import {logout} from '@/services/auth';

const userStore = useUserStore();
const initial = computed(() => (userStore.username ? userStore.username[0].toUpperCase() : '用'));
const router = useRouter();

function handleLogout() {
  logout();
  // 守卫会把未登录用户送回登录页
  router.replace('/login');
}
</script>

<style scoped>
.profile-page {
  max-width: 720px;
  margin: 0 auto;
}
.user-card {
  margin-bottom: 16px;
}
.user-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a6cf7, #7a9bff);
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.username {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.muted {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.menu-card :deep(.el-card__body) {
  padding: 8px 0;
}
.menu-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  cursor: pointer;
  color: #303133;
  font-size: 14px;
  transition: background 0.15s;
}
.menu-row:hover {
  background: #f5f7fa;
}
.menu-row .arrow {
  margin-left: auto;
  color: #c0c4cc;
}
.menu-row.danger {
  color: #f56c6c;
}
</style>
