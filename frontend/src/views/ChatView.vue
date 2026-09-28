<!-- 智能问答页面：左侧会话侧栏 + 右侧对话区，支持加载历史会话继续多轮问答 -->
<template>
  <div class="chat-page">
    <!-- ===== 左侧会话侧栏 ===== -->
    <aside class="session-aside">
      <!-- 新对话按钮：清空当前对话，回到 /chat -->
      <el-button class="new-chat-btn" type="primary" plain @click="startNewChat">
        <el-icon><Plus /></el-icon>&nbsp;开启新对话
      </el-button>
      <!-- 会话列表 -->
      <div class="session-list" v-loading="sessionsLoading">
        <!-- 单个会话项：点击加载该会话继续对话 -->
        <div
          v-for="session in sessions"
          :key="session.id"
          :class="['session-item', { active: session.id === currentSessionId }]"
          @click="openSession(session.id)"
        >
          <el-icon class="session-icon"><ChatLineRound /></el-icon>
          <!-- 会话标题（首问前 20 字） -->
          <span class="session-title">{{ session.title }}</span>
        </div>
        <!-- 没有会话时的空状态 -->
        <el-empty v-if="!sessionsLoading && sessions.length === 0" description="暂无会话" :image-size="60" />
      </div>
    </aside>

    <!-- ===== 右侧对话主区 ===== -->
    <div class="chat-main">
      <!-- 页面标题 -->
      <h2 class="page-title">智能问答</h2>

      <!-- 聊天消息列表区域 -->
      <div class="message-list" ref="messageListRef" v-loading="sessionLoading" element-loading-text="正在加载会话…">
        <!-- 空会话时的引导语 -->
        <div v-if="!sessionLoading && messages.length === 0" class="chat-empty">
          <p class="chat-empty-title">您好，我是法制通法律助手</p>
          <p class="chat-empty-desc">请描述您遇到的法律问题，我会依据知识库中的法条为您解答</p>
        </div>
        <!-- 遍历消息数组，渲染每条消息 -->
        <div v-for="(msg,index) in messages" :key="index" :class="['message-item',msg.role]">
          <!-- 消息角色标签：用户显示"我"，AI 显示天平图标 -->
          <div class="message-role">
            {{ msg.role==='user' ?'我':'AI' }}
          </div>
          <!-- 消息内容 -->
          <div class="message-content">
            <!--AI 消息用 v-html 渲染 Markdown（marked 转成 HTML），用户消息纯文本即可-->
            <div v-if="msg.role==='assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <template v-else>{{ msg.content }}</template>
            <!--AI消息下方展示引用来源，用户消息没有引用就不显示-->
            <div v-if="msg.references&&msg.references.length>0" class="message-references">
              <!--单条引用：可点击，点击弹出法条原文弹窗-->
              <div v-for="(reference,refIndex) in msg.references" :key="refIndex" class="reference-item" @click="openReference(reference)">
                引用:《{{ reference.docName }}》第{{ reference.chunkIndex+1 }}块
              </div>
            </div>
            <!--点赞/点踩：仅 AI 消息且已入库（有 id）时显示；再点一次可取消-->
            <div v-if="msg.role==='assistant'&&msg.id" class="feedback-row">
              <!--点赞按钮：已赞时高亮-->
              <el-icon :class="['feedback-btn',{active:msg.feedback===1}]" title="点赞" @click="doFeedback(msg,1)"><CaretTop /></el-icon>
              <!--点踩按钮：已踩时高亮-->
              <el-icon :class="['feedback-btn',{active:msg.feedback===-1}]" title="点踩" @click="doFeedback(msg,-1)"><CaretBottom /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 流式等待提示：检索阶段显示，首 token 开始输出后隐藏（能看到逐字输出本身就是反馈） -->
      <div v-if="loading && !streamingStarted" class="streaming-hint">{{ statusText || '正在检索法律知识库…' }}</div>

      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 上传文档按钮：弹出上传弹窗，边问边传 -->
        <el-button class="attach-btn" title="上传法律文档" @click="uploadDialogVisible = true">
          <el-icon><Paperclip /></el-icon>
        </el-button>
        <!-- 输入框，按回车也能发送 -->
        <el-input v-model="inputMessage" type="textarea" :rows="3" placeholder="请输入您的问题，例如：劳动合同到期不续签怎么赔偿？"
        @keyup.enter="sendMessage"/>
        <el-button type="primary" :loading="loading" :disabled="loading" class="send-btn" @click="sendMessage">
          发送
        </el-button>
      </div>

      <!-- 文档上传弹窗：上传后自动解析入库，可直接就该文档提问 -->
      <el-dialog v-model="uploadDialogVisible" title="上传法律文档" width="480px">
        <!-- 文件选择：不自动上传，选完文件后手动点按钮（与知识库管理页同一套路） -->
        <el-upload
          drag
          action=""
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处，或 <em>点击选择</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 PDF、Word、TXT，单个文件不超过 20MB；上传后自动解析、分块、向量化入库
            </div>
          </template>
        </el-upload>
        <!-- 已选文件 + 上传按钮 -->
        <div class="upload-actions">
          <span v-if="selectedFile" class="selected-file">已选择：{{ selectedFile.name }}</span>
          <el-button
            type="primary"
            :loading="uploading"
            :disabled="!selectedFile"
            @click="doUpload"
          >
            {{ uploading ? '正在解析入库…' : '上传并入库' }}
          </el-button>
        </div>
      </el-dialog>

      <!-- 引用来源弹窗：展示被点击引用的法条原文 -->
      <el-dialog v-model="refDialogVisible" :title="refDialogTitle" width="600px">
        <!-- 法条原文，保留换行格式 -->
        <div class="reference-dialog-text">{{ activeReference?.text }}</div>
      </el-dialog>
    </div>
  </div>
</template>
<script setup lang="ts">
// 从 vue 中引入响应式 API、nextTick(等DOM更新后再滚动)和生命周期钩子
import {ref,nextTick,onMounted,watch,reactive} from 'vue'
// 引入路由：读会话 ID 参数、跳转
import {useRoute,useRouter} from 'vue-router'
// 引入 Element Plus 的消息提示
import {ElMessage} from 'element-plus'
// 引入 marked：把 Kimi 返回的 Markdown 文本转成 HTML
import {marked} from 'marked'
// 引入 DOMPurify：v-html 渲染前消毒，防 XSS（AI 返回的内容不可信）
import DOMPurify from 'dompurify'
// 引入聊天 API：流式发送 + 会话相关接口 + 反馈接口
import {sendMessageStream,getSessions,getSessionMessages,setFeedback} from '../services/chat'
// 引入会话类型
import type{ChatSession,SessionMessage,Reference} from '../services/chat'
// 引入点赞/点踩图标
import {CaretTop,CaretBottom,UploadFilled,Paperclip} from '@element-plus/icons-vue'
// 引入文档上传接口（边问边传：AI 咨询页内直接上传入库）
import {uploadDocument} from '../services/knowledge'

// 当前路由对象（取 :sessionId 参数）
const route=useRoute()
// 路由跳转（新对话/切换会话时改 URL）
const router=useRouter()

// 定义消息类型
interface Message{
    role: 'user'|'assistant' // 消息角色：用户或 AI
    content: string // 消息内容
    id?: number|null // 历史记录 ID（入库后才有；点赞/点踩定位用）
    feedback?: number|null // 用户反馈：1赞 -1踩 null未反馈
    references?:Reference[]//AI消息附带的引用来源(用户消息没有，所以可选)
}

// 消息列表，初始为空
const messages=ref<Message[]>([]);
// 输入框绑定的内容
const inputMessage=ref('');
// 是否等待 AI 回复
const loading=ref(false)

// ===== 文档上传弹窗（边问边传） =====
// 弹窗显隐
const uploadDialogVisible=ref(false)
// 当前选中的文件（el-upload 封装对象的 .raw 才是真正的 File）
const selectedFile=ref<File|null>(null)
// 上传/解析中标记（防重复提交 + 按钮 loading）
const uploading=ref(false)

// 选中文件回调：只暂存，不自动上传
const handleFileChange=(uploadFile:any)=>{
  selectedFile.value=uploadFile.raw
}

// 上传并入库：后端自动完成 解析 → 分块 → 向量化 → 双写
const doUpload=async()=>{
  if(!selectedFile.value||uploading.value)return
  uploading.value=true
  try{
    const result=await uploadDocument(selectedFile.value)
    // 成功后提示分块数，引导用户直接就该文档提问
    ElMessage.success(`《${result.filename}》已入库（${result.chunkCount} 个分块），现在可以直接提问它的内容`)
    // 关弹窗并复位，方便下次上传
    uploadDialogVisible.value=false
    selectedFile.value=null
  }catch(error:any){
    ElMessage.error('上传失败：'+(error?.message??'未知错误'))
  }finally{
    uploading.value=false
  }
}
// 消息列表容器的引用（滚动用）
const messageListRef=ref<HTMLElement|null>(null)

// ===== 会话相关状态 =====
// 会话列表数据
const sessions=ref<ChatSession[]>([]);
// 会话列表加载中标记
const sessionsLoading=ref(false);
// 当前会话 ID（从路由参数解析；无参数 = 新对话）
const currentSessionId=ref<number|null>(Number(route.params.sessionId)||null);
// 加载某个历史会话的消息时显示
const sessionLoading=ref(false);

// 引用弹窗相关状态
const refDialogVisible=ref(false) //弹窗是否显示
const activeReference=ref<Reference|null>(null) //当前展示的引用
// 弹窗标题：文档名 + 块号
const refDialogTitle=ref('')
// 打开引用弹窗：记录被点击的引用并弹出
const openReference=(reference:Reference)=>{
    activeReference.value=reference
    refDialogTitle.value=`《${reference.docName}》第${reference.chunkIndex+1}块`
    refDialogVisible.value=true
}

// 把 Markdown 文本转成 HTML（async:false 表示同步返回字符串）
// DOMPurify 消毒：v-html 直接注入 AI 返回的内容，不消毒就是 XSS 敞口
const renderMarkdown=(text:string):string=>{
    return DOMPurify.sanitize(marked.parse(text,{async:false})as string)
}

// 流式等待期的进度文案（status 事件更新；首 token 到达后整个提示隐藏）
const statusText=ref('')
// 首 token 是否已到达（到了就隐藏等待提示——逐字输出本身就是反馈）
const streamingStarted=ref(false)

// ===== 打字机效果 =====
// Kimi API 按块突发下发（一次 8 个字同一毫秒到达），直接渲染会像"一大块冒出"；
// token 先存队列，定时器按固定节奏逐字弹出，视觉上匀速输出
let typeQueue='';
let typeTimer: ReturnType<typeof setInterval>|null=null;
let typingTarget: Message|null=null;

// 喂字：token 入队，节奏由定时器控制
const feedTypewriter=(msg: Message, text: string)=>{
  typeQueue+=text;
  typingTarget=msg;
  if(typeTimer)return;
  typeTimer=setInterval(()=>{
    // 目标被清出消息列表（切换会话/新对话）就停掉，避免给游离对象喂字
    if(!typingTarget||!messages.value.includes(typingTarget)){
      stopTypewriter();
      return;
    }
    // 每 30ms 吐出 2 个字（约 60 字/秒，接近真人打字速度）
    typingTarget.content+=typeQueue.slice(0,2);
    typeQueue=typeQueue.slice(2);
    scrollToBottom();
    if(!typeQueue)stopTypewriter();
  },30);
};

// 停掉定时器并复位（队列剩余内容是否保留由调用方决定）
const stopTypewriter=()=>{
  if(typeTimer){clearInterval(typeTimer);typeTimer=null;}
  typingTarget=null;
  typeQueue='';
};

// 冲刷：队列里剩余的字一次性倒完（流结束/出错时调用，保证内容完整）
const flushTypewriter=()=>{
  if(typingTarget&&typeQueue){typingTarget.content+=typeQueue;}
  stopTypewriter();
};

//滚动到消息列表底部(新消息出现时调用)
//节流：同一帧内只滚一次。流式输出时 token 高频到达，每次都 nextTick+滚动会浪费渲染开销
let scrollPending=false;
const scrollToBottom=async ()=>{
  //已有待执行的滚动，直接丢弃本次调用（最后那次滚动会看到最新 DOM）
  if(scrollPending)return;
  //标记待滚动
  scrollPending=true;
  //等Vue把新消息渲染到页面上再滚
  await nextTick()
  if(messageListRef.value){
    messageListRef.value.scrollTop=messageListRef.value.scrollHeight
  }
  //释放标记，允许下一帧再滚
  scrollPending=false;
}

// 加载会话列表（侧栏展示）
const loadSessions=async ()=>{
  sessionsLoading.value=true;
  try{
    sessions.value=await getSessions();
  }catch(error:any){
    ElMessage.error('加载会话列表失败：'+error.message);
  }finally{
    sessionsLoading.value=false;
  }
};

// 加载某个会话的消息，还原到对话窗口
const loadSession=async (sessionId:number)=>{
  sessionLoading.value=true;
  try{
    // 拉该会话的问答记录（时间正序）
    const list:SessionMessage[]=await getSessionMessages(sessionId);
    // 清空现有消息
    messages.value=[];
    // 每条问答展开成两条消息（用户问题 + AI 回答），带上记录 ID 和已反馈状态
    for(const item of list){
      messages.value.push({role:'user',content:item.question});
      messages.value.push({role:'assistant',content:item.answer,id:item.id,feedback:item.feedback});
    }
    // 滚动到底部
    scrollToBottom();
  }catch(error:any){
    ElMessage.error('加载会话失败：'+error.message);
  }finally{
    sessionLoading.value=false;
  }
};

// 监听路由参数变化：带 sessionId 就加载对应会话；没有就清空开新对话
watch(()=>route.params.sessionId,(value)=>{
  // 解析会话 ID（无参数时为 null）
  currentSessionId.value=Number(value)||null;
  // 有会话 ID：加载历史消息；没有：清空消息区
  if(currentSessionId.value){
    loadSession(currentSessionId.value);
  }else{
    messages.value=[];
  }
});

// 页面加载：拉会话列表；若 URL 带会话 ID 则加载该会话（watch 的 immediate 默认 false，这里手动触发一次）
onMounted(()=>{
  loadSessions();
  // URL 直接带会话 ID（刷新/分享链接进来的情况）
  if(currentSessionId.value){
    loadSession(currentSessionId.value);
  }
  // 首页热门问题跳转过来的自动发问：读暂存的问题 → 清掉 → 自动发送
  const pending=sessionStorage.getItem('fazhitong_pending_question');
  if(pending){
    // 立即清掉，防止刷新页面重复发问
    sessionStorage.removeItem('fazhitong_pending_question');
    // 只有在新对话页才自动发（已有会话不打扰）
    if(!currentSessionId.value){
      inputMessage.value=pending;
      sendMessage();
    }
  }
});

// 点击侧栏会话：跳转路由（watch 会自动加载消息）
const openSession=(sessionId:number)=>{
  // 生成中不允许切会话，避免消息串台
  if(loading.value)return;
  // 已在当前会话就不动
  if(sessionId===currentSessionId.value)return;
  // 跳转到 /chat/:sessionId，由 watch 负责加载
  router.push(`/chat/${sessionId}`);
};

// 开启新对话：清空消息区，回到 /chat
const startNewChat=()=>{
  // 生成中不允许切换
  if(loading.value)return;
  // 已在纯新对话页就不动
  if(!currentSessionId.value)return;
  // 跳新对话路由（watch 会清空消息）
  router.push('/chat');
};

// 点赞/点踩：value 为 1（赞）或 -1（踩）；再点一次同一个值 = 取消反馈
const doFeedback=async (msg:Message,value:number)=>{
  // 没有记录 ID（未入库）不处理
  if(msg.id==null)return;
  // 重复点击同一按钮视为取消
  const next=msg.feedback===value?0:value;
  try{
    // 调后端保存反馈
    await setFeedback(msg.id,next);
    // 更新本地状态（按钮高亮跟着变）
    msg.feedback=next;
    // 轻提示结果
    ElMessage.success(next===1?'已点赞':next===-1?'已点踩':'已取消反馈');
  }catch(error:any){
    ElMessage.error('反馈失败：'+error.message);
  }
};

// 发送消息函数（流式：AI 回复逐字出现在气泡里）
const sendMessage=async ()=>{
    // 去掉首尾空格，空内容不发送
    const text=inputMessage.value.trim();

    if(!text||loading.value)return;
    // 把用户消息加入列表
    messages.value.push({role:'user',content:text});
    // 滚动到底部，让新消息可见
    scrollToBottom();

    // 清空输入框
    inputMessage.value=''

    // 先占位一条空的 AI 消息，token 到了往里面填
    // 注意：必须用 reactive() 包一层——普通对象 push 进数组后，直接改原对象不会触发视图更新
    const assistantMessage: Message = reactive({role: 'assistant', content: ''});
    messages.value.push(assistantMessage);

    // 复位等待提示与打字状态（上次流结束但队列未排空时，先把剩余的字倒完）
    flushTypewriter();
    statusText.value='';
    streamingStarted.value=false;

    // 标记正在加载
    loading.value=true
    try{
      // 调用后端流式接口，边收边渲染
      // 注意只传占位消息之前的部分（后端取最后一条当问题，不能把空的 AI 占位传过去）
      // sessionId 传当前会话：新对话为 null（后端自动建会话），旧对话沿用
      await sendMessageStream(messages.value.slice(0, -1), currentSessionId.value, {
        // 检索完成的进度反馈：更新等待提示，把"干等首字"拆出一段可见进度
        onStatus: (message: string) => {
          statusText.value = message;
        },
        // 每收到一个 token：交给打字机逐字渲染并滚动到底
        onToken: (token: string) => {
          streamingStarted.value = true;
          feedTypewriter(assistantMessage, token);
        },
        // 生成完毕：把引用来源挂到这条消息上（气泡下方出现可点击的引用）
        onReferences: (refs: Reference[]) => {
          assistantMessage.references = refs;
          scrollToBottom();
        },
        // 生成完毕：拿到会话 ID 和历史记录 ID（新会话首次提问时才有值）
        onSession: (sessionId: number | null, historyId: number | null) => {
          // 记录 ID 挂到这条 AI 消息上，点赞/点踩按钮据此显示
          assistantMessage.id = historyId;
          // 当前是新对话且后端建了会话：更新当前会话并改路由（replace 不产生多余历史记录）
          if (sessionId && !currentSessionId.value) {
            currentSessionId.value = sessionId;
            router.replace(`/chat/${sessionId}`);
          }
          // 刷新侧栏会话列表（新会话出现/旧会话置顶）
          loadSessions();
        }
      });
      // 流已结束：打字机队列里剩余的字一次性倒完，保证消息内容完整（入库/续聊用的是这条内容）
      flushTypewriter();
    }catch(error:any){
      // 失败：停掉打字机，占位消息里显示错误原因
      stopTypewriter();
      assistantMessage.content='出错了：'+error.message;
      scrollToBottom()
    }finally{
      // 无论成功失败，都取消加载状态
      loading.value=false;
    }
};
</script>

<style scoped>
/* 页面整体：侧栏 + 主区横排 */
.chat-page {
  display: flex;
  gap: 16px;
  height: calc(100vh - 40px);
}

/* ===== 左侧会话侧栏 ===== */
.session-aside {
  width: 240px;
  flex-shrink: 0;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

/* 新对话按钮 */
.new-chat-btn {
  margin-bottom: 12px;
}

/* 会话列表：占满剩余高度，可滚动 */
.session-list {
  flex: 1;
  overflow-y: auto;
}

/* 单个会话项 */
.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: #606266;
  margin-bottom: 4px;
}

/* 悬停效果 */
.session-item:hover {
  background-color: #f4f4f5;
}

/* 当前会话高亮 */
.session-item.active {
  background-color: #ecf5ff;
  color: #409eff;
}

/* 会话图标 */
.session-icon {
  flex-shrink: 0;
}

/* 会话标题：超长省略 */
.session-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 右侧对话主区 ===== */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 页面标题 */
.page-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 24px;
}

/* 空会话引导 */
.chat-empty {
  text-align: center;
  padding-top: 120px;
}

/* 空会话引导标题 */
.chat-empty-title {
  font-size: 20px;
  color: #303133;
  margin-bottom: 8px;
}

/* 空会话引导描述 */
.chat-empty-desc {
  color: #909399;
  font-size: 14px;
}

/* 消息列表区域 */
.message-list {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 12px;
}

/* 单条消息 */
.message-item {
  display: flex;
  margin-bottom: 16px;
}

/* 用户消息靠右显示 */
.message-item.user {flex-direction: row-reverse;}


/* 消息角色标签 */
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

/* 用户角色标签：蓝色渐变 */
.message-item.user .message-role {
  background: linear-gradient(135deg, #409eff, #2b6fd4);
}

/* AI 角色标签：绿色渐变 */
.message-item.assistant .message-role {
  background: linear-gradient(135deg, #67c23a, #3f9e2d);
}

/* 消息内容气泡 */
.message-content {
  max-width: 60%;
  margin: 0 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  line-height: 1.6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* 用户消息气泡：蓝色底 */
.message-item.user .message-content {
  background: linear-gradient(135deg, #ecf5ff, #d9ecff);
  border-color: #c6e2ff;
}

/* Markdown 渲染出来的内容样式（v-html 里的元素不受 scoped 限制，要用 :deep） */
/* 段落间距 */
.markdown-body :deep(p) {
  margin: 0 0 8px;
}
/* 最后一段不额外留白 */
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
/* 加粗文字 */
.markdown-body :deep(strong) {
  color: #303133;
}
/* 无序列表 */
.markdown-body :deep(ul), .markdown-body :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}
/* 列表项间距 */
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
/* 标题字号统一 */
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) {
  margin: 8px 0;
  font-size: 16px;
}

/* 引用来源区域 */
.message-references {
  margin-top: 8px;
  border-top: 1px dashed #dcdfe6;
  padding-top: 8px;
}

/* 点赞/点踩按钮行 */
.feedback-row {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

/* 单个反馈按钮：灰色默认，悬停变主色，已选高亮 */
.feedback-btn {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 16px;
  transition: color 0.2s;
}

/* 悬停效果 */
.feedback-btn:hover {
  color: #409eff;
}

/* 已点赞/点踩的高亮态 */
.feedback-btn.active {
  color: #409eff;
}

/* 单条引用：可点击样式 */
.reference-item {
  font-size: 12px;
  color: #409eff;
  line-height: 1.8;
  cursor: pointer;
}

/* 鼠标悬停时加下划线，提示可点击 */
.reference-item:hover {
  text-decoration: underline;
}

/* 引用弹窗里的原文样式：保留换行、限高滚动 */
.reference-dialog-text {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #303133;
  max-height: 400px;
  overflow-y: auto;
}

/* 流式等待提示文字 */
.streaming-hint {
  color: #909399;
  font-size: 13px;
  margin-bottom: 8px;
}

/* 输入区域布局 */
.input-area {
  display: flex;
  gap: 12px;
}

/* 输入框占满剩余宽度 */
.input-area .el-textarea {
  flex: 1;
}

/* 发送按钮 */
.send-btn {
  align-self: flex-end;
}

/* 上传按钮：贴附件样式，窄方形 */
.attach-btn {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  font-size: 18px;
}

/* 上传弹窗内：已选文件信息 + 上传按钮一行 */
.upload-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.selected-file {
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
