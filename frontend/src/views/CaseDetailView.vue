<!-- 案例详情：事实 / 判决 / 依据 / 相关法条 + AI 分析入口 -->
<template>
  <div class="detail-page" v-loading="loading">
    <button class="back-btn" @click="$router.push('/cases')">← 返回案例列表</button>

    <el-empty v-if="!loading && !item" description="案例不存在或已删除" />

    <article v-else-if="item" class="detail-card">
      <div class="accent-bar" :style="{background: accent}"></div>
      <div class="detail-body">
        <span class="cat-tag" :style="{color: accent, borderColor: accent}">{{ categoryTitle }}</span>
        <h1 class="title">{{ item.title }}</h1>
        <div class="meta">
          <span>{{ item.viewCount }} 浏览</span>
          <span>{{ item.createdAt }}</span>
        </div>

        <section class="block">
          <h2>案件事实</h2>
          <p>{{ item.summary }}</p>
        </section>
        <section class="block">
          <h2>法院判决 / 裁判要旨</h2>
          <p>{{ item.verdict }}</p>
        </section>
        <section class="block">
          <h2>裁判依据 / 相关法律条文</h2>
          <div class="laws">
            <span v-for="(law, i) in item.lawRefs" :key="i" class="law-chip">{{ law }}</span>
          </div>
        </section>

        <el-button type="primary" class="ai-btn" @click="askAI">
          让 AI 分析这个案例
        </el-button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {getCategoryByKey} from '@/data/cases';
import {getCaseById, recordCaseView} from '@/services/content';
import type {LawCase} from '@/services/content';

const route = useRoute();
const router = useRouter();
const item = ref<LawCase | null>(null);
const loading = ref(false);

const categoryTitle = computed(() => getCategoryByKey(item.value?.category || '')?.title || '');
const accent = computed(() => getCategoryByKey(item.value?.category || '')?.accent || '#0f9d8f');

async function load() {
  const id = Number(route.params.id);
  if (!id) {
    item.value = null;
    return;
  }
  loading.value = true;
  try {
    item.value = await getCaseById(id);
    recordCaseView(id).catch(() => {});
  } catch (e: any) {
    item.value = null;
    ElMessage.error(e?.message || '加载案例详情失败');
  } finally {
    loading.value = false;
  }
}

function askAI() {
  if (!item.value) return;
  const q = `请分析这个法律案例「${item.value.title}」：${item.value.summary}`;
  sessionStorage.setItem('fazhitong_pending_question', q);
  router.push('/chat');
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped>
.detail-page {
  max-width: 860px;
  margin: 0 auto;
}
.back-btn {
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 12px;
  padding: 0;
}
.detail-card {
  background: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  overflow: hidden;
  box-shadow: var(--fz-shadow);
}
.accent-bar {
  height: 4px;
}
.detail-body {
  padding: 28px 32px 32px;
}
.cat-tag {
  display: inline-block;
  font-size: 12px;
  border: 1px solid;
  border-radius: 4px;
  padding: 2px 10px;
  margin-bottom: 12px;
}
.title {
  margin: 0 0 10px;
  font-size: var(--fz-title, 28px);
  font-weight: 700;
  line-height: 1.35;
  color: var(--fz-text, #303133);
}
.meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--fz-muted, #909399);
  margin-bottom: 24px;
}
.block {
  margin-bottom: 22px;
}
.block h2 {
  margin: 0 0 8px;
  font-size: var(--fz-module, 20px);
  font-weight: 600;
  color: var(--fz-text, #303133);
}
.block p {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--fz-text-secondary, #606266);
}
.laws {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.law-chip {
  font-size: 13px;
  color: var(--fz-primary, #0f9d8f);
  background: var(--fz-primary-soft, #e6f7f5);
  border-radius: 6px;
  padding: 4px 10px;
}
.ai-btn {
  margin-top: 8px;
}
</style>
