<!-- 案例页：典型案例库（规划中，先占位） -->
<template>
  <div class="cases-page">
    <el-card shadow="never" class="placeholder-card">
      <div class="placeholder-body">
        <el-icon class="placeholder-icon"><Document /></el-icon>
        <h3>案例库</h3>
        <p>规划功能：收录典型案例（案情描述 + 裁判要旨 + 相关法条关联），支持按案由/关键词检索。</p>
        <p class="muted">当前为占位页面，内容建设中。</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {Document} from '@element-plus/icons-vue';
</script>

<style scoped>
.placeholder-card {
  max-width: 720px;
  margin: 40px auto;
}
.placeholder-body {
  text-align: center;
  padding: 24px 0;
}
.placeholder-icon {
  font-size: 48px;
  color: #c0c4cc;
}
h3 {
  margin: 12px 0 8px;
  color: #303133;
}
p {
  color: #606266;
  line-height: 1.8;
  margin: 4px 0;
}
.muted {
  color: #909399;
  font-size: 13px;
}
</style>
