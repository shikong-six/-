// 场景化首页：四大法律咨询场景卡片，点进去是预置问题清单，一键发问
<template>
  <div class="home-page">
    <van-nav-bar title="法制通" fixed placeholder />

    <div class="hero">
      <div class="hello">你好，{{ username }}</div>
      <div class="tip">遇到法律问题？选个场景，直接点问题发问</div>
    </div>

    <!-- 场景卡片：两列网格 -->
    <div class="grid">
      <div
        v-for="s in scenarios"
        :key="s.key"
        class="card"
        :style="{background: s.color}"
        @click="openScenario(s)"
      >
        <van-icon :name="s.icon" class="card-icon" />
        <div class="card-title">{{ s.title }}</div>
        <div class="card-desc">{{ s.description }}</div>
      </div>
    </div>

    <!-- 点击场景后弹出预置问题清单 -->
    <van-action-sheet
      v-model:show="showSheet"
      :title="activeScenario ? activeScenario.title : ''"
      :actions="sheetActions"
      cancel-text="取消"
      close-on-click-action
      @select="onSelectQuestion"
    />

    <div class="logout-wrap">
      <van-button block round size="small" plain @click="onLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import {useRouter} from 'vue-router';
import {getUsername, logout} from '@/services/auth';
import {scenarios} from '@/services/scenarios';
import type {Scenario} from '@/services/scenarios';

const username = getUsername();
const router = useRouter();

// 当前选中的场景和它的问题清单（转成 ActionSheet 需要的格式）
const activeScenario = ref<Scenario | null>(null);
const showSheet = ref(false);

const sheetActions = computed(() =>
  (activeScenario.value?.questions ?? []).map((q) => ({name: q}))
);

function openScenario(s: Scenario) {
  activeScenario.value = s;
  showSheet.value = true;
}

// 点击问题：暂存到 sessionStorage（跨页传递，刷新即失效），跳问答页自动发问
function onSelectQuestion(action: {name: string}) {
  sessionStorage.setItem('fazhitong_pending_question', action.name);
  router.push('/ask');
}

function onLogout() {
  logout();
  // 守卫会自动把未登录用户送回登录页
  router.replace('/login');
}
</script>

<style scoped>
.hero {
  padding: 20px 20px 8px;
}

.hello {
  font-size: 20px;
  font-weight: 600;
}

.tip {
  margin-top: 6px;
  font-size: 13px;
  color: #969799;
}

/* 场景卡片网格：两列 */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}

.card {
  border-radius: 12px;
  padding: 16px 14px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s;
}

/* 点击时的按压缩放反馈 */
.card:active {
  transform: scale(0.96);
}

.card-icon {
  font-size: 24px;
  opacity: 0.9;
}

.card-title {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 600;
}

.card-desc {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.4;
}

.logout-wrap {
  margin: 24px 60px;
}
</style>
