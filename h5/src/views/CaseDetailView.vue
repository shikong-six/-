<template>
  <div class="page">
    <van-nav-bar title="案例详情" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="$router.back()" />

    <div v-if="loading" class="state"><van-loading size="24px">加载中…</van-loading></div>
    <van-empty v-else-if="error" :description="error">
      <van-button round type="primary" size="small" @click="load">重试</van-button>
    </van-empty>

    <article v-else-if="item" class="card">
      <div class="meta">{{ categoryName(item.category) }} · {{ item.createdAt || '未标注日期' }}</div>
      <h1>{{ item.title }}</h1>
      <section>
        <h2>案情摘要</h2>
        <p>{{ item.summary || '暂无摘要' }}</p>
      </section>
      <section>
        <h2>裁判要旨</h2>
        <p>{{ item.verdict || '暂无要旨' }}</p>
      </section>
      <section v-if="item.lawRefs.length">
        <h2>相关法条</h2>
        <p v-for="(law, i) in item.lawRefs" :key="i">{{ law }}</p>
      </section>
      <button type="button" class="ask" @click="askAbout">就这个案例提问</button>
    </article>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {categoryName, getCaseById, recordCaseView, saveLibraryRef} from '@/services/content';
import type {LawCase} from '@/services/content';

const route = useRoute();
const router = useRouter();
const item = ref<LawCase | null>(null);
const loading = ref(false);
const error = ref('');

async function load() {
  const id = Number(route.params.id);
  if (!id) {
    error.value = '案例不存在';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    item.value = await getCaseById(id);
    recordCaseView(id).catch(() => undefined);
  } catch (e) {
    item.value = null;
    error.value = '案例加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function askAbout() {
  if (!item.value) return;
  saveLibraryRef({type: 'case', id: item.value.id});
  sessionStorage.setItem('fazhitong_pending_question', `请结合这个案例说明：${item.value.title}`);
  sessionStorage.setItem('fazhitong_force_new', '1');
  router.push('/ask');
}

onMounted(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  background: var(--fz-bg, #f3f5f7);
}
.state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
.card {
  margin: 12px 16px;
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 16px;
  padding: 16px;
}
.meta {
  font-size: 12px;
  color: var(--fz-primary, #0f9d8f);
}
h1 {
  margin: 8px 0 0;
  font-size: 20px;
  line-height: 1.4;
}
section {
  margin-top: 16px;
}
h2 {
  margin: 0;
  font-size: 14px;
  color: var(--fz-muted, #969799);
  font-weight: 600;
}
p {
  margin: 6px 0 0;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.ask {
  margin-top: 18px;
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 21px;
  background: var(--fz-primary, #0f9d8f);
  color: #fff;
  font-size: 15px;
  font-weight: 650;
}
</style>
