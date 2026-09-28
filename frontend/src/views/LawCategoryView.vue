<!-- 法律模块的法条列表：嵌套路由 /laws/:category 的子组件 -->
<template>
  <div class="law-list">
    <!-- 未知模块 -->
    <el-empty v-if="!category" description="模块不存在" />

    <!-- 当前模块下的法条卡片（按关键词过滤） -->
    <template v-else>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed, inject, ref} from 'vue';
import type {Ref} from 'vue';
import {useRoute} from 'vue-router';
import {getLawCategoryByKey} from '@/data/laws';

const route = useRoute();
// 父组件（LawsView）提供的搜索关键词（Ref<string>）
const keyword = inject<Ref<string>>('lawKeyword', ref(''));

// 当前模块（由路由段决定）
const category = computed(() => getLawCategoryByKey(String(route.params.category || '')));

// 按关键词过滤：命中要点名/出处/内容任一即保留，空关键词全量
const filtered = computed(() => {
  const list = category.value?.articles ?? [];
  const kw = (keyword.value ?? '').trim();
  if (!kw) return list;
  return list.filter((item) =>
    item.title.includes(kw) || item.source.includes(kw) || item.content.includes(kw)
  );
});
</script>

<style scoped>
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
