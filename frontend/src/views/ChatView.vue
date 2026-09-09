<!-- 智能问答页面 -->
<template>
    <div class="chat-page">
        <!-- 页面标题 -->
        <h2 class="page-title">智能问答</h2>

        <!-- 聊天消息列表区域 -->
        <div class="message-list" ref="messageListRef" v-loading="loading" element-loading-text="AI 正在思考...">
            <!-- 遍历消息数组，渲染每条消息 -->
            <div v-for="(msg,index) in messages" :key="index" :class="['message-item',msg.role]">
             <!-- 消息角色标签：用户显示“我”，AI 显示“AI” -->
             <div class="message-role">
                {{ msg.role==='user' ?'我':'AI' }}
             </div>
             <!-- 消息内容 -->
             <div class="message-content">
                {{ msg.content }}
                <!--AI消息下方展示引用来源，用户消息没有引用就不显示-->
                <div v-if="msg.references&&msg.references.length>0" class="emssage-references">
                  <div v-for="(reference,index) in msg.references" :key="index" class="reference-item">
                    引用:《{{ reference.docName }}》第{{ reference.chunkIndex+1 }}块
                  </div>
                </div>
             </div>
            </div>
        </div>
      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 输入框，按回车也能发送 -->
        <el-input v-model="inputMessage" type="textarea" :rows="3" placeholder="请输入您的问题，例如：劳动合同到期不续签怎么赔偿？"
        @keyup.enter="sendMessage"/>
        <el-button type="primary" :loading="loading" :disabled="loading" class="send-btn" @click="sendMessage">
            发送
        </el-button>
      </div>
    </div>
</template>
<script setup lang="ts">
// 从 vue 中引入响应式 API和nextTick(等DOM更新后再滚动)
import {ref,nextTick} from 'vue'
// 引入调用后端聊天的函数，改名为 sendMessageToBackend，避免和本组件的 sendMessage 重名
import {sendMessage as sendMessageToBackend} from '../services/chat'
//引入引用来源类型(类型导入要用import type)
import type{Reference} from '../services/chat'
// 定义消息类型
interface Message{
    role: 'user'|'assistant' // 消息角色：用户或 AI
    content: string // 消息内容
    references?:Reference[]//AI消息附带的引用来源(用户消息没有，所以可选)
}

// 消息列表，初始为空
const messages=ref<Message[]>([]);

// 输入框绑定的内容
const inputMessage=ref('');
// 是否等待 AI 回复
const loading=ref(false)
const messageListRef=ref<HTMLElement|null>(null)
//滚动到消息列表底部(新消息出现时调用)
const scrollToBottom=async ()=>{
  //等Vue把新消息渲染到页面上再滚
  await nextTick()
  if(messageListRef.value){
    messageListRef.value.scrollTop=messageListRef.value.scrollHeight
  }
}
// 发送消息函数
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

    // 标记正在加载
    loading.value=true
    try{
      // 调用后端 /api/chat 接口获取 AI 回复
      const result=await sendMessageToBackend(messages.value);
      // 把 Kimi 返回的回复加入列表
      messages.value.push({role:'assistant',content:result.answer,references:result.references})
      // 滚动到底部，让回复可见
      scrollToBottom();
    }catch(error:any){
      // 如果调用失败，显示错误信息
      messages.value.push({role:'assistant',content:'出错了：'+error.message});
      scrollToBottom()
    }finally{
      // 无论成功失败，都取消加载状态
      loading.value=false;
    }
};
</script>

<style scoped>
/* 页面标题 */
.page-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 24px;
}

/* 消息列表区域 */
.message-list {
  height: calc(100vh - 260px);
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
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
  background-color: #409eff;
  color: #fff;
  flex-shrink: 0;
}

/* AI 角色标签用不同颜色 */
.message-item.assistant .message-role {
  background-color: #67c23a;
}

/* 消息内容气泡 */
.message-content {
  max-width: 60%;
  margin: 0 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: #f4f4f5;
  line-height: 1.6;
}

/* 用户消息气泡用蓝色 */
.message-item.user .message-content {
  background-color: #ecf5ff;
}
/* 引用来源区域 */
.message-references {
  margin-top: 8px;
  border-top: 1px dashed #dcdfe6;
  padding-top: 8px;
}

/* 单条引用 */
.reference-item {
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
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
</style>
