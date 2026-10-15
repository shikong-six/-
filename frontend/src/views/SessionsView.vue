<!-- 会话历史管理页面：展示当前用户的所有会话，支持继续对话、改名、删除 -->
<template>
  <div class="sessions-page">
    <!-- 页面标题 -->
    <h2 class="page-title">会话历史</h2>

    <!-- 会话表格 -->
    <div class="sessions-table">
      <el-table :data="sessionList" style="width: 100%" v-loading="loading">
        <!-- 标题列：悬停显示完整标题 -->
        <el-table-column prop="title" label="会话标题" show-overflow-tooltip />
        <!-- 消息数列 -->
        <el-table-column prop="messageCount" label="问答数" width="100" />
        <!-- 最后活跃时间列 -->
        <el-table-column label="最后活跃" width="180">
          <template #default="{ row }: { row: ChatSession }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <!-- 操作列：继续对话 / 改名 / 删除 -->
        <el-table-column label="操作" width="240">
          <template #default="{ row }: { row: ChatSession }">
            <!-- 继续对话：跳转问答页并加载该会话 -->
            <el-button size="small" type="primary" @click="continueChat(row)">继续对话</el-button>
            <!-- 改名：弹输入框 -->
            <el-button size="small" @click="doRename(row)">改名</el-button>
            <!-- 删除：二次确认 -->
            <el-button size="small" type="danger" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <!-- 空数据提示 -->
        <template #empty>
          <el-empty description="暂无会话，去智能问答页提问即可创建" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API 和生命周期钩子
import { ref, onMounted } from 'vue';
// 引入路由跳转（继续对话用）
import { useRouter } from 'vue-router';
// 引入 Element Plus 的消息提示和确认框组件
import { ElMessage, ElMessageBox } from 'element-plus';
// 引入会话相关 API 封装函数
import { getSessions, renameSession, deleteSession } from '../services/chat';
// 类型用 import type 单独引入
import type { ChatSession } from '../services/chat';

// 路由实例
const router = useRouter();

// 会话列表数据
const sessionList = ref<ChatSession[]>([]);
// 加载中标记
const loading = ref(false);

// 页面加载时获取会话列表
onMounted(() => {
  loadSessions();
});

// 从后端加载当前用户的会话列表
const loadSessions = async () => {
  loading.value = true;
  try {
    sessionList.value = await getSessions();
  } catch (error: any) {
    ElMessage.error('加载会话列表失败：' + error.message);
  } finally {
    loading.value = false;
  }
};

// 继续对话：跳转到问答页并带上会话 ID（ChatView 会自动加载历史消息）
const continueChat = (row: ChatSession) => {
  router.push(`/chat/${row.id}`);
};

// 改名：弹输入框 → 调后端 → 刷新列表
const doRename = async (row: ChatSession) => {
  try {
    // 弹出输入框，预填当前标题；点取消会抛异常
    const { value } = await ElMessageBox.prompt('请输入新的会话标题', '修改标题', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: row.title,
      // 简单校验：非空且不超过 100 字（对齐后端限制）
      inputValidator: (v: string) => (v && v.trim() ? true : '标题不能为空'),
      inputErrorMessage: '标题不能为空'
    });
    // 调用后端改名接口
    await renameSession(row.id, value.trim());
    ElMessage.success('修改成功');
    // 刷新列表显示新标题
    await loadSessions();
  } catch (error: any) {
    // 用户取消时不提示；接口报错才提示
    if (error !== 'cancel' && error?.message) {
      ElMessage.error('修改失败：' + error.message);
    }
  }
};

// 删除会话：弹确认框 → 调后端 → 刷新列表
const doDelete = async (row: ChatSession) => {
  try {
    // 弹出确认框，点了取消会抛异常，直接 return 不删
    await ElMessageBox.confirm(
      `确定删除会话「${row.title}」吗？该会话下的 ${row.messageCount} 条问答会一并删除，不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    // 用户点了取消
    return;
  }
  try {
    // 调用后端删除接口（会话和消息一起删）
    await deleteSession(row.id);
    ElMessage.success('删除成功');
    // 刷新列表，把已删会话从表格里去掉
    await loadSessions();
  } catch (error: any) {
    ElMessage.error('删除失败：' + error.message);
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
/* 页面容器：与案例/法条页同宽居中 */
.sessions-page {
  max-width: 1280px;
  margin: 0 auto;
}
/* 页面标题 */
.page-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 24px;
  color: #303133;
}

/* 表格区域 */
.sessions-table {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
}
</style>
