<!-- 我的：统计 + 菜单（不做未实现的收藏/文档假入口） -->
<template>
  <div class="profile-page">
    <van-nav-bar title="我的" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="$router.back()" />

    <div class="user-card">
      <div class="avatar">{{ initial }}</div>
      <div class="username">{{ username }}</div>
      <div class="hint">法制通用户</div>
      <div class="stats" v-if="qaCount !== null || sessionCount !== null">
        <div v-if="qaCount !== null" class="stat">
          <div class="num">{{ qaCount }}</div>
          <div class="label">累计问答</div>
        </div>
        <div v-if="sessionCount !== null" class="stat">
          <div class="num">{{ sessionCount }}</div>
          <div class="label">咨询会话</div>
        </div>
      </div>
    </div>

    <van-cell-group inset class="menu">
      <van-cell title="法律条文" is-link icon="notes-o" @click="$router.push('/laws')" />
      <van-cell title="参考案例" is-link icon="description" @click="$router.push('/cases')" />
      <van-cell title="问答历史" is-link icon="clock-o" @click="$router.push('/history')" />
      <van-cell title="返回首页" is-link icon="wap-home-o" @click="$router.push('/')" />
    </van-cell-group>

    <div class="logout-wrap">
      <van-button block round type="danger" plain @click="onLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {showConfirmDialog} from 'vant';
import {logout} from '@/services/auth';
import {getSessions} from '@/services/chat';
import {getProfileStats} from '@/services/stats';
import {useUserStore} from '@/store/user';

const user = useUserStore();
const username = computed(() => user.username || '用户');
const initial = computed(() => (username.value ? username.value[0].toUpperCase() : '用'));
const router = useRouter();
const qaCount = ref<number | null>(null);
const sessionCount = ref<number | null>(null);

onMounted(async () => {
  try {
    qaCount.value = (await getProfileStats()).qaCount;
  } catch {
    qaCount.value = null;
  }
  try {
    sessionCount.value = (await getSessions()).length;
  } catch {
    sessionCount.value = null;
  }
});

async function onLogout() {
  try {
    await showConfirmDialog({title: '退出登录', message: '退出后需要重新登录才能继续咨询。'});
  } catch {
    return;
  }
  sessionStorage.removeItem('fazhitong_last_chat');
  logout();
  router.replace('/login');
}
</script>

<style scoped>
.user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 16px 24px;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6, #0f9d8f);
  color: #fff;
  font-size: 30px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.username {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 600;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.stats {
  margin-top: 20px;
  width: 100%;
  max-width: 280px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 12px;
  padding: 14px 8px;
}
.stat {
  text-align: center;
}
.num {
  font-size: 20px;
  font-weight: 700;
  color: var(--fz-primary, #0f9d8f);
}
.label {
  margin-top: 4px;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.menu {
  margin-top: 8px;
}
.logout-wrap {
  margin: 40px 24px;
}
</style>
