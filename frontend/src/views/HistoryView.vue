<!-- 对话历史页面：展示所有问答记录 -->
<template>
  <div class="history-page">
    <!-- 页面标题 -->
    <h2 class="page-title">对话历史</h2>

    <!-- 历史记录表格，加载时显示转圈 -->
    <div class="history-table">
      <el-table :data="historyList" style="width: 100%" v-loading="loading">
        <!-- 时间列 -->
        <el-table-column label="时间" width="180">
          <template #default="{ row }: { row: ChatHistoryItem }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <!-- 问题列 -->
        <el-table-column prop="question" label="问题" show-overflow-tooltip />
        <!-- 回答列：内容太长，鼠标悬停显示完整内容；传对象给 show-overflow-tooltip 可自定义提示框（限宽换行） -->
        <el-table-column prop="answer" label="回答" :show-overflow-tooltip="{ popperClass: 'answer-tooltip' }" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API 和生命周期钩子
import { ref, onMounted } from 'vue';
// 引入 Element Plus 的消息提示组件
import { ElMessage } from 'element-plus';
// 引入聊天 API 封装函数
import { getChatHistory } from '../services/chat';
// 类型用 import type 单独引入
import type { ChatHistoryItem } from '../services/chat';

// 历史记录列表数据
const historyList = ref<ChatHistoryItem[]>([]);
// 加载中标记
const loading = ref(false);

// 页面加载时获取历史记录
onMounted(() => {
  loadHistory();
});

// 从后端加载对话历史
const loadHistory = async () => {
  loading.value = true;
  try {
    historyList.value = await getChatHistory();
  } catch (error: any) {
    ElMessage.error('加载对话历史失败：' + error.message);
  } finally {
    loading.value = false;
  }
};

// 格式化时间（后端可能返回 ISO 字符串或 MySQL 时间字符串，统一处理）
const formatTime = (time: string): string => {
  if (!time) return '-';
  // 统一成 YYYY-MM-DD HH:mm:ss 的形式
  return time.slice(0, 19).replace('T', ' ');
};
</script>

<style scoped>
/* 页面标题 */
.page-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 24px;
}

/* 表格区域 */
.history-table {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
}
</style>

<!-- 不加 scoped：tooltip 提示框挂载在 body 下，scoped 的样式作用不到它 -->
<style>
/* 回答列的悬停提示框：限制最大宽度，文字自动换行成多行显示 */
.answer-tooltip {
  max-width: 500px;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>