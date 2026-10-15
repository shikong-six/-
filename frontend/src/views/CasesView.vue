<!-- 案例库：白底卡片 + 顶部色条 + 搜索/排序 + 详情入口 -->
<template>
  <div class="cases-page">
    <div class="chip-row">
      <span class="chip-label">分类</span>
      <div class="chips">
        <div :class="['chip', {active: activeKey === ''}]" @click="activeKey = ''">全部</div>
        <div
          v-for="category in caseCategories"
          :key="category.key"
          :class="['chip', {active: activeKey === category.key}]"
          @click="activeKey = category.key"
        >
          {{ category.title }}
        </div>
      </div>
    </div>

    <div class="search-row">
      <el-input
        v-model="keyword"
        class="kw-input"
        placeholder="搜索关键词，如：抚养费、加班费、押金…"
        clearable
        @keyup.enter="reload"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <button class="search-btn" @click="reload">搜索</button>
      <div class="sort-group">
        <div :class="['sort-pill', {active: sort === 'new'}]" @click="sort = 'new'; reload()">最新</div>
        <div :class="['sort-pill', {active: sort === 'hot'}]" @click="sort = 'hot'; reload()">最热</div>
      </div>
    </div>

    <div v-loading="listLoading" class="grid-wrap">
      <el-empty v-if="!listLoading && caseList.length === 0" description="没有匹配的案例，换个关键词试试" />
      <div v-else class="case-grid">
        <div v-for="item in paged" :key="item.id" class="case-card">
          <div class="accent-bar" :style="{background: accentOf(item.category)}"></div>
          <div class="card-body">
            <div class="card-top">
              <span class="cat-tag" :style="{color: accentOf(item.category), borderColor: accentOf(item.category)}">
                {{ categoryTitle(item.category) }}
              </span>
              <span v-if="item.isPinned" class="pinned-badge">置顶</span>
            </div>
            <h3 class="case-title">{{ item.title }}</h3>
            <p class="case-summary">{{ item.summary }}</p>
            <div class="case-laws">
              <span v-for="(law, i) in item.lawRefs" :key="i" class="law-chip">{{ law }}</span>
            </div>
            <div class="case-stats">
              <span>{{ item.viewCount }} 浏览</span>
              <span class="case-date">{{ item.createdAt }}</span>
            </div>
            <a class="detail-link" @click.prevent="goDetail(item.id)">查看详情 →</a>
          </div>
        </div>
      </div>

      <el-pagination
        v-if="caseList.length > pageSize"
        v-model:current-page="page"
        class="case-pagination"
        background
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="caseList.length"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Search} from '@element-plus/icons-vue';
import {caseCategories, getCategoryByKey} from '@/data/cases';
import {getCases} from '@/services/content';
import type {LawCase} from '@/services/content';

const route = useRoute();
const router = useRouter();

const keyword = ref('');
const activeKey = ref('');
const sort = ref<'new' | 'hot'>('new');
const caseList = ref<LawCase[]>([]);
const listLoading = ref(false);
const page = ref(1);
const pageSize = 12;

onMounted(async () => {
  if (typeof route.query.category === 'string' && route.query.category) {
    activeKey.value = route.query.category;
  }
  await reload();
});

watch(activeKey, () => {
  page.value = 1;
  reload();
});

async function reload() {
  listLoading.value = true;
  page.value = 1;
  try {
    caseList.value = await getCases({
      category: activeKey.value || undefined,
      keyword: keyword.value.trim() || undefined,
      sort: sort.value
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载案例失败');
  } finally {
    listLoading.value = false;
  }
}

function categoryTitle(key: string): string {
  return getCategoryByKey(key)?.title ?? key;
}
function accentOf(key: string): string {
  return getCategoryByKey(key)?.accent ?? '#0f9d8f';
}
function goDetail(id: number) {
  router.push(`/cases/${id}`);
}

const paged = computed(() => {
  const start = (page.value - 1) * pageSize;
  return caseList.value.slice(start, start + pageSize);
});
</script>

<style scoped>
.cases-page {
  max-width: var(--fz-page-max, 1400px);
  margin: 0 auto;
}
.chip-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.chip-label {
  font-size: 14px;
  color: var(--fz-text-secondary, #606266);
  flex-shrink: 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 6px 16px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--fz-border, #E5E7EB);
  font-size: 13px;
  color: var(--fz-text-secondary, #606266);
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.chip:hover {
  color: var(--fz-primary, #0f9d8f);
  border-color: var(--fz-primary, #0f9d8f);
}
.chip.active {
  background: var(--fz-primary, #0f9d8f);
  border-color: var(--fz-primary, #0f9d8f);
  color: #fff;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.kw-input {
  max-width: 420px;
}
.kw-input :deep(.el-input__wrapper) {
  border-radius: 18px;
}
.search-btn {
  border: none;
  background: var(--fz-primary, #0f9d8f);
  color: #fff;
  font-size: 14px;
  padding: 9px 22px;
  border-radius: 18px;
  cursor: pointer;
}
.search-btn:hover {
  background: var(--fz-primary-hover, #0c8a7e);
}
.sort-group {
  margin-left: auto;
  display: flex;
  background: #fff;
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: 18px;
  overflow: hidden;
}
.sort-pill {
  padding: 7px 18px;
  font-size: 13px;
  color: var(--fz-text-secondary, #606266);
  cursor: pointer;
}
.sort-pill + .sort-pill {
  border-left: 1px solid var(--fz-border, #E5E7EB);
}
.sort-pill.active {
  background: var(--fz-primary, #0f9d8f);
  color: #fff;
}
.grid-wrap {
  min-height: 200px;
}
.case-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.case-card {
  background: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  overflow: hidden;
  box-shadow: var(--fz-shadow);
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}
.case-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--fz-shadow-hover);
}
.accent-bar {
  height: 4px;
  width: 100%;
}
.card-body {
  padding: 16px 18px 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.cat-tag {
  display: inline-block;
  font-size: 12px;
  border: 1px solid;
  border-radius: 4px;
  padding: 1px 8px;
  background: #fff;
}
.pinned-badge {
  margin-left: auto;
  background: linear-gradient(135deg, #ff7a59, #f6524e);
  color: #fff;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
}
.case-title {
  margin: 0 0 8px;
  font-size: var(--fz-card-title, 17px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--fz-text, #303133);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.case-summary {
  margin: 0;
  font-size: 13px;
  color: var(--fz-text-secondary, #606266);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.case-laws {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.law-chip {
  font-size: 11px;
  color: var(--fz-muted, #909399);
  background: #f4f4f5;
  border-radius: 4px;
  padding: 2px 8px;
}
.case-stats {
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fz-muted, #909399);
}
.detail-link {
  margin-top: 10px;
  font-size: 13px;
  color: var(--fz-primary, #0f9d8f);
  cursor: pointer;
  text-decoration: none;
}
.detail-link:hover {
  text-decoration: underline;
}
.case-pagination {
  margin-top: 16px;
  justify-content: center;
}
@media (max-width: 960px) {
  .case-grid {
    grid-template-columns: 1fr;
  }
}
</style>
