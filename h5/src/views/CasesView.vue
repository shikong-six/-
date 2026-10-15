<template>
  <div class="page">
    <van-nav-bar title="参考案例" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="$router.back()" />

    <van-search v-model="keyword" placeholder="搜索案例标题或裁判要旨" @search="load" @clear="load" />

    <div class="chips">
      <button
        v-for="c in contentCategories"
        :key="c.key || 'all'"
        type="button"
        class="chip"
        :class="{active: category === c.key}"
        @click="pickCategory(c.key)"
      >{{ c.title }}</button>
    </div>

    <div v-if="loading" class="state"><van-loading size="24px">加载中…</van-loading></div>
    <van-empty v-else-if="error" :description="error">
      <van-button round type="primary" size="small" @click="load">重试</van-button>
    </van-empty>
    <van-empty v-else-if="list.length === 0" description="没有匹配的案例" />

    <div v-else class="list">
      <button v-for="item in list" :key="item.id" type="button" class="card" @click="$router.push(`/cases/${item.id}`)">
        <div class="meta">
          {{ categoryName(item.category) }}
          <span v-if="item.isPinned"> · 置顶</span>
        </div>
        <div class="title">{{ item.title }}</div>
        <div class="summary">{{ item.summary }}</div>
        <div class="foot">{{ item.viewCount }} 次浏览</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {categoryName, contentCategories, getCases} from '@/services/content';
import type {LawCase} from '@/services/content';

const keyword = ref('');
const category = ref('');
const list = ref<LawCase[]>([]);
const loading = ref(false);
const error = ref('');

function pickCategory(key: string) {
  category.value = key;
  load();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    list.value = await getCases({
      category: category.value || undefined,
      keyword: keyword.value.trim() || undefined,
    });
  } catch (e) {
    list.value = [];
    error.value = '案例加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  background: var(--fz-bg, #f3f5f7);
}
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 16px 8px;
}
.chip {
  flex-shrink: 0;
  border: 1px solid var(--fz-border, #ebedf0);
  background: #fff;
  color: #646566;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
}
.chip.active {
  background: var(--fz-primary-soft, #e6f7f5);
  border-color: #b7e8e1;
  color: var(--fz-primary, #0f9d8f);
  font-weight: 600;
}
.state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
.list {
  padding: 4px 16px 0;
}
.card {
  display: block;
  width: 100%;
  text-align: left;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
}
.card:active {
  background: var(--fz-primary-soft, #e6f7f5);
}
.meta {
  font-size: 12px;
  color: var(--fz-primary, #0f9d8f);
}
.title {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 650;
  color: var(--fz-text, #323233);
  line-height: 1.45;
}
.summary {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: #646566;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.foot {
  margin-top: 8px;
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
</style>
