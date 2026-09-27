<!-- 案例分类列表：嵌套路由 /cases/:category 的子组件 -->
<template>
  <div class="case-list">
    <!-- 未知分类 -->
    <el-empty v-if="!category" description="分类不存在" />

    <!-- 当前分类下的案例卡片（按关键词过滤） -->
    <template v-else>
      <el-empty v-if="filtered.length === 0" description="没有匹配的案例，换个关键词试试" />
      <el-card
        v-for="item in filtered"
        :key="item.id"
        shadow="never"
        class="case-card"
      >
        <div class="case-title">{{ item.title }}</div>
        <div class="case-section">
          <span class="label">案情摘要</span>
          <p>{{ item.summary }}</p>
        </div>
        <div class="case-section">
          <span class="label">裁判要旨</span>
          <p>{{ item.verdict }}</p>
        </div>
        <div class="case-laws">
          <el-tag v-for="(law, i) in item.lawRefs" :key="i" size="small" type="info" class="law-tag">
            {{ law }}
          </el-tag>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed, inject, ref} from 'vue';
import type {Ref} from 'vue';
import {useRoute} from 'vue-router';
import {getCategoryByKey} from '@/data/cases';

const route = useRoute();
// 父组件（CasesView）提供的搜索关键词（Ref<string>）
const keyword = inject<Ref<string>>('caseKeyword', ref(''));

// 当前分类（由路由段决定）
const category = computed(() => getCategoryByKey(String(route.params.category || '')));

// 按关键词过滤：命中标题/案情/要旨任一即保留，空关键词全量
const filtered = computed(() => {
  const list = category.value?.cases ?? [];
  const kw = (keyword.value ?? '').trim();
  if (!kw) return list;
  return list.filter((item) =>
    item.title.includes(kw) || item.summary.includes(kw) || item.verdict.includes(kw)
  );
});
</script>

<style scoped>
.case-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.case-card {
  border-radius: 8px;
}
.case-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}
.case-section {
  margin-bottom: 8px;
}
.case-section .label {
  font-size: 13px;
  font-weight: 600;
  color: #4a6cf7;
}
.case-section p {
  margin: 4px 0 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
}
.case-laws {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.law-tag {
  border-radius: 4px;
}
</style>
