<!-- 聊天式问答：空状态建议问 / keep-alive / 重新生成 / 法律依据 -->
<template>
  <div class="chat-page">
    <van-nav-bar title="AI 法律咨询" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="goBack">
      <template #right>
        <button type="button" class="nav-new" @click="startNew">新对话</button>
      </template>
    </van-nav-bar>

    <div ref="listEl" class="messages">
      <div v-if="messages.length === 0" class="empty-card">
        <div class="empty-label">AI 法律咨询</div>
        <p class="empty-desc">我可以帮你检索法律知识并分析相关问题</p>
        <button
          v-for="(q, i) in suggestQuestions"
          :key="i"
          class="suggest-item"
          @click="send(q)"
        >
          {{ q }}
        </button>
      </div>

      <div v-for="(msg, index) in messages" :key="msg.uid" class="msg-row" :class="msg.role">
        <div class="bubble" :class="{failed: msg.failed}">
          <div v-if="msg.role === 'assistant'" class="ai-brand">法制通 AI</div>
          <div v-if="msg.role === 'assistant' && msg.failed" class="fail-block">
            <div class="fail-title">回答生成失败</div>
            <div class="fail-desc">请稍后重试</div>
            <button class="regen-link" @click="regenerateAt(index)">重新生成</button>
          </div>
          <template v-else>
            <div
              v-if="msg.role === 'assistant' && msg.content && !msg.typing && !msg.loading"
              class="markdown-body"
              v-html="renderMarkdown(msg.content)"
            ></div>
            <div v-else-if="msg.role === 'assistant'" class="plain">{{ msg.content }}</div>
            <div v-else>{{ msg.content }}</div>
          </template>
          <div v-if="msg.waiting" class="waiting-tip">{{ msg.statusTip || '正在检索法律知识库…' }}</div>
          <div v-if="msg.loading || msg.typing" class="cursor">▍</div>

          <div v-if="msg.references && msg.references.length > 0" class="refs">
            <div class="refs-title">相关法律依据</div>
            <div class="refs-toggle" @click="toggleRefs(index)">
              查看 {{ msg.references.length }} 条
              <van-icon :name="expandedRefs === index ? 'arrow-up' : 'arrow-down'" />
            </div>
            <div v-if="expandedRefs === index" class="refs-list">
              <div v-for="(ref, i) in msg.references" :key="i" class="ref-item">
                <div class="ref-title">《{{ lawDisplayName(ref.docName) }}》</div>
                <div class="ref-text" :class="{clamp: !isRefOpen(msg.uid, i)}">{{ ref.text }}</div>
                <button
                  v-if="ref.text && ref.text.length > 80"
                  type="button"
                  class="ref-more"
                  @click="toggleRefText(msg.uid, i)"
                >
                  {{ isRefOpen(msg.uid, i) ? '收起' : '展开原文' }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="msg.role === 'assistant' && msg.content && !msg.failed && !msg.loading && !msg.typing"
            class="msg-actions"
          >
            <button
              v-if="msg.historyId"
              type="button"
              class="regen-link"
              :class="{active: msg.feedback === 1}"
              @click="onFeedback(msg, 1)"
            >有用</button>
            <button
              v-if="msg.historyId"
              type="button"
              class="regen-link"
              :class="{active: msg.feedback === -1}"
              @click="onFeedback(msg, -1)"
            >没用</button>
            <button type="button" class="regen-link" @click="copyAnswer(msg.content)">复制</button>
            <button type="button" class="regen-link" :disabled="streaming" @click="regenerateAt(index)">重新生成</button>
          </div>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <p class="disclaimer">回答仅供参考，不构成法律意见</p>
      <div class="input-row">
        <VoiceButton v-if="speechSupported" @final="onVoiceFinal" />
        <van-field
          v-model="input"
          class="input-field"
          type="textarea"
          @focus="onInputFocus"
          rows="1"
          autosize
          placeholder="请输入你的法律问题……"
          :disabled="streaming"
          @keydown.enter="onEnter"
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
  </div>
</template>

<script setup lang="ts">
import {nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {showFailToast, showSuccessToast} from 'vant';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {useChatStream} from '@/composables/useChatStream';
import {isSpeechSupported} from '@/composables/useSpeechRecognition';
import VoiceButton from '@/components/VoiceButton.vue';
import {getSessionMessages, setFeedback, lawDisplayName} from '@/services/chat';
import {clearLibraryRef, explainFromLibrary} from '@/services/content';
import type {ChatMessage, Reference} from '@/services/chat';

defineOptions({name: 'ChatView'});

interface DisplayMessage {
  uid: number;
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  historyId?: number | null;
  loading?: boolean;
  typing?: boolean;
  waiting?: boolean;
  statusTip?: string;
  failed?: boolean;
  feedback?: number | null;
  // 接口失败时用本地案例凑的文字，不能当作模型上一轮的回答再送回去
  local?: boolean;
}

const suggestQuestions = [
  '经济补偿金怎么算？',
  '公司不签劳动合同怎么办？',
  '试用期被辞退怎么办？',
  '加班费应该怎么计算？',
];

const messages = ref<DisplayMessage[]>([]);
const apiMessages: ChatMessage[] = [];
const sessionId = ref<number | null>(null);
const input = ref('');
const listEl = ref<HTMLElement | null>(null);
const expandedRefs = ref<number | null>(null);
const openRefKeys = ref<Set<string>>(new Set());
let uidSeed = 1;

function nextUid(): number {
  uidSeed += 1;
  return uidSeed;
}
const route = useRoute();
const router = useRouter();
const speechSupported = isSpeechSupported();
const {streaming, streamChat, stop} = useChatStream();

function refKey(uid: number, index: number): string {
  return `${uid}-${index}`;
}

function isRefOpen(uid: number, index: number): boolean {
  return openRefKeys.value.has(refKey(uid, index));
}

function toggleRefText(uid: number, index: number) {
  const key = refKey(uid, index);
  const next = new Set(openRefKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openRefKeys.value = next;
}

async function copyAnswer(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showSuccessToast('已复制');
      return;
    }
    throw new Error('clipboard unavailable');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    if (ok) showSuccessToast('已复制');
    else showFailToast('复制失败');
  }
}

function onVoiceFinal(text: string) {
  input.value = text;
  send(text);
}

function onEnter(e: KeyboardEvent) {
  if (e.shiftKey || e.isComposing) return;
  e.preventDefault();
  send(input.value);
}

async function onFeedback(msg: DisplayMessage, value: 1 | -1) {
  if (!msg.historyId) return;
  const previous = msg.feedback ?? null;
  const next = previous === value ? 0 : value;
  msg.feedback = next === 0 ? null : next;
  try {
    await setFeedback(msg.historyId, next);
  } catch (e) {
    msg.feedback = previous;
    showFailToast(e instanceof Error ? e.message : '反馈失败');
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function resetChat() {
  flushTypewriter();
  messages.value = [];
  apiMessages.length = 0;
  sessionId.value = null;
  input.value = '';
  expandedRefs.value = null;
  openRefKeys.value = new Set();
  sessionStorage.setItem('fazhitong_last_chat', '/ask');
}

function ensureIdle(): Promise<void> {
  if (!streaming.value) return Promise.resolve();
  stop();
  if (!streaming.value) return Promise.resolve();
  return new Promise((resolve) => {
    const unwatch = watch(streaming, (value) => {
      if (!value) {
        unwatch();
        resolve();
      }
    });
  });
}

async function startNew() {
  await ensureIdle();
  clearLibraryRef();
  resetChat();
  if (route.path !== '/ask') router.replace('/ask');
}

async function consumeLaunch(): Promise<boolean> {
  const forceNew = sessionStorage.getItem('fazhitong_force_new') === '1';
  const pending = sessionStorage.getItem('fazhitong_pending_question');
  if (!forceNew && !pending) return false;
  sessionStorage.removeItem('fazhitong_force_new');
  sessionStorage.removeItem('fazhitong_pending_question');
  await ensureIdle();
  resetChat();
  if (pending) send(pending);
  return true;
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text, {async: false}) as string);
}

let rafId = 0;
function scrollToBottom() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    nextTick(() => {
      if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
    });
  });
}

function toggleRefs(index: number) {
  expandedRefs.value = expandedRefs.value === index ? null : index;
}

let typeQueue = '';
let typeTimer: ReturnType<typeof setInterval> | null = null;
let typingTarget: DisplayMessage | null = null;

function feedTypewriter(msg: DisplayMessage, text: string) {
  typeQueue += text;
  typingTarget = msg;
  msg.typing = true;
  if (typeTimer) return;
  typeTimer = setInterval(() => {
    if (!typingTarget || !messages.value.includes(typingTarget)) {
      stopTypewriter();
      return;
    }
    typingTarget.content += typeQueue.slice(0, 2);
    typeQueue = typeQueue.slice(2);
    scrollToBottom();
    if (!typeQueue) stopTypewriter();
  }, 30);
}

function stopTypewriter() {
  if (typeTimer) {
    clearInterval(typeTimer);
    typeTimer = null;
  }
  if (typingTarget) typingTarget.typing = false;
  typingTarget = null;
  typeQueue = '';
}

function flushTypewriter() {
  if (typingTarget && typeQueue) typingTarget.content += typeQueue;
  stopTypewriter();
}

function regenerateAt(assistantIndex: number) {
  if (streaming.value) return;
  let userIndex = -1;
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userIndex = i;
      break;
    }
  }
  if (userIndex < 0) return;
  const question = messages.value[userIndex].content;
  // 截到该问之前，并按剩余完整问答对重建后端上下文
  messages.value = messages.value.slice(0, userIndex);
  apiMessages.length = 0;
  for (let i = 0; i + 1 < messages.value.length; i += 2) {
    const u = messages.value[i];
    const a = messages.value[i + 1];
    if (u.role === 'user' && a.role === 'assistant' && a.content && !a.local) {
      apiMessages.push({role: 'user', content: u.content}, {role: 'assistant', content: a.content});
    } else if (u.role === 'user' && a.local) {
      apiMessages.push({role: 'user', content: u.content});
    }
  }
  send(question);
}

async function send(text: string) {
  const question = text.trim();
  if (!question || streaming.value) return;
  input.value = '';
  flushTypewriter();

  messages.value.push({uid: nextUid(), role: 'user', content: question});
  const assistantMsg = reactive<DisplayMessage>({
    uid: nextUid(),
    role: 'assistant',
    content: '',
    loading: true,
    waiting: true,
    statusTip: '正在检索法律知识库…',
  });
  messages.value.push(assistantMsg);
  scrollToBottom();

  const payload: ChatMessage[] = [...apiMessages, {role: 'user', content: question}];

  await streamChat(payload, sessionId.value, {
    onToken: (token) => {
      assistantMsg.waiting = false;
      feedTypewriter(assistantMsg, token);
    },
    onStatus: (message) => {
      assistantMsg.statusTip = message || '正在生成回答…';
    },
    onReferences: (refs) => {
      assistantMsg.references = refs;
    },
    onSession: (sid, hid) => {
      if (!sessionId.value && sid) {
        sessionId.value = sid;
        sessionStorage.setItem('fazhitong_last_chat', `/chat/${sid}`);
        // 人还在聊天页才改 URL，避免从首页被拽回来
        if (route.path.startsWith('/ask') || route.path.startsWith('/chat')) {
          router.replace(`/chat/${sid}`);
        }
      } else if (sid) {
        sessionId.value = sid;
        sessionStorage.setItem('fazhitong_last_chat', `/chat/${sid}`);
      }
      assistantMsg.historyId = hid;
    },
    onDone: () => {
      assistantMsg.loading = false;
      assistantMsg.waiting = false;
      flushTypewriter();
      if (!assistantMsg.content.trim()) {
        assistantMsg.failed = true;
      } else {
        apiMessages.push(
          {role: 'user', content: question},
          {role: 'assistant', content: assistantMsg.content}
        );
      }
    },
    onError: (message) => {
      assistantMsg.loading = false;
      assistantMsg.waiting = false;
      flushTypewriter();
      if (message === '已停止生成') {
        if (assistantMsg.content.trim()) {
          apiMessages.push(
            {role: 'user', content: question},
            {role: 'assistant', content: assistantMsg.content}
          );
        } else if (messages.value[messages.value.length - 1] === assistantMsg) {
          messages.value.pop();
        }
        return;
      }
      const fallback = explainFromLibrary(question);
      if (!assistantMsg.content.trim() && fallback) {
        assistantMsg.content = fallback;
        assistantMsg.failed = false;
        assistantMsg.local = true;
        apiMessages.push({role: 'user', content: question});
        return;
      }
      if (!assistantMsg.content) assistantMsg.failed = true;
      showFailToast(message === '咨询服务暂时不可用' ? '咨询服务暂时不可用，请确认后端已启动' : message);
    },
  });
}

async function loadSession(id: number) {
  try {
    const list = await getSessionMessages(id);
    messages.value = [];
    apiMessages.length = 0;
    sessionId.value = id;
    sessionStorage.setItem('fazhitong_last_chat', `/chat/${id}`);
    for (const item of list) {
      messages.value.push({uid: nextUid(), role: 'user', content: item.question});
      messages.value.push({
        uid: nextUid(),
        role: 'assistant',
        content: item.answer,
        historyId: item.id,
        feedback: item.feedback,
        references: item.references,
      });
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

onActivated(() => {
  consumeLaunch().then((consumed) => {
    if (consumed) return;
    sessionStorage.setItem(
      'fazhitong_last_chat',
      sessionId.value ? `/chat/${sessionId.value}` : '/ask'
    );
    if (streaming.value || messages.value.length > 0) scrollToBottom();
  });
});

// 离开页面（keep-alive 下走 onDeactivated）时把打字机队列一次打完并停表。
// ★ 为什么是 flush 而不是 stop：stop 会丢掉队列里还没打出来的字，
//   用户回来会看到半截回答；flush 是「立刻打完再停表」，既不丢字，
//   也不会让定时器在后台空转、反复对已离开的页面调 scrollToBottom。
onDeactivated(() => {
  flushTypewriter();
});

// ===== 键盘弹起时输入栏被遮挡 =====
// 键盘弹出时布局视口（100dvh）不变，变的是 visualViewport，
// 所以底部输入栏会被键盘盖住。把真实可视高度写成 CSS 变量，聊天容器按它定高，
// 输入栏就贴在键盘上方。
// ★ 只在键盘确实占位时才写变量：没键盘时走原来的 100dvh，
//   保证不触发这个逻辑时布局与改动前一模一样。
function syncViewportHeight() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  if (!viewport) return;
  const keyboardHeight = window.innerHeight - viewport.height;
  if (keyboardHeight > 80) {
    root.style.setProperty('--fz-vvh', `${Math.round(viewport.height)}px`);
  } else {
    root.style.removeProperty('--fz-vvh');
  }
}

onMounted(() => {
  syncViewportHeight();
  // resize：键盘弹起/收起；scroll：iOS 上键盘弹起时视觉视口还会滚动
  window.visualViewport?.addEventListener('resize', syncViewportHeight);
  window.visualViewport?.addEventListener('scroll', syncViewportHeight);
});

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', syncViewportHeight);
  window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
  // 变量还原，避免影响别的页面
  document.documentElement.style.removeProperty('--fz-vvh');
});

// 输入框聚焦后延迟滚到底：键盘弹起需要一点时间，立刻滚等于没滚
function onInputFocus() {
  window.setTimeout(scrollToBottom, 300);
}

watch(
  () => route.params.sessionId,
  (value) => {
    if (sessionStorage.getItem('fazhitong_force_new') === '1') return;
    const id = Number(value) || null;
    if (streaming.value) {
      if (id) sessionId.value = id;
      return;
    }
    if (id && id === sessionId.value && messages.value.length > 0) return;
    if (id) loadSession(id);
  },
  {immediate: true}
);
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* 键盘弹起时 --fz-vvh 会被写成 visualViewport 的真实高度（见 syncViewportHeight）；
     没有键盘时这个变量不存在，就退回 100dvh，与改动前完全一致。 */
  height: var(--fz-vvh, 100dvh);
  background: var(--fz-bg, #f3f5f7);
}
.nav-new {
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 14px;
  padding: 0;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}
.empty-card {
  margin: 24px 8px;
  padding: 20px 16px;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 12px;
}
.empty-label {
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.empty-desc {
  margin: 6px 0 14px;
  font-size: 15px;
  color: var(--fz-text, #323233);
}
.suggest-item {
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 8px;
  border: 1px solid var(--fz-border, #ebedf0);
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--fz-primary, #0f9d8f);
}
.suggest-item:active {
  background: var(--fz-primary-soft, #e6f7f5);
}
.msg-row {
  display: flex;
  margin-bottom: 14px;
}
.msg-row.user {
  justify-content: flex-end;
}
.bubble {
  max-width: 86%;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}
.msg-row.user .bubble {
  background: var(--fz-primary-soft, #e6f7f5);
  color: var(--fz-dark, #0f2d40);
  border: 1px solid #b7e8e1;
  white-space: pre-wrap;
}
.msg-row.assistant .bubble {
  background: #fff;
  color: #323233;
  border: 1px solid var(--fz-border, #ebedf0);
}
.ai-brand {
  font-size: 12px;
  color: var(--fz-muted, #969799);
  margin-bottom: 4px;
}
.fail-title {
  font-weight: 600;
  color: var(--fz-error, #ee0a24);
}
.fail-desc {
  font-size: 13px;
  color: var(--fz-muted, #969799);
  margin: 4px 0 8px;
}
.fail-block .regen-link {
  margin-top: 8px;
}
.msg-actions {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.plain {
  white-space: pre-wrap;
}
.regen-link {
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 13px;
  padding: 0;
}
.regen-link:disabled {
  opacity: 0.5;
}
.regen-link.active {
  font-weight: 700;
}
.cursor {
  display: inline-block;
  animation: blink 0.8s infinite;
}
.waiting-tip {
  margin-top: 4px;
  font-size: 13px;
  color: #969799;
}
.waiting-tip::after {
  display: inline-block;
  width: 1.5em;
  animation: dots 1.2s steps(4, end) infinite;
  content: '';
}
@keyframes dots {
  0% { content: ''; }
  25% { content: '·'; }
  50% { content: '··'; }
  75% { content: '···'; }
}
@keyframes blink {
  50% { opacity: 0; }
}
.refs {
  margin-top: 8px;
  border-top: 1px dashed #ebedf0;
  padding-top: 6px;
}
.refs-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.refs-toggle {
  font-size: 13px;
  color: var(--fz-primary, #0f9d8f);
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
  border: 1px solid var(--fz-border, #ebedf0);
}
.ref-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fz-dark, #0f2d40);
  margin-bottom: 4px;
}
.ref-text {
  font-size: 12px;
  color: #646566;
  white-space: pre-wrap;
}
.ref-text.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ref-more {
  margin-top: 4px;
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 12px;
  padding: 0;
}
.input-bar {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid var(--fz-border, #ebedf0);
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
.disclaimer {
  margin: 0 0 6px;
  text-align: center;
  font-size: 11px;
  color: var(--fz-muted, #969799);
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
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
