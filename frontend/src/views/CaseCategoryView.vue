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
import type {LawCase} from '@/services/content';

const route = useRoute();
// 父组件（CasesView）提供的搜索关键词与案例列表（数据来自后端接口）
const keyword = inject<Ref<string>>('caseKeyword', ref(''));
const caseList = inject<Ref<LawCase[]>>('caseList', ref([]));

// 当前分类是否存在（元数据校验，未知分类显示空状态）
const category = computed(() => getCategoryByKey(String(route.params.category || '')));

// 先按路由分类过滤，再按关键词过滤：命中标题/案情/要旨任一即保留
const filtered = computed(() => {
  const cat = String(route.params.category || '');
  const kw = (keyword.value ?? '').trim();
  return caseList.value.filter((item) => {
    if (item.category !== cat) return false;
    if (!kw) return true;
    return item.title.includes(kw) || item.summary.includes(kw) || item.verdict.includes(kw);
  });
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
