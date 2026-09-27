<!-- 案例库：顶部搜索栏 + 嵌套子路由（各分类案例列表） -->
<template>
  <div class="cases-page">
    <!-- 顶部搜索栏 -->
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
    </div>

    <!-- 嵌套子路由：当前分类的案例列表 -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import {computed, provide, ref} from 'vue';
import {useRoute} from 'vue-router';
import {Search} from '@element-plus/icons-vue';
import {getCategoryByKey} from '@/data/cases';

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
</style>
