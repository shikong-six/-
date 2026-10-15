<!-- 智能问答：空状态建议问 / 历史日期分组 / 气泡来源 / Loading / 重新生成 -->
<template>
  <div class="chat-page">
    <aside class="session-aside">
      <el-button class="new-chat-btn" type="primary" plain @click="startNewChat">
        <el-icon><Plus /></el-icon>&nbsp;+ 新建对话
      </el-button>
      <div class="session-list" v-loading="sessionsLoading">
        <template v-for="group in groupedSessions" :key="group.label">
          <div class="session-group-label">{{ group.label }}</div>
          <div
            v-for="session in group.items"
            :key="session.id"
            :class="['session-item', { active: session.id === currentSessionId }]"
            @click="openSession(session.id)"
          >
            <el-icon class="session-icon"><ChatLineRound /></el-icon>
            <span class="session-title">{{ session.title }}</span>
            <el-dropdown
              trigger="click"
              @command="(cmd: string) => onSessionCommand(cmd, session)"
              @click.stop
            >
              <span class="session-more" @click.stop>•••</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
        <el-empty v-if="!sessionsLoading && sessions.length === 0" description="暂无会话" :image-size="60" />
      </div>
    </aside>

    <div class="chat-main">
      <h2 class="page-title">AI 法律咨询</h2>

      <div class="message-list" ref="messageListRef" v-loading="sessionLoading" element-loading-text="正在加载会话…">
        <div v-if="!sessionLoading && messages.length === 0" class="chat-empty">
          <div class="empty-card">
            <div class="empty-label">AI 法律咨询</div>
            <p class="empty-desc">我可以帮你检索法律知识并分析相关问题</p>
            <div class="suggest-list">
              <button
                v-for="(q, i) in suggestQuestions"
                :key="i"
                class="suggest-item"
                @click="askSuggestion(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>
          <p class="empty-hint">点击上方问题直接开始咨询</p>
        </div>

        <div v-for="(msg, index) in messages" :key="index" :class="['message-item', msg.role]">
          <div class="message-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div class="message-content" :class="{ error: msg.error }">
            <div v-if="msg.role === 'assistant'" class="ai-brand">法制通 AI</div>
            <div v-if="msg.role === 'assistant' && msg.error" class="error-block">
              <div class="error-title">回答生成失败</div>
              <div class="error-desc">请稍后重试</div>
              <button class="regen-text" @click="regenerateAt(index)">重新生成</button>
            </div>
            <template v-else>
              <div v-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <template v-else>{{ msg.content }}</template>
            </template>

            <div v-if="msg.references && msg.references.length > 0" class="message-references">
              <div class="ref-title">相关法律依据</div>
              <div
                v-for="(reference, refIndex) in msg.references"
                :key="refIndex"
                class="reference-item"
                @click="openReference(reference)"
              >
                <div class="ref-name">《{{ lawDisplayName(reference.docName) }}》</div>
                <div class="ref-snippet">{{ snippetOf(reference.text) }}</div>
                <span class="ref-link">查看原文 →</span>
              </div>
            </div>

            <div v-if="msg.role === 'assistant' && msg.content && !msg.error" class="action-row">
              <button class="regen-btn" :disabled="loading" @click="regenerateAt(index)">重新生成</button>
              <div v-if="msg.id" class="feedback-row">
                <el-icon :class="['feedback-btn', {active: msg.feedback === 1}]" title="点赞" @click="doFeedback(msg, 1)"><CaretTop /></el-icon>
                <el-icon :class="['feedback-btn', {active: msg.feedback === -1}]" title="点踩" @click="doFeedback(msg, -1)"><CaretBottom /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading && !streamingStarted" class="streaming-hint">
        {{ statusText || '正在检索法律知识库...' }}
      </div>

      <div class="input-area">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="3"
          placeholder="请输入你的法律问题......"
          :disabled="loading"
          @keydown="onInputKeydown"
        />
        <el-button
          v-if="!loading"
          type="primary"
          :disabled="!inputMessage.trim()"
          class="send-btn"
          @click="sendMessage()"
        >
          发送
        </el-button>
        <el-button
          v-else
          type="danger"
          class="send-btn stop-btn"
          @click="stopGeneration()"
        >
          停止
        </el-button>
      </div>

      <el-dialog v-model="refDialogVisible" :title="refDialogTitle" width="600px">
        <div class="reference-dialog-text">{{ activeReference?.text }}</div>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, nextTick, onMounted, onActivated, onDeactivated, onBeforeUnmount, watch, reactive, computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {marked} from 'marked'
import DOMPurify from 'dompurify'
import {
  sendMessageStream,
  getSessions,
  getSessionMessages,
  setFeedback,
  renameSession,
  deleteSession,
  lawDisplayName
} from '../services/chat'
import type {ChatSession, SessionMessage, Reference} from '../services/chat'
import {CaretTop, CaretBottom, Plus, ChatLineRound} from '@element-plus/icons-vue'

// keep-alive 按组件名缓存：切走其他页再回来，消息/流式现场不丢
defineOptions({name: 'ChatView'})

interface Message {
  role: 'user' | 'assistant'
  content: string
  id?: number | null
  feedback?: number | null
  references?: Reference[]
  error?: boolean
}

const route = useRoute()
const router = useRouter()

const suggestQuestions = [
  '经济补偿金怎么算？',
  '公司不签劳动合同怎么办？',
  '试用期被辞退怎么办？',
  '加班费应该怎么计算？'
]

const messages = ref<Message[]>([])
const inputMessage = ref('')
const loading = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const sessions = ref<ChatSession[]>([])
const sessionsLoading = ref(false)
const currentSessionId = ref<number | null>(Number(route.params.sessionId) || null)
const sessionLoading = ref(false)

const refDialogVisible = ref(false)
const activeReference = ref<Reference | null>(null)
const refDialogTitle = ref('')
const openReference = (reference: Reference) => {
  activeReference.value = reference
  refDialogTitle.value = `《${lawDisplayName(reference.docName)}》`
  refDialogVisible.value = true
}

function snippetOf(text: string): string {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  return t.length > 48 ? t.slice(0, 48) + '…' : t
}

const renderMarkdown = (text: string): string => {
  return DOMPurify.sanitize(marked.parse(text || '', {async: false}) as string)
}

const statusText = ref('')
const streamingStarted = ref(false)
// 当前这条流式请求。点停止或离开聊天页时 abort，后端才会停掉 Kimi。
let streamAbort: AbortController | null = null

function stopGeneration() {
  streamAbort?.abort()
}

let typeQueue = ''
let typeTimer: ReturnType<typeof setInterval> | null = null
let typingTarget: Message | null = null

const feedTypewriter = (msg: Message, text: string) => {
  typeQueue += text
  typingTarget = msg
  if (typeTimer) return
  typeTimer = setInterval(() => {
    if (!typingTarget || !messages.value.includes(typingTarget)) {
      stopTypewriter()
      return
    }
    typingTarget.content += typeQueue.slice(0, 2)
    typeQueue = typeQueue.slice(2)
    scrollToBottom()
    if (!typeQueue) stopTypewriter()
  }, 30)
}

const stopTypewriter = () => {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = null
  }
  typingTarget = null
  typeQueue = ''
}

const flushTypewriter = () => {
  if (typingTarget && typeQueue) {
    typingTarget.content += typeQueue
  }
  stopTypewriter()
}

let scrollPending = false
const scrollToBottom = async () => {
  if (scrollPending) return
  scrollPending = true
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
  scrollPending = false
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const groupedSessions = computed(() => {
  const today = dayStart(new Date())
  const yesterday = today - 86400000
  const groups: {label: string; items: ChatSession[]}[] = [
    {label: '今天', items: []},
    {label: '昨天', items: []},
    {label: '更早', items: []}
  ]
  for (const s of sessions.value) {
    const t = dayStart(new Date(s.updatedAt))
    if (t >= today) groups[0].items.push(s)
    else if (t >= yesterday) groups[1].items.push(s)
    else groups[2].items.push(s)
  }
  return groups.filter((g) => g.items.length > 0)
})

const loadSessions = async () => {
  sessionsLoading.value = true
  try {
    sessions.value = await getSessions()
  } catch (error: any) {
    ElMessage.error('加载会话列表失败：' + error.message)
  } finally {
    sessionsLoading.value = false
  }
}

const loadSession = async (sessionId: number) => {
  sessionLoading.value = true
  try {
    const list: SessionMessage[] = await getSessionMessages(sessionId)
    messages.value = []
    for (const item of list) {
      messages.value.push({role: 'user', content: item.question})
      messages.value.push({
        role: 'assistant',
        content: item.answer,
        id: item.id,
        feedback: item.feedback,
        references: item.references,
      })
    }
    scrollToBottom()
  } catch (error: any) {
    ElMessage.error('加载会话失败：' + error.message)
  } finally {
    sessionLoading.value = false
  }
}

watch(
  () => route.params.sessionId,
  (value) => {
    const id = Number(value) || null
    // 生成中：只同步会话 ID，避免重拉历史冲掉正在打字的内容
    if (loading.value) {
      if (id) currentSessionId.value = id
      return
    }
    // keep-alive 回来：同一会话且本地已有消息，不再清空重载
    if (id && id === currentSessionId.value && messages.value.length > 0) {
      return
    }
    currentSessionId.value = id
    if (id) {
      loadSession(id)
    } else if (!loading.value) {
      // 仅在非生成中进入真正的「新对话」时清空
      messages.value = []
    }
  }
)

watch(
  currentSessionId,
  (id) => {
    sessionStorage.setItem('fazhitong_last_chat', id ? `/chat/${id}` : '/chat')
  },
  {immediate: true}
)

onMounted(() => {
  loadSessions()
  if (currentSessionId.value) {
    loadSession(currentSessionId.value)
  }
  const pending = sessionStorage.getItem('fazhitong_pending_question')
  if (pending) {
    sessionStorage.removeItem('fazhitong_pending_question')
    if (!currentSessionId.value) {
      inputMessage.value = pending
      sendMessage()
    }
  }
})

onDeactivated(() => {
  stopGeneration()
})

onBeforeUnmount(() => {
  stopGeneration()
})

// keep-alive 激活时刷新侧栏，并保证「AI咨询」入口能回到当前会话
onActivated(() => {
  sessionStorage.setItem(
    'fazhitong_last_chat',
    currentSessionId.value ? `/chat/${currentSessionId.value}` : '/chat'
  )
  loadSessions()
  if (loading.value || messages.value.length > 0) {
    scrollToBottom()
  }
})

const openSession = (sessionId: number) => {
  if (loading.value) return
  if (sessionId === currentSessionId.value) return
  router.push(`/chat/${sessionId}`)
}

const startNewChat = () => {
  if (loading.value) {
    ElMessage.info('正在生成回答，请稍候再开启新对话')
    return
  }
  messages.value = []
  inputMessage.value = ''
  if (!currentSessionId.value) return
  router.push('/chat')
}

async function onSessionCommand(cmd: string, session: ChatSession) {
  if (cmd === 'rename') {
    try {
      const {value} = await ElMessageBox.prompt('请输入新的会话标题', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: session.title,
        inputValidator: (v: string) => (v && v.trim() ? true : '标题不能为空')
      })
      await renameSession(session.id, value.trim())
      ElMessage.success('已重命名')
      await loadSessions()
    } catch (error: any) {
      if (error !== 'cancel' && error?.message) ElMessage.error(error.message)
    }
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除会话「${session.title}」吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteSession(session.id)
      ElMessage.success('已删除')
      if (currentSessionId.value === session.id) {
        messages.value = []
        router.replace('/chat')
      }
      await loadSessions()
    } catch {
      /* cancel */
    }
  }
}

const doFeedback = async (msg: Message, value: number) => {
  if (msg.id == null) return
  const next = msg.feedback === value ? 0 : value
  try {
    await setFeedback(msg.id, next)
    msg.feedback = next
    ElMessage.success(next === 1 ? '已点赞' : next === -1 ? '已点踩' : '已取消反馈')
  } catch (error: any) {
    ElMessage.error('反馈失败：' + error.message)
  }
}

function isValidQuestionText(text: string): boolean {
  const meaningful = text.replace(/[\p{P}\p{S}\p{Z}\p{C}]/gu, '')
  if (meaningful.length < 2) return false
  if (meaningful.length >= 4 && /^(.)\1+$/u.test(meaningful)) return false
  if (!/[一-鿿]/.test(text) && meaningful.length >= 8) return false
  return true
}

function askSuggestion(q: string) {
  if (loading.value) return
  inputMessage.value = q
  sendMessage()
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

/** 重新生成：找到该 AI 消息前一条用户问题，截断后续后重发 */
function regenerateAt(assistantIndex: number) {
  if (loading.value) return
  let userIndex = -1
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userIndex = i
      break
    }
  }
  if (userIndex < 0) return
  const question = messages.value[userIndex].content
  messages.value = messages.value.slice(0, userIndex)
  inputMessage.value = question
  sendMessage()
}

const sendMessage = async () => {
  const text = inputMessage.value.trim()
  if (!text || loading.value) return
  if (!isValidQuestionText(text)) {
    ElMessage.warning('请输入有效的法律问题，描述你遇到的具体情况')
    return
  }
  messages.value.push({role: 'user', content: text})
  scrollToBottom()
  inputMessage.value = ''

  const assistantMessage: Message = reactive({role: 'assistant', content: '', error: false})
  messages.value.push(assistantMessage)

  const controller = new AbortController()
  streamAbort = controller
  flushTypewriter()
  statusText.value = '正在检索法律知识库...'
  streamingStarted.value = false
  loading.value = true
  try {
    await sendMessageStream(messages.value.slice(0, -1), currentSessionId.value, {
      onStatus: (message: string) => {
        statusText.value = message || '正在生成回答...'
      },
      onToken: (token: string) => {
        if (!streamingStarted.value) {
          streamingStarted.value = true
          statusText.value = '正在生成回答...'
        }
        feedTypewriter(assistantMessage, token)
      },
      onReferences: (refs: Reference[]) => {
        assistantMessage.references = refs
        scrollToBottom()
      },
      onSession: (sessionId: number | null, historyId: number | null) => {
        assistantMessage.id = historyId
        if (sessionId && !currentSessionId.value) {
          currentSessionId.value = sessionId
          sessionStorage.setItem('fazhitong_last_chat', `/chat/${sessionId}`)
          // 人还在聊天页才改 URL；人在别的页时不要强行拽回来
          if (route.path.startsWith('/chat')) {
            router.replace(`/chat/${sessionId}`)
          }
        }
        loadSessions()
      }
    }, controller.signal)
    flushTypewriter()
    if (!assistantMessage.content.trim()) {
      assistantMessage.error = true
      assistantMessage.content = ''
    }
  } catch (error: any) {
    // 手动停止：留下已经打出来的字，空回复就撤掉这个气泡，不当成生成失败
    if (controller.signal.aborted || error?.name === 'AbortError') {
      flushTypewriter()
      if (!assistantMessage.content.trim()) {
        const index = messages.value.indexOf(assistantMessage)
        if (index >= 0) messages.value.splice(index, 1)
      }
      return
    }
    stopTypewriter()
    assistantMessage.error = true
    assistantMessage.content = ''
    scrollToBottom()
  } finally {
    if (streamAbort === controller) streamAbort = null
    loading.value = false
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  gap: 16px;
  height: calc(100vh - 40px);
  max-width: var(--fz-page-max, 1400px);
  margin: 0 auto;
}
.session-aside {
  width: 260px;
  flex-shrink: 0;
  background-color: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.new-chat-btn {
  margin-bottom: 12px;
  --el-button-text-color: var(--fz-primary, #0f9d8f);
  --el-button-border-color: var(--fz-primary, #0f9d8f);
}
.session-list {
  flex: 1;
  overflow-y: auto;
}
.session-group-label {
  font-size: 12px;
  color: var(--fz-muted, #909399);
  padding: 8px 10px 4px;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--fz-text-secondary, #606266);
  margin-bottom: 4px;
  position: relative;
}
.session-item:hover {
  background-color: #f4f4f5;
}
.session-item.active {
  background-color: var(--fz-primary-soft, #e6f7f5);
  color: var(--fz-primary, #0f9d8f);
}
.session-icon {
  flex-shrink: 0;
}
.session-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.session-more {
  opacity: 0;
  font-size: 14px;
  color: var(--fz-muted, #909399);
  padding: 0 4px;
  flex-shrink: 0;
}
.session-item:hover .session-more,
.session-item.active .session-more {
  opacity: 1;
}
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: var(--fz-chat-max, 1200px);
}
.page-title {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: var(--fz-title, 28px);
  font-weight: 700;
  color: var(--fz-text, #303133);
}
.chat-empty {
  text-align: center;
  padding-top: 48px;
}
.empty-card {
  max-width: 520px;
  margin: 0 auto;
  background: #f7f8fa;
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 28px 24px;
  text-align: left;
}
.empty-label {
  font-size: 13px;
  color: var(--fz-muted, #909399);
  margin-bottom: 6px;
}
.empty-desc {
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--fz-text, #303133);
}
.suggest-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.suggest-item {
  text-align: left;
  border: 1px solid var(--fz-border, #E5E7EB);
  background: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--fz-primary, #0f9d8f);
  cursor: pointer;
}
.suggest-item:hover {
  border-color: var(--fz-primary, #0f9d8f);
  background: var(--fz-primary-soft, #e6f7f5);
}
.empty-hint {
  margin-top: 14px;
  font-size: 13px;
  color: var(--fz-muted, #909399);
}
.message-list {
  flex: 1;
  overflow-y: auto;
  background-color: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 20px;
  margin-bottom: 12px;
}
.message-item {
  display: flex;
  margin-bottom: 16px;
}
.message-item.user {
  flex-direction: row-reverse;
}
.message-role {
  width: 40px;
  height: 40px;
  line-height: 40px;
  text-align: center;
  border-radius: 50%;
  color: #fff;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: bold;
}
.message-item.user .message-role {
  background: linear-gradient(135deg, #14b8a6, #0f9d8f);
}
.message-item.assistant .message-role {
  background: linear-gradient(135deg, #0f2d40, #16324a);
}
.message-content {
  max-width: 70%;
  margin: 0 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: #f7f8fa;
  border: 1px solid var(--fz-border, #E5E7EB);
  line-height: 1.6;
}
.message-item.user .message-content {
  background: var(--fz-primary-soft, #e6f7f5);
  border-color: #b7e8e1;
}
.ai-brand {
  font-size: 12px;
  color: var(--fz-muted, #909399);
  margin-bottom: 6px;
}
.error-block .error-title {
  font-weight: 600;
  color: var(--fz-error, #f56c6c);
}
.error-block .error-desc {
  font-size: 13px;
  color: var(--fz-muted, #909399);
  margin: 4px 0 8px;
}
.regen-text,
.regen-btn {
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.regen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.markdown-body :deep(p) {
  margin: 0 0 8px;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(strong) {
  color: var(--fz-text, #303133);
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 8px 0;
  font-size: 16px;
}
.message-references {
  margin-top: 10px;
  border-top: 1px dashed var(--fz-border, #E5E7EB);
  padding-top: 10px;
}
.ref-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fz-text, #303133);
  margin-bottom: 8px;
}
.reference-item {
  background: #fff;
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.reference-item:hover {
  border-color: var(--fz-primary, #0f9d8f);
}
.ref-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fz-dark, #0f2d40);
}
.ref-snippet {
  font-size: 12px;
  color: var(--fz-muted, #909399);
  margin: 4px 0;
}
.ref-link {
  font-size: 12px;
  color: var(--fz-primary, #0f9d8f);
}
.action-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.feedback-row {
  display: flex;
  gap: 12px;
}
.feedback-btn {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 16px;
}
.feedback-btn:hover,
.feedback-btn.active {
  color: var(--fz-primary, #0f9d8f);
}
.reference-dialog-text {
  white-space: pre-wrap;
  line-height: 1.8;
  color: var(--fz-text, #303133);
  max-height: 400px;
  overflow-y: auto;
}
.streaming-hint {
  color: var(--fz-muted, #909399);
  font-size: 13px;
  margin-bottom: 8px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 12px;
  border: 1px solid var(--fz-border, #E5E7EB);
}
.input-area {
  display: flex;
  gap: 12px;
  background: #f7f8fa;
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 12px;
}
.input-area .el-textarea {
  flex: 1;
}
.send-btn {
  align-self: flex-end;
}
</style>
