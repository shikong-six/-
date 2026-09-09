<!-- 知识库管理页面：文档上传、相似度检索测试、已上传文档列表 -->
<template>
  <div class="knowledge-page">
    <!-- 页面标题 -->
    <h2 class="page-title">知识库管理</h2>

    <!-- 上传区域 -->
    <div class="upload-area">
      <!-- 文件选择组件：不自动上传，选完文件后手动点下面的按钮上传 -->
      <el-upload
        drag
        action=""
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处，或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 PDF、Word、TXT 等法律文档
          </div>
        </template>
      </el-upload>

      <!-- 已选文件信息 + 上传按钮 -->
      <div class="upload-actions">
        <span v-if="selectedFile" class="selected-file">已选择：{{ selectedFile.name }}</span>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!selectedFile"
          @click="doUpload"
        >
          {{ uploading ? '正在解析入库…' : '上传到知识库' }}
        </el-button>
      </div>
    </div>

    <!-- 检索测试区域：验证向量库的召回效果 -->
    <div class="search-area">
      <h3>检索测试</h3>
      <div class="search-input">
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
          <div class="result-meta">
            <span class="result-doc">{{ item.docName }}（第 {{ item.chunkIndex + 1 }} 块）</span>
            <span class="result-score">相似度距离：{{ item.score.toFixed(4) }}</span>
          </div>
          <div class="result-text">{{ item.text }}</div>
        </div>
      </div>
      <!-- 检索过但没结果时给出提示 -->
      <div v-else-if="searched" class="search-empty">没有检索到相关内容</div>
    </div>

    <!-- 文档列表 -->
    <div class="file-list">
      <h3>已上传文档</h3>
      <el-table :data="fileList" style="width: 100%" v-loading="listLoading">
        <el-table-column prop="filename" label="文件名" />
        <el-table-column label="大小" width="120">
          <template #default="{ row }: { row: DocumentItem }">{{ formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="chunkCount" label="分块数" width="100" />
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }: { row: DocumentItem }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API 和生命周期钩子
import { ref, onMounted } from 'vue';
// 引入上传图标
import { UploadFilled } from '@element-plus/icons-vue';
// 引入 Element Plus 的消息提示组件
import { ElMessage } from 'element-plus';
// 引入知识库 API 封装函数
import { getDocumentList, uploadDocument, searchKnowledge } from '../services/knowledge';
// 类型要用 import type 单独引入（tsconfig 开了 strict，类型不能混在值导入里）
import type { DocumentItem, SearchResult } from '../services/knowledge';

// 文档列表数据（从后端 MySQL 加载）
const fileList = ref<DocumentItem[]>([]);
// 列表加载中标记
const listLoading = ref(false);

// 当前选中的文件（还没上传，等用户点按钮）
const selectedFile = ref<File | null>(null);
// 上传中标记
const uploading = ref(false);

// 检索测试相关状态
const searchQuery = ref('');
const searchResults = ref<SearchResult[]>([]);
const searching = ref(false);
// 是否已经检索过（用来区分"没检索"和"检索了但没结果"）
const searched = ref(false);

// 页面加载时获取文档列表
onMounted(() => {
  loadDocumentList();
});

// 从后端加载已上传文档列表
const loadDocumentList = async () => {
  listLoading.value = true;
  try {
    fileList.value = await getDocumentList();
  } catch (error: any) {
    ElMessage.error('加载文档列表失败：' + error.message);
  } finally {
    listLoading.value = false;
  }
};

// 文件选择变化时的回调
// 注意：el-upload 传进来的 uploadFile 是封装对象，真正的文件对象在 .raw 里
const handleFileChange = (uploadFile: any) => {
  selectedFile.value = uploadFile.raw;
};

// 上传文件到知识库
const doUpload = async () => {
  if (!selectedFile.value || uploading.value) return;
  uploading.value = true;
  try {
    // 上传成功后后端已自动完成解析、分块、向量化、入库
    const result = await uploadDocument(selectedFile.value);
    ElMessage.success(`上传成功，已分块 ${result.chunkCount} 块`);
    // 清空已选文件
    selectedFile.value = null;
    // 重新加载列表，让新上传的文档显示出来
    await loadDocumentList();
  } catch (error: any) {
    ElMessage.error('上传失败：' + error.message);
  } finally {
    uploading.value = false;
  }
};

// 相似度检索测试
const doSearch = async () => {
  const query = searchQuery.value.trim();
  if (!query || searching.value) 
  return searching.value = true; searched.value = false;
  try {
    searchResults.value = await searchKnowledge(query, 3);
    searched.value = true;
  } catch (error: any) {
    ElMessage.error('检索失败：' + error.message);
  } finally {
    searching.value = false;
  }
};

// 把字节数格式化成可读大小（B / KB / MB）
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};

// 格式化上传时间（后端可能返回 ISO 字符串或 MySQL 时间字符串，统一处理）
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

/* 上传区域样式 */
.upload-area {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

/* 已选文件与上传按钮一行 */
.upload-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}

/* 已选文件名 */
.selected-file {
  color: #606266;
  font-size: 14px;
}

/* 检索测试区域 */
.search-area {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.search-area h3 {
  margin-top: 0;
  margin-bottom: 16px;
}

/* 检索输入框和按钮一行 */
.search-input {
  display: flex;
  gap: 12px;
}

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

.result-doc {
  color: #409eff;
}

.result-score {
  color: #909399;
}

/* 检索结果文本块 */
.result-text {
  color: #606266;
  line-height: 1.6;
  font-size: 14px;
  /* 最多显示 4 行，超出省略，避免结果太长撑满页面 */
  display: 
  -webkit-box;
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

/* 文件列表区域 */
.file-list {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
}

/* 文件列表标题 */
.file-list h3 {
  margin-top: 0;
  margin-bottom: 16px;
}
</style>
