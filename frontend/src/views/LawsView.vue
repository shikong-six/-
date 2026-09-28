<!-- 法律条文库：顶部搜索栏 + 嵌套子路由（各模块法条列表） -->
<template>
  <div class="laws-page">
    <!-- 顶部搜索栏 -->
    <div class="laws-header">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索法条关键词，如：抚养费、违约金、正当防卫…"
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

    <!-- 嵌套子路由：当前模块的法条列表 -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import {computed, provide, ref} from 'vue';
import {useRoute} from 'vue-router';
import {Search} from '@element-plus/icons-vue';
import {getLawCategoryByKey} from '@/data/laws';

// 搜索关键词：提供给子路由组件过滤当前模块（响应式）
const keyword = ref('');
provide('lawKeyword', keyword);

const route = useRoute();
// 当前模块名（标题区展示；子路由切换模块时跟随）
const currentTitle = computed(() => {
  const category = getLawCategoryByKey(String(route.params.category || ''));
  return category ? category.title : '法律条文';
});

// 搜索按钮/回车：过滤是响应式的，这里留个钩子（后续可接后端全文检索）
function noop() {
  /* 关键词变化即过滤，无需额外动作 */
}
</script>

<style scoped>
.laws-page {
  max-width: 960px;
  margin: 0 auto;
}
.laws-header {
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
