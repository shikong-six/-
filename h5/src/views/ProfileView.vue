// 我的页面：账号信息 + 退出登录
<template>
  <div class="profile-page">
    <van-nav-bar title="我的" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <div class="user-card">
      <div class="avatar">{{ initial }}</div>
      <div class="username">{{ username }}</div>
      <div class="hint">法制通用户</div>
    </div>

    <van-cell-group inset class="menu">
      <van-cell title="问答历史" is-link icon="clock-o" @click="$router.push('/history')" />
      <van-cell title="返回首页" is-link icon="wap-home-o" @click="$router.push('/')" />
    </van-cell-group>

    <div class="logout-wrap">
      <van-button block round type="danger" plain @click="onLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {useRouter} from 'vue-router';
import {getUsername, logout} from '@/services/auth';

const username = getUsername();
// 头像显示用户名首字符
const initial = computed(() => (username ? username[0].toUpperCase() : '用'));
const router = useRouter();

function onLogout() {
  logout();
  // 守卫会自动把未登录用户送回登录页
  router.replace('/login');
}
</script>

<style scoped>
.user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 32px;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a6cf7, #7a9bff);
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
  color: #969799;
}

.menu {
  margin-top: 8px;
}

.logout-wrap {
  margin: 40px 24px;
}
</style>
