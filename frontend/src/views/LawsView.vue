<!-- 法律条文库：顶部搜索 + 内嵌模块分块切换 + 当前模块法条列表（单页，不走嵌套路由） -->
<template>
  <div class="laws-page">
    <!-- 顶部：搜索栏 -->
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
    </div>

    <!-- 内嵌模块分块：点模块切换法条列表 -->
    <div class="module-tabs">
      <div
        v-for="category in lawCategories"
        :key="category.key"
        :class="['module-tab', { active: activeKey === category.key }]"
        @click="activeKey = category.key"
      >
        {{ category.title }}
        <span class="count">{{ category.articles.length }}</span>
      </div>
    </div>

    <!-- 当前模块的法条列表（按关键词过滤） -->
    <div class="law-list">
      <el-empty v-if="filtered.length === 0" description="没有匹配的法条，换个关键词试试" />
      <el-card
        v-for="item in filtered"
        :key="item.id"
        shadow="never"
        class="law-card"
      >
        <div class="law-head">
          <span class="law-title">{{ item.title }}</span>
          <el-tag size="small" type="primary" effect="plain" class="law-source">{{ item.source }}</el-tag>
        </div>
        <p class="law-content">{{ item.content }}</p>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import {Search} from '@element-plus/icons-vue';
import {lawCategories} from '@/data/laws';

// 搜索关键词：过滤当前模块（标题/出处/内容任一命中）
const keyword = ref('');
// 当前选中的模块 key（本地状态切换，不走路由）
const activeKey = ref(lawCategories[0].key);

// 当前模块
const activeCategory = computed(() =>
  lawCategories.find((c) => c.key === activeKey.value) ?? lawCategories[0]
);

// 按关键词过滤当前模块：空关键词全量
const filtered = computed(() => {
  const list = activeCategory.value.articles;
  const kw = keyword.value.trim();
  if (!kw) return list;
  return list.filter((item) =>
    item.title.includes(kw) || item.source.includes(kw) || item.content.includes(kw)
  );
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
  margin-bottom: 14px;
}
.search-input {
  max-width: 560px;
}

/* ===== 内嵌模块分块 ===== */
.module-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.module-tab {
  padding: 8px 16px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e4e7ed;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.module-tab:hover {
  color: #4a6cf7;
  border-color: #4a6cf7;
}
/* 选中态：主色填充 */
.module-tab.active {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
.module-tab.active .count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
/* 每个模块的法条数量小标 */
.count {
  font-size: 12px;
  background: #f0f2f5;
  color: #909399;
  border-radius: 8px;
  padding: 1px 7px;
}

/* ===== 法条列表 ===== */
.law-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.law-card {
  border-radius: 8px;
}
.law-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.law-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.law-source {
  border-radius: 4px;
}
.law-content {
  margin: 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
}
</style>
