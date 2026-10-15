<!-- 问答历史：日期分组 + 下拉刷新 / 滑动删除 / 改名 / 续聊 -->
<template>
  <div class="history-page">
    <van-nav-bar title="问答历史" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="$router.back()" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="loading && sessions.length === 0" class="loading-wrap">
        <van-loading size="24px">加载中…</van-loading>
      </div>
      <van-empty v-else-if="!loading && sessions.length === 0" description="还没有咨询记录，去首页提问吧" />

      <template v-for="group in groupedSessions" :key="group.label">
        <div class="group-label">{{ group.label }}</div>
        <div v-for="s in group.items" :key="s.id" class="session-item">
          <van-swipe-cell>
            <van-cell is-link @click="openSession(s.id)">
              <template #title>
                <div class="session-title">
                  <span>{{ s.title || '未命名会话' }}</span>
                  <van-icon name="edit" class="edit-icon" @click.stop="onRename(s)" />
                </div>
              </template>
              <template #label>{{ formatTime(s.updatedAt) }} · {{ s.messageCount }} 条问答</template>
            </van-cell>
            <template #right>
              <van-button class="delete-btn" square type="danger" text="删除" @click="onDelete(s)" />
            </template>
          </van-swipe-cell>
        </div>
      </template>
    </van-pull-refresh>

    <van-dialog v-model:show="showRename" title="重命名会话" show-cancel-button :before-close="beforeRenameClose">
      <van-field v-model="renameValue" class="rename-field" placeholder="请输入新标题" maxlength="30" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {showConfirmDialog, showFailToast, showSuccessToast} from 'vant';
import {deleteSession, getSessions, renameSession} from '@/services/chat';
import type {ChatSession} from '@/services/chat';

const router = useRouter();
const sessions = ref<ChatSession[]>([]);
const refreshing = ref(false);
const loading = ref(false);
const showRename = ref(false);
const renameValue = ref('');
const renameTarget = ref<ChatSession | null>(null);

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const groupedSessions = computed(() => {
  const today = dayStart(new Date());
  const yesterday = today - 86400000;
  const groups: {label: string; items: ChatSession[]}[] = [
    {label: '今天', items: []},
    {label: '昨天', items: []},
    {label: '更早', items: []},
  ];
  for (const s of sessions.value) {
    const t = dayStart(new Date(s.updatedAt));
    if (t >= today) groups[0].items.push(s);
    else if (t >= yesterday) groups[1].items.push(s);
    else groups[2].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
});

async function loadSessions() {
  loading.value = true;
  try {
    sessions.value = await getSessions();
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  try {
    sessions.value = await getSessions();
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '加载失败');
  } finally {
    refreshing.value = false;
  }
}

function openSession(id: number) {
  sessionStorage.setItem('fazhitong_last_chat', `/chat/${id}`);
  router.push(`/chat/${id}`);
}

function onRename(s: ChatSession) {
  renameTarget.value = s;
  renameValue.value = s.title;
  showRename.value = true;
}

async function beforeRenameClose(action: string): Promise<boolean> {
  if (action !== 'confirm') return true;
  const target = renameTarget.value;
  const title = renameValue.value.trim();
  if (!target || !title) {
    showFailToast('标题不能为空');
    return false;
  }
  try {
    await renameSession(target.id, title);
    target.title = title;
    showSuccessToast('已重命名');
    return true;
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '重命名失败');
    return false;
  }
}

async function onDelete(s: ChatSession) {
  try {
    await showConfirmDialog({title: '删除会话', message: `确定删除「${s.title}」吗？问答记录将一并删除。`});
  } catch {
    return;
  }
  try {
    await deleteSession(s.id);
    sessions.value = sessions.value.filter((item) => item.id !== s.id);
    showSuccessToast('已删除');
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '删除失败');
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}

onMounted(loadSessions);
</script>

<style scoped>
.group-label {
  padding: 12px 16px 6px;
  font-size: 13px;
  color: var(--fz-muted, #969799);
}
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
.session-item {
  background: #fff;
}
.session-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
}
.session-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.edit-icon {
  flex-shrink: 0;
  color: var(--fz-muted, #969799);
  font-size: 16px;
  padding: 2px;
}
.delete-btn {
  height: 100%;
}
.history-page {
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom);
}
.rename-field {
  margin: 12px 16px;
}
</style>
