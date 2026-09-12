<!-- 知识库-文档管理页面：文档上传、已上传文档列表、删除 -->
<template>
  <div class="knowledge-list-page">
    <!-- 页面标题 -->
    <h2 class="page-title">文档管理</h2>

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
            支持 PDF、Word、TXT 等法律文档，单个文件不超过 20MB
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

    <!-- 文档列表 -->
    <div class="file-list">
      <h3>已上传文档</h3>
      <el-table :data="fileList" style="width: 100%" v-loading="listLoading">
        <!-- 文件名列 -->
        <el-table-column prop="filename" label="文件名" show-overflow-tooltip />
        <!-- 大小列 -->
        <el-table-column label="大小" width="120">
          <template #default="{ row }: { row: DocumentItem }">{{ formatSize(row.size) }}</template>
        </el-table-column>
        <!-- 分块数列 -->
        <el-table-column prop="chunkCount" label="分块数" width="100" />
        <!-- 上传时间列 -->
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }: { row: DocumentItem }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <!-- 操作列：删除文档 -->
        <el-table-column label="操作" width="100">
          <template #default="{ row }: { row: DocumentItem }">
            <el-button type="danger" size="small" @click="doDelete(row)">删除</el-button>
          </template>
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
// 引入 Element Plus 的消息提示和确认框组件
import { ElMessage, ElMessageBox } from 'element-plus';
// 引入知识库 API 封装函数
import { getDocumentList, uploadDocument, deleteDocument } from '../services/knowledge';
// 类型要用 import type 单独引入（tsconfig 开了 strict，类型不能混在值导入里）
import type { DocumentItem } from '../services/knowledge';

// 文档列表数据（从后端 MySQL 加载）
const fileList = ref<DocumentItem[]>([]);
// 列表加载中标记
const listLoading = ref(false);

// 当前选中的文件（还没上传，等用户点按钮）
const selectedFile = ref<File | null>(null);
// 上传中标记
const uploading = ref(false);

// 页面加载时获取文档列表
onMounted(() => {
  loadDocumentList();
});

// 从后端加载已上传文档列表
const loadDocumentList = async () => {
  // 标记加载中
  listLoading.value = true;
  try {
    // 调用列表接口
    fileList.value = await getDocumentList();
  } catch (error: any) {
    // 失败提示错误
    ElMessage.error('加载文档列表失败：' + error.message);
  } finally {
    // 取消加载标记
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
  // 没选文件或正在上传时不重复执行
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

// 删除文档：弹确认框 → 调后端 → 刷新列表
const doDelete = async (row: DocumentItem) => {
  try {
    // 弹出确认框，点了取消会抛异常，直接 return 不删
    await ElMessageBox.confirm(
      `确定删除《${row.filename}》吗？该文档的分块会从向量库一并移除，删除后不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    // 用户点了取消
    return;
  }
  try {
    // 调用后端删除接口（MySQL 元数据 + 向量库分块一起删）
    await deleteDocument(row.id);
    ElMessage.success('删除成功');
    // 重新加载列表，把已删文档从表格里去掉
    await loadDocumentList();
  } catch (error: any) {
    ElMessage.error('删除失败：' + error.message);
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
