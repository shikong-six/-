<!-- 个人中心：统计 + 菜单（不做未实现的收藏/我的文档假入口） -->
<template>
  <div class="profile-page">
    <h2 class="page-title">个人中心</h2>

    <el-card shadow="never" class="user-card">
      <div class="user-header">
        <span class="avatar">{{ initial }}</span>
        <div class="user-meta">
          <div class="username">{{ userStore.username }}</div>
          <div class="muted">法制通账号</div>
        </div>
      </div>
      <div class="stats-row" v-loading="statsLoading">
        <div class="stat">
          <div class="stat-num">{{ profileStats.qaCount }}</div>
          <div class="stat-label">累计问答</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ profileStats.caseViewCount }}</div>
          <div class="stat-label">浏览案例</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ profileStats.uploadCount }}</div>
          <div class="stat-label">上传文档</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="menu-card">
      <div class="menu-row" @click="$router.push('/history')">
        <el-icon><Clock /></el-icon>
        <span>问答历史</span>
        <el-icon class="arrow"><ArrowRight /></el-icon>
      </div>
      <div class="menu-row" @click="onSettings">
        <el-icon><Setting /></el-icon>
        <span>账户设置</span>
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
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Clock, Setting, SwitchButton, ArrowRight} from '@element-plus/icons-vue';
import {useUserStore} from '@/store/user';
import {logout} from '@/services/auth';
import {getProfileStats} from '@/services/stats';
import type {ProfileStats} from '@/services/stats';

const userStore = useUserStore();
const initial = computed(() => (userStore.username ? userStore.username[0].toUpperCase() : '用'));
const router = useRouter();

const profileStats = ref<ProfileStats>({qaCount: 0, caseViewCount: 0, uploadCount: 0});
const statsLoading = ref(false);

onMounted(async () => {
  statsLoading.value = true;
  try {
    profileStats.value = await getProfileStats();
  } catch (e: any) {
    ElMessage.error(e?.message || '加载个人统计失败');
  } finally {
    statsLoading.value = false;
  }
});

function onSettings() {
  ElMessage.info('账户设置功能开发中');
}

function handleLogout() {
  sessionStorage.removeItem('fazhitong_last_chat');
  logout();
  router.replace('/login');
}
</script>

<style scoped>
.profile-page {
  max-width: 720px;
  margin: 0 auto;
}
.page-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: var(--fz-title, 28px);
  font-weight: 700;
  color: var(--fz-text, #303133);
}
.user-card {
  margin-bottom: 16px;
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
}
.user-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0 16px;
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6, #0f9d8f);
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
  color: var(--fz-text, #303133);
}
.muted {
  font-size: 13px;
  color: var(--fz-muted, #909399);
  margin-top: 4px;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border-top: 1px solid var(--fz-border, #E5E7EB);
  padding-top: 16px;
}
.stat {
  text-align: center;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--fz-primary, #0f9d8f);
}
.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--fz-muted, #909399);
}
.menu-card {
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
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
  color: var(--fz-text, #303133);
  font-size: 14px;
  transition: background 0.15s;
}
.menu-row:hover {
  background: var(--fz-primary-soft, #e6f7f5);
}
.menu-row .arrow {
  margin-left: auto;
  color: #c0c4cc;
}
.menu-row.danger {
  color: var(--fz-error, #f56c6c);
}
</style>
