<!--智能问答页面-->
<template>
    <div class="chat=page">
        <!--页面标题-->
        <h2 class="page-title">智能问答</h2>
        <!--聊天消息列表区域-->
        <div class="message-list">
            <!--遍历消息数组，渲染每条消息-->
            <div v-for="(msg,index) in messages" :key="index" :class="['message-item',msg.role]">
             <!--消息角色标签:用户显示我，AI显示AI-->
             <div class="message-role">
                {{ msg.role==='user' ?'我':'AI' }}
             </div>
             <!--消息内容-->
             <div class="message-content">
                {{ msg.content }}
             </div>
            </div>
        </div>
      <!--输入区域-->
      <div class="input-area">
        <!--输入框，按回车也能发送-->
        <el-input v-model="inputMessage" type="textarea" :rows="3" placeholder="请输入您的问题，例如：劳动合同到期不续签怎么赔偿？"
        @keyup.enter="sendMessage"/>
        <el-button type="primary" class="send-btn" @click="sendMessage">
            发送
        </el-button>
      </div>
    </div>
</template>
<script setup lang="ts">
//从vue中引入响应式API
import {ref} from 'vue'

//定义消息类型
interface Message{
    role: 'user'|'ai'//消息角色或AI
    content: string //消息内容
}

//消息列表，初始为空
const messages=ref<Message[]>([]);

//输入框绑定的内容
const inputMessage=ref('');

//发送消息函数
const sendMessage=()=>{
    //去掉首位空格，空内容不发送
    const text=inputMessage.value.trim();
    if(!text)return;
    //把用户消息加入列表
    messages.value.push({role:'user',content:text});

    //清空输入框
    inputMessage.value=''

    //TODO:后面这里调用后端API获取AI回复
    //现在先用模拟霍夫演示效果
    setTimeout(()=>{
        messages.value.push({
            role:'ai',
            content:'收到您的问题，后续接入Kimi后我会给出专业回答。'
        });
    },500)
}
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
  height:calc(100vh - 260px);
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
.message-item.user {
  flex-direction: row-reverse;
}

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
.message-item.ai .message-role {
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
  background-color: #ecf5}

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