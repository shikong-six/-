// 聊天式问答页：微信聊天形态，底部输入栏 + 气泡消息 + SSE 逐字渲染
// 承接两种进入方式：/ask 新对话；首页场景问题经 sessionStorage 暂存后进入自动发问
<template>
  <div class="chat-page">
    <van-nav-bar title="智能问答" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <!-- 消息列表 -->
    <div ref="listEl" class="messages">
      <van-empty v-if="messages.length === 0" description="向我提问，给你有法律依据的回答" />
      <div v-for="(msg, index) in messages" :key="index" class="msg-row" :class="msg.role">
        <div class="bubble" :class="{failed: msg.failed}">
          <!-- AI 消息渲染 Markdown（marked 转 HTML + DOMPurify 消毒防 XSS），用户消息纯文本 -->
          <div v-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
          <div v-else>{{ msg.content }}</div>
          <!-- 等待期提示：检索+首 token 到达前，让用户知道没卡死 -->
          <div v-if="msg.waiting" class="waiting-tip">正在检索法律知识库并生成回答…</div>
          <div v-if="msg.loading" class="cursor">▍</div>

          <!-- 引用来源：点击展开法条原文 -->
          <div v-if="msg.references && msg.references.length > 0" class="refs">
            <div class="refs-toggle" @click="toggleRefs(index)">
              📖 引用来源（{{ msg.references.length }}）
              <van-icon :name="expandedRefs === index ? 'arrow-up' : 'arrow-down'" />
            </div>
            <div v-if="expandedRefs === index" class="refs-list">
              <div v-for="(ref, i) in msg.references" :key="i" class="ref-item">
                <div class="ref-title">《{{ ref.docName }}》第 {{ ref.chunkIndex + 1 }} 块</div>
                <div class="ref-text">{{ ref.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入栏（适配 iPhone 底部安全区） -->
    <div class="input-bar">
      <!-- 语音输入：浏览器不支持 Web Speech API 时自动隐藏（静默降级） -->
      <VoiceButton v-if="speechSupported" @final="onVoiceFinal" />
      <van-field
        v-model="input"
        class="input-field"
        placeholder="请输入你的法律问题"
        :disabled="streaming"
        @keyup.enter="send(input)"
      />
      <van-button
        v-if="!streaming"
        class="send-btn"
        type="primary"
        icon="guide-o"
        :disabled="!input.trim()"
        @click="send(input)"
      >发送</van-button>
      <van-button v-else class="send-btn" type="danger" icon="stop-circle-o" @click="stop">停止</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from 'vue';
import {useRoute} from 'vue-router';
import {showFailToast} from 'vant';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {useChatStream} from '@/composables/useChatStream';
import {isSpeechSupported} from '@/composables/useSpeechRecognition';
import VoiceButton from '@/components/VoiceButton.vue';
import {getSessionMessages} from '@/services/chat';
import type {ChatMessage, Reference} from '@/services/chat';

// 页面展示用的消息（比发给后端的多一些展示字段）
interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  historyId?: number | null;
  loading?: boolean;  // 生成中
  waiting?: boolean;  // 检索中（第一个 token 还没到达）
  failed?: boolean;   // 生成失败（无内容可显示）
}

const messages = ref<DisplayMessage[]>([]);
// 发给后端的对话历史（只存已完成的问答对，生成中的不放入）
const apiMessages: ChatMessage[] = [];
// 当前会话 ID（后端在新会话首次回答后通过 session 事件下发）
const sessionId = ref<number | null>(null);
const input = ref('');
const listEl = ref<HTMLElement | null>(null);
const expandedRefs = ref<number | null>(null);
// 当前路由（取会话 ID 动态段用）
const route = useRoute();
// 浏览器不支持语音识别时隐藏语音按钮（静默降级，不影响文字输入）
const speechSupported = isSpeechSupported();

// SSE 流式能力（读流逻辑在 composable 里）
const {streaming, streamChat, stop} = useChatStream();

// 语音识别完成：填入输入框并自动发问
function onVoiceFinal(text: string) {
  input.value = text;
  send(text);
}

// Markdown 转 HTML 并消毒（Web 端踩过的坑：v-html 必须配 DOMPurify，否则 XSS）
function renderMarkdown(text: string): string {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text, {async: false}) as string);
}

// 滚动到底部：rAF 节流去抖，避免每个 token 都强制布局
let rafId = 0;
function scrollToBottom() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    nextTick(() => {
      if (listEl.value) {
        listEl.value.scrollTop = listEl.value.scrollHeight;
      }
    });
  });
}

function toggleRefs(index: number) {
  expandedRefs.value = expandedRefs.value === index ? null : index;
}

// 发送问题
async function send(text: string) {
  const question = text.trim();
  if (!question || streaming.value) return;
  input.value = '';

  messages.value.push({role: 'user', content: question});
  const assistantMsg: DisplayMessage = {role: 'assistant', content: '', loading: true, waiting: true};
  messages.value.push(assistantMsg);
  scrollToBottom();

  // 组装发给后端的消息历史：已完成的问答对 + 本次问题
  const payload: ChatMessage[] = [...apiMessages, {role: 'user', content: question}];

  await streamChat(payload, sessionId.value, {
    onToken: (token) => {
      // 第一个 token 到达：结束等待提示，进入逐字渲染
      assistantMsg.waiting = false;
      assistantMsg.content += token;
      scrollToBottom();
    },
    onReferences: (refs) => {
      assistantMsg.references = refs;
    },
    onSession: (sid, hid) => {
      sessionId.value = sid;
      assistantMsg.historyId = hid;
    },
    onDone: () => {
      assistantMsg.loading = false;
      assistantMsg.waiting = false;
      // 完成的问答对进入历史，供下一轮带上下文
      apiMessages.push(
        {role: 'user', content: question},
        {role: 'assistant', content: assistantMsg.content}
      );
    },
    onError: (message) => {
      assistantMsg.loading = false;
      assistantMsg.waiting = false;
      if (!assistantMsg.content) {
        assistantMsg.failed = true;
      }
      showFailToast(message);
    },
  });
}

// 从首页场景卡片进来：读取暂存的问题，自动发问一次
onMounted(() => {
  const sidParam = route.params.sessionId;
  if (sidParam) {
    // 带会话 ID 进入：还原历史消息，继续对话
    loadSession(Number(sidParam));
    return;
  }
  const pending = sessionStorage.getItem('fazhitong_pending_question');
  if (pending) {
    sessionStorage.removeItem('fazhitong_pending_question');
    send(pending);
  }
});

// 同组件内切换会话（/chat/3 → /chat/4）：组件复用不会重新挂载，必须监听参数变化重新拉消息
// 这是 Web 端踩过的坑：动态路由刷新/切换不加载数据，根因是 onMounted 不会再执行
watch(
  () => route.params.sessionId,
  (value) => {
    if (value) {
      loadSession(Number(value));
    }
  }
);

// 加载某个会话的历史消息，还原对话窗口
async function loadSession(id: number) {
  try {
    const list = await getSessionMessages(id);
    messages.value = [];
    apiMessages.length = 0;
    sessionId.value = id;
    for (const item of list) {
      messages.value.push({role: 'user', content: item.question});
      messages.value.push({role: 'assistant', content: item.answer, historyId: item.id});
      // 历史问答对进入上下文，续聊时带给后端
      apiMessages.push(
        {role: 'user', content: item.question},
        {role: 'assistant', content: item.answer}
      );
    }
    scrollToBottom();
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '加载会话失败');
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f8fa;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.msg-row {
  display: flex;
  margin-bottom: 14px;
}

.msg-row.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 82%;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.msg-row.user .bubble {
  background: #4a6cf7;
  color: #fff;
}

.msg-row.assistant .bubble {
  background: #fff;
  color: #323233;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.bubble.failed {
  color: #ee0a24;
}

/* 生成中的光标闪烁 */
.cursor {
  display: inline-block;
  animation: blink 0.8s infinite;
}

/* 检索等待期提示 */
.waiting-tip {
  margin-top: 4px;
  font-size: 13px;
  color: #969799;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

/* 引用来源 */
.refs {
  margin-top: 8px;
  border-top: 1px dashed #ebedf0;
  padding-top: 6px;
}

.refs-toggle {
  font-size: 13px;
  color: #4a6cf7;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.refs-list {
  margin-top: 6px;
}

.ref-item {
  margin-bottom: 8px;
  padding: 8px;
  background: #f7f8fa;
  border-radius: 6px;
}

.ref-title {
  font-size: 12px;
  color: #969799;
  margin-bottom: 4px;
}

.ref-text {
  font-size: 13px;
  color: #646566;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
}

/* 底部输入栏 */
.input-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  /* iPhone 底部安全区 */
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}

.input-field {
  flex: 1;
  background: #f7f8fa;
  border-radius: 18px;
  padding: 2px 14px;
}

.input-field :deep(.van-field__control) {
  font-size: 15px;
}

.send-btn {
  flex-shrink: 0;
}

/* Markdown 渲染出来的内容样式（v-html 里的元素不受 scoped 限制，要用 :deep） */
.markdown-body :deep(p) {
  margin: 0 0 8px;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-size: 16px;
  margin: 10px 0 6px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(code) {
  background: #f2f3f5;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}

.markdown-body :deep(blockquote) {
  margin: 6px 0;
  padding-left: 10px;
  border-left: 3px solid #dcdee0;
  color: #646566;
}
</style>
