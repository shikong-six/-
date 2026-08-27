<!-- 知识库管理页面 -->
<template>
  <div class="knowledge-page">
    <!-- 页面标题 -->
    <h2 class="page-title">知识库管理</h2>

    <!-- 上传区域 -->
    <div class="upload-area">
      <!-- 文件上传组件 -->
      <!-- action 后面接后端上传接口，现在先留空，后面再填 -->
      <el-upload
        drag
        action=""
        :auto-upload="false"
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
    </div>

    <!-- 文件列表 -->
    <div class="file-list">
      <h3>已上传文档</h3>
      <!-- 用 Element Plus 表格展示 -->
      <el-table :data="fileList" style="width: 100%">
        <!-- 文件名列 -->
        <el-table-column prop="name" label="文件名" />
        <!-- 文件大小列 -->
        <el-table-column prop="size" label="大小" width="120" />
        <!-- 状态列 -->
        <el-table-column prop="status" label="状态" width="120" />
        <!-- 操作列 -->
        <el-table-column label="操作" width="120">
          <template #default>
            <el-button link type="danger" size="small">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API
import { ref } from 'vue';
// 引入上传图标
import { UploadFilled } from '@element-plus/icons-vue';

//文件对象类型
interface FileItem {
  name: string;    // 文件名
  size: string;    // 文件大小
  status: string;  // 处理状态
}

// 文件列表，初始放一些模拟数据
const fileList = ref<FileItem[]>([
  { name: '劳动法.pdf', size: '2.5MB', status: '已处理' },
  { name: '合同法.docx', size: '1.2MB', status: '已处理' }
]);

// 文件选择变化时的回调函数
const handleFileChange = (file: any) => {
  // TODO: 后续接入后端上传接口
  console.log('选择了文件：', file.name);
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