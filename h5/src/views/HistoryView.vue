// 问答历史页：会话列表，支持下拉刷新、滑动删除、改名、点入续聊
<template>
  <div class="history-page">
    <van-nav-bar title="问答历史" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-empty v-if="!loading && sessions.length === 0" description="还没有咨询记录，去首页提问吧" />
      <div v-for="s in sessions" :key="s.id" class="session-item">
        <van-swipe-cell>
          <van-cell
            :title="s.title || '未命名会话'"
            :label="`${formatTime(s.updatedAt)} · ${s.messageCount} 条问答`"
            is-link
            @click="openSession(s.id)"
          />
          <template #right>
            <van-button
              class="delete-btn"
              square
              type="danger"
              text="删除"
              @click="onDelete(s)"
            />
          </template>
        </van-swipe-cell>
        <van-icon name="edit" class="rename-icon" @click="onRename(s)" />
      </div>
    </van-pull-refresh>

    <!-- 改名弹窗 -->
    <van-dialog v-model:show="showRename" title="重命名会话" show-cancel-button @confirm="confirmRename">
      <van-field v-model="renameValue" class="rename-field" placeholder="请输入新标题" maxlength="30" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {showConfirmDialog, showFailToast, showSuccessToast} from 'vant';
import {deleteSession, getSessions, renameSession} from '@/services/chat';
import type {ChatSession} from '@/services/chat';

const router = useRouter();
const sessions = ref<ChatSession[]>([]);
const refreshing = ref(false);
const loading = ref(false);

// 改名弹窗状态
const showRename = ref(false);
const renameValue = ref('');
const renameTarget = ref<ChatSession | null>(null);

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

// 下拉刷新
async function onRefresh() {
  try {
    sessions.value = await getSessions();
    showSuccessToast('已刷新');
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '加载失败');
  } finally {
    refreshing.value = false;
  }
}

function openSession(id: number) {
  // 动态路由跳转会话聊天页，组件内还原历史消息继续对话
  router.push(`/chat/${id}`);
}

function onRename(s: ChatSession) {
  renameTarget.value = s;
  renameValue.value = s.title;
  showRename.value = true;
}

async function confirmRename() {
  const target = renameTarget.value;
  const title = renameValue.value.trim();
  if (!target || !title) return;
  try {
    await renameSession(target.id, title);
    target.title = title;
    showSuccessToast('已重命名');
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '重命名失败');
  }
}

async function onDelete(s: ChatSession) {
  // 滑动删除也加确认，防止误触
  try {
    await showConfirmDialog({title: '删除会话', message: `确定删除「${s.title}」吗？问答记录将一并删除。`});
  } catch {
    return; // 用户点了取消
  }
  try {
    await deleteSession(s.id);
    sessions.value = sessions.value.filter((item) => item.id !== s.id);
    showSuccessToast('已删除');
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '删除失败');
  }
}

// 时间格式化：当天只显示时分，更早显示月日
function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
}

onMounted(loadSessions);
</script>

<style scoped>
.session-item {
  position: relative;
}

/* 改名图标贴在单元格右侧 */
.rename-icon {
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  color: #c8c9cc;
  font-size: 16px;
  padding: 8px;
  z-index: 1;
}

.delete-btn {
  height: 100%;
}

.rename-field {
  padding: 16px 24px 24px;
}
</style>
