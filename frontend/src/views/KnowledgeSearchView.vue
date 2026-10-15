<!-- 知识库-检索测试页面：验证向量库的召回效果 -->
<template>
  <div class="knowledge-search-page">
    <!-- 页面标题 -->
    <h2 class="page-title">检索测试</h2>

    <!-- 检索测试区域 -->
    <div class="search-area">
      <!-- 检索说明 -->
      <p class="search-desc">输入问题，检索向量库中最相近的法条分块，验证知识库召回效果</p>
      <div class="search-input">
        <!-- 检索输入框，回车触发 -->
        <el-input
          v-model="searchQuery"
          placeholder="输入问题，测试向量库检索效果"
          @keyup.enter="doSearch"
        />
        <el-button type="primary" :loading="searching" @click="doSearch">检索</el-button>
      </div>

      <!-- 检索结果列表 -->
      <div v-if="searchResults.length > 0" class="search-results">
        <div v-for="(item, index) in searchResults" :key="index" class="search-result-item">
          <!-- 结果元信息：法律名 + 相似度 -->
          <div class="result-meta">
            <!-- 展示名和库里的文件名分开：docName 是存储键（含 _20121228 和 .docx），
                 套进界面会露出日期和扩展名。跟聊天页引用卡片用同一个展示名函数，
                 见 mistake/引用卡片露出文件名日期和docx.md -->
            <span class="result-doc">《{{ lawDisplayName(item.docName) }}》（第 {{ item.chunkIndex + 1 }} 块）</span>
            <span class="result-score">相似度距离：{{ item.score.toFixed(4) }}</span>
          </div>
          <!-- 命中的文本块内容 -->
          <div class="result-text">{{ item.text }}</div>
        </div>
      </div>
      <!-- 检索过但没结果时给出提示 -->
      <div v-else-if="searched" class="search-empty">没有检索到相关内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API
import { ref } from 'vue';
// 引入 Element Plus 的消息提示组件
import { ElMessage } from 'element-plus';
// 引入知识库检索 API
import { searchKnowledge } from '../services/knowledge';
// 引用展示名：去掉文件名里的 _日期 和扩展名（与聊天页引用卡片共用，避免两处写法漂移）
import { lawDisplayName } from '../services/chat';
// 类型用 import type 单独引入
import type { SearchResult } from '../services/knowledge';

// 检索关键词
const searchQuery = ref('');
// 检索结果列表
const searchResults = ref<SearchResult[]>([]);
// 检索中标记
const searching = ref(false);
// 是否已经检索过（用来区分"没检索"和"检索了但没结果"）
const searched = ref(false);

// 相似度检索测试
const doSearch = async () => {
  // 去掉首尾空格
  const query = searchQuery.value.trim();
  // 空查询或正在检索时不重复发起（校验和赋值分开写，避免把 searching 卡成 true）
  if (!query || searching.value) return;
  // 标记检索中
  searching.value = true;
  // 重置"已检索"标记（等待本次结果）
  searched.value = false;
  try {
    // 调后端检索接口，取最相近的 3 个分块
    searchResults.value = await searchKnowledge(query, 3);
    // 标记已检索
    searched.value = true;
  } catch (error: any) {
    ElMessage.error('检索失败：' + error.message);
  } finally {
    // 取消检索标记
    searching.value = false;
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

/* 检索区域 */
.search-area {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
}

/* 检索说明文字 */
.search-desc {
  margin-top: 0;
  margin-bottom: 16px;
  color: #909399;
  font-size: 14px;
}

/* 检索输入框和按钮一行 */
.search-input {
  display: flex;
  gap: 12px;
}

/* 输入框占满剩余宽度 */
.search-input .el-input {
  flex: 1;
}

/* 检索结果列表 */
.search-results {
  margin-top: 16px;
}

/* 单条检索结果 */
.search-result-item {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

/* 检索结果元信息：文档名 + 相似度 */
.result-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

/* 文档名 */
.result-doc {
  color: #409eff;
}

/* 相似度距离 */
.result-score {
  color: #909399;
}

/* 检索结果文本块 */
.result-text {
  color: #606266;
  line-height: 1.6;
  font-size: 14px;
  /* 最多显示 4 行，超出省略，避免结果太长撑满页面 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

/* 检索无结果提示 */
.search-empty {
  margin-top: 16px;
  color: #909399;
  text-align: center;
}
</style>
