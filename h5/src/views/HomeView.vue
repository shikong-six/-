<!-- 场景化首页：主行动在上，场景卡展示一个示例问题，历史和我的做成入口卡 -->
<template>
  <div class="home-page">
    <van-nav-bar title="法制通" fixed placeholder safe-area-inset-top />

    <section class="hero">
      <div class="kicker">随身法律咨询</div>
      <h1>有问题，直接问</h1>
      <p>劳动、租房、婚姻、交通事故。回答会附上相关法条，方便你核对。</p>
      <button type="button" class="ask-btn" @click="startNew">开始咨询</button>
      <button v-if="lastChat" type="button" class="continue-btn" @click="continueLast">继续上次咨询</button>
    </section>
    <p class="disclaimer">内容仅供参考，不构成正式法律意见</p>

    <div class="section-head">
      <div class="section-title">按场景提问</div>
      <div class="section-sub">点进去选一个常见问题</div>
    </div>
    <div class="grid">
      <button
        v-for="s in scenarios"
        :key="s.key"
        type="button"
        class="card"
        @click="openScenario(s)"
      >
        <span class="icon-wrap" :style="{background: s.accent + '18', color: s.accent}">
          <van-icon :name="s.icon" />
        </span>
        <span class="card-title">{{ s.title }}</span>
        <span class="card-desc">{{ s.description }}</span>
        <span class="card-go" :style="{color: s.accent}">{{ s.questions.length }} 个常见问题</span>
      </button>
    </div>

    <div v-if="recent.length" class="recent">
      <div class="section-head recent-head">
        <div class="section-title">最近咨询</div>
        <button type="button" class="more" @click="$router.push('/history')">全部</button>
      </div>
      <button
        v-for="s in recent"
        :key="s.id"
        type="button"
        class="recent-item"
        @click="openRecent(s.id)"
      >
        <span>{{ s.title || '未命名会话' }}</span>
        <em>{{ s.messageCount }} 条问答</em>
      </button>
    </div>

    <div class="entries">
      <button type="button" class="entry" @click="$router.push('/laws')">
        <span class="entry-icon"><van-icon name="notes-o" /></span>
        <span class="entry-text">
          <strong>法律条文</strong>
          <em>按分类搜索，展开看原文</em>
        </span>
        <van-icon name="arrow" class="entry-arrow" />
      </button>
      <button type="button" class="entry" @click="$router.push('/cases')">
        <span class="entry-icon"><van-icon name="description" /></span>
        <span class="entry-text">
          <strong>参考案例</strong>
          <em>看摘要和裁判要旨</em>
        </span>
        <van-icon name="arrow" class="entry-arrow" />
      </button>
      <button type="button" class="entry" @click="$router.push('/history')">
        <span class="entry-icon"><van-icon name="clock-o" /></span>
        <span class="entry-text">
          <strong>问答历史</strong>
          <em>查看并继续之前的咨询</em>
        </span>
        <van-icon name="arrow" class="entry-arrow" />
      </button>
      <button type="button" class="entry" @click="$router.push('/profile')">
        <span class="entry-icon"><van-icon name="user-o" /></span>
        <span class="entry-text">
          <strong>我的</strong>
          <em>账号信息与退出登录</em>
        </span>
        <van-icon name="arrow" class="entry-arrow" />
      </button>
    </div>

    <van-action-sheet
      v-model:show="showSheet"
      :title="activeScenario ? activeScenario.title : ''"
      :actions="sheetActions"
      cancel-text="取消"
      close-on-click-action
      @select="onSelectQuestion"
    />
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {getSessions} from '@/services/chat';
import type {ChatSession} from '@/services/chat';
import {clearLibraryRef} from '@/services/content';
import {scenarios} from '@/services/scenarios';
import type {Scenario} from '@/services/scenarios';

const router = useRouter();
const activeScenario = ref<Scenario | null>(null);
const showSheet = ref(false);
const lastChat = ref('');
const recent = ref<ChatSession[]>([]);

const sheetActions = computed(() =>
  (activeScenario.value?.questions ?? []).map((q) => ({name: q}))
);

function openScenario(s: Scenario) {
  activeScenario.value = s;
  showSheet.value = true;
}

function onSelectQuestion(action: {name: string}) {
  clearLibraryRef();
  sessionStorage.setItem('fazhitong_pending_question', action.name);
  sessionStorage.setItem('fazhitong_force_new', '1');
  router.push('/ask');
}

function startNew() {
  clearLibraryRef();
  sessionStorage.removeItem('fazhitong_pending_question');
  sessionStorage.setItem('fazhitong_force_new', '1');
  router.push('/ask');
}

function continueLast() {
  if (lastChat.value) router.push(lastChat.value);
}

function openRecent(id: number) {
  sessionStorage.setItem('fazhitong_last_chat', `/chat/${id}`);
  router.push(`/chat/${id}`);
}

onMounted(async () => {
  const last = sessionStorage.getItem('fazhitong_last_chat');
  lastChat.value = last && last !== '/ask' ? last : '';
  try {
    recent.value = (await getSessions()).slice(0, 3);
  } catch {
    recent.value = [];
  }
});
</script>

<style scoped>
.home-page {
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
}
.hero {
  position: relative;
  overflow: hidden;
  margin: 12px 16px 0;
  padding: 22px 18px 18px;
  border-radius: 16px;
  background: linear-gradient(155deg, #14b8a6 0%, #0f9d8f 42%, #0c5f68 100%);
  color: #fff;
  box-shadow: 0 10px 24px rgba(15, 157, 143, 0.22);
}
.hero::after {
  content: '';
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  right: -48px;
  top: -56px;
  background: rgba(255, 255, 255, 0.1);
}
.hero > * {
  position: relative;
  z-index: 1;
}
.kicker {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.85;
}
.hero h1 {
  margin: 8px 0 0;
  font-size: 26px;
  line-height: 1.25;
  font-weight: 700;
}
.hero p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.92;
}
.ask-btn {
  display: block;
  width: 100%;
  margin-top: 16px;
  height: 44px;
  border: none;
  border-radius: 22px;
  background: #fff;
  color: #0c7a70;
  font-size: 16px;
  font-weight: 650;
}
.ask-btn:active {
  opacity: 0.9;
}
.continue-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  height: 36px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 14px;
}
.disclaimer {
  margin: 8px 20px 0;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.section-head {
  margin: 22px 20px 0;
}
.section-title {
  font-size: 17px;
  font-weight: 650;
  color: var(--fz-text, #323233);
}
.section-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 16px 0;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  min-height: 148px;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 16px;
  padding: 14px 14px 12px;
  box-shadow: 0 6px 16px rgba(15, 45, 64, 0.04);
}
.card:active {
  transform: scale(0.98);
}
.icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.card-title {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 650;
  color: var(--fz-text, #323233);
}
.card-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--fz-muted, #969799);
}
.card-go {
  margin-top: auto;
  padding-top: 10px;
  font-size: 12px;
  font-weight: 600;
}
.recent {
  margin: 16px 16px 0;
}
.recent-head {
  margin: 0 4px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.more {
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 13px;
  padding: 0;
}
.recent-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.recent-item span {
  font-size: 14px;
  color: var(--fz-text, #323233);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-item em {
  flex-shrink: 0;
  font-style: normal;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.entries {
  margin: 12px 16px 0;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 16px;
  overflow: hidden;
}
.entry {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border: none;
  background: #fff;
  text-align: left;
}
.entry + .entry {
  border-top: 1px solid var(--fz-border, #ebedf0);
}
.entry:active {
  background: var(--fz-primary-soft, #e6f7f5);
}
.entry-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--fz-primary-soft, #e6f7f5);
  color: var(--fz-primary, #0f9d8f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.entry-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.entry-text strong {
  font-size: 15px;
  font-weight: 650;
  color: var(--fz-text, #323233);
}
.entry-text em {
  font-style: normal;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.entry-arrow {
  color: #c8c9cc;
  font-size: 16px;
}
:deep(.van-action-sheet__name) {
  white-space: normal;
  line-height: 1.45;
  text-align: left;
}
</style>
