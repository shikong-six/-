<!-- 案例库：顶部搜索栏 + 上传文档弹窗 + 嵌套子路由（各分类案例列表） -->
<template>
  <div class="cases-page">
    <!-- 顶部栏：搜索栏 + 当前分类名 + 上传文档按钮 -->
    <div class="cases-header">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索案例关键词，如：抚养费、加班费、押金…"
        clearable
        size="large"
        @keyup.enter="noop"
      >
        <template #append>
          <el-button :icon="Search" @click="noop" />
        </template>
      </el-input>
      <span class="category-name">{{ currentTitle }}</span>
      <!-- 上传文档：弹窗内上传入库，上传后可在 AI 咨询中就该文档提问 -->
      <el-button class="upload-btn" @click="uploadDialogVisible = true">
        <el-icon><Paperclip /></el-icon>
        <span>上传文档</span>
      </el-button>
    </div>

    <!-- 嵌套子路由：当前分类的案例列表 -->
    <router-view />

    <!-- 文档上传弹窗：上传后自动解析入库，可在 AI 咨询中提问其内容 -->
    <el-dialog v-model="uploadDialogVisible" title="上传法律文档" width="480px">
      <!-- 文件选择：不自动上传，选完文件后手动点按钮 -->
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
  </div>
</template>

<script setup lang="ts">
import {computed, provide, ref} from 'vue';
import {useRoute} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Search, Paperclip, UploadFilled} from '@element-plus/icons-vue';
import {getCategoryByKey} from '@/data/cases';
// 文档上传接口：后端自动完成 解析 → 分块 → 向量化 → 双写
import {uploadDocument} from '@/services/knowledge';

// 搜索关键词：提供给子路由组件过滤当前分类（响应式）
const keyword = ref('');
provide('caseKeyword', keyword);

const route = useRoute();
// 当前分类名（标题区展示；子路由切换分类时跟随）
const currentTitle = computed(() => {
  const category = getCategoryByKey(String(route.params.category || ''));
  return category ? category.title : '案例库';
});

// 搜索按钮/回车：过滤是响应式的，这里留个钩子（后续可接后端全文检索）
function noop() {
  /* 关键词变化即过滤，无需额外动作 */
}

// ===== 文档上传弹窗 =====
// 弹窗显隐
const uploadDialogVisible = ref(false);
// 当前选中的文件（el-upload 封装对象的 .raw 才是真正的 File）
const selectedFile = ref<File | null>(null);
// 上传/解析中标记（防重复提交 + 按钮 loading）
const uploading = ref(false);

// 选中文件回调：只暂存，不自动上传
function handleFileChange(uploadFile: any) {
  selectedFile.value = uploadFile.raw;
}

// 上传并入库：成功后提示分块数，引导去 AI 咨询就该文档提问
async function doUpload() {
  if (!selectedFile.value || uploading.value) return;
  uploading.value = true;
  try {
    const result = await uploadDocument(selectedFile.value);
    ElMessage.success(`《${result.filename}》已入库（${result.chunkCount} 个分块），可在 AI 咨询中提问它的内容`);
    // 关弹窗并复位，方便下次上传
    uploadDialogVisible.value = false;
    selectedFile.value = null;
  } catch (error: any) {
    ElMessage.error('上传失败：' + (error?.message ?? '未知错误'));
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.cases-page {
  max-width: 960px;
  margin: 0 auto;
}
.cases-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.search-input {
  flex: 1;
  max-width: 560px;
}
.category-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
/* 上传文档按钮：靠右贴边 */
.upload-btn {
  margin-left: auto;
  flex-shrink: 0;
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
