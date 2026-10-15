<template>
  <div class="page">
    <van-nav-bar title="法律条文" left-text="返回" left-arrow fixed placeholder safe-area-inset-top @click-left="$router.back()" />

    <van-search v-model="keyword" placeholder="搜索条文名称或内容" @search="load(true)" @clear="load(true)" />

    <div class="chips">
      <button type="button" class="chip" :class="{active: activeDoc === ''}" @click="pickDoc('')">全部</button>
      <button
        v-for="law in corpusLaws"
        :key="law.docName"
        type="button"
        class="chip"
        :class="{active: activeDoc === law.docName}"
        @click="pickDoc(law.docName)"
      >{{ shortLaw(law.title) }} {{ law.count }}</button>
      <button type="button" class="chip" :class="{active: activeDoc === CURATED}" @click="pickDoc(CURATED)">常用摘录</button>
    </div>

    <div v-if="activeDoc === CURATED" class="chips">
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
      <van-button round type="primary" size="small" @click="load(true)">重试</van-button>
    </van-empty>
    <van-empty v-else-if="list.length === 0" description="没有匹配的法条" />

    <div v-else class="list">
      <article v-for="item in list" :key="item.key" class="card">
        <button type="button" class="head" @click="toggle(item)">
          <div>
            <div class="meta">{{ item.meta }}</div>
            <div class="title">{{ item.title }}</div>
          </div>
          <van-icon :name="openKey === item.key ? 'arrow-up' : 'arrow-down'" />
        </button>
        <div v-if="openKey === item.key" class="body">
          <p>{{ item.content }}</p>
          <button type="button" class="ask" @click="askAbout(item)">就这条提问</button>
        </div>
      </article>
      <button v-if="activeDoc !== CURATED && list.length < total" type="button" class="more" @click="loadMore">加载更多</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {categoryName, contentCategories, getCorpus, getLaws, recordLawView, saveLibraryRef} from '@/services/content';
import type {CorpusLaw, LawArticle} from '@/services/content';

const CURATED = '__curated__';
const PAGE_SIZE = 20;

interface LawRow {
  key: string;
  meta: string;
  title: string;
  content: string;
  mysqlId?: number;
}

const router = useRouter();
const keyword = ref('');
const category = ref('');
const activeDoc = ref('');
const corpusLaws = ref<CorpusLaw[]>([]);
const list = ref<LawRow[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref('');
const openKey = ref<string | null>(null);
const viewed = new Set<number>();

function shortLaw(title: string): string {
  return title.replace(/^中华人民共和国/, '') || title;
}

function fromCurated(item: LawArticle): LawRow {
  return {
    key: `curated-${item.id}`,
    meta: `${categoryName(item.category)}${item.source ? ` · ${item.source}` : ''}`,
    title: item.title,
    content: item.content,
    mysqlId: item.id,
  };
}

function pickCategory(key: string) {
  category.value = key;
  load(true);
}

function pickDoc(docName: string) {
  activeDoc.value = docName;
  load(true);
}

async function load(reset = true) {
  if (reset) {
    page.value = 1;
    loading.value = true;
    openKey.value = null;
  }
  error.value = '';
  try {
    if (activeDoc.value === CURATED) {
      const [articles, corpus] = await Promise.all([
        getLaws({
          category: category.value || undefined,
          keyword: keyword.value.trim() || undefined,
        }),
        getCorpus({page: 1, pageSize: 1}),
      ]);
      corpusLaws.value = corpus.laws;
      list.value = articles.map(fromCurated);
      total.value = list.value.length;
    } else {
      const corpus = await getCorpus({
        docName: activeDoc.value || undefined,
        keyword: keyword.value.trim() || undefined,
        page: page.value,
        pageSize: PAGE_SIZE,
      });
      corpusLaws.value = corpus.laws;
      total.value = corpus.total;
      const rows = corpus.items.map((item) => ({
        key: item.key,
        meta: item.source,
        title: item.source.replace(/^《[^》]+》/, '') || shortLaw(item.docName),
        content: item.content,
      }));
      list.value = reset ? rows : list.value.concat(rows);
    }
  } catch {
    if (reset) list.value = [];
    error.value = '法条加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  page.value += 1;
  const before = list.value.length;
  await load(false);
  if (list.value.length === before) page.value -= 1;
}

async function toggle(item: LawRow) {
  openKey.value = openKey.value === item.key ? null : item.key;
  if (openKey.value === item.key && item.mysqlId && !viewed.has(item.mysqlId)) {
    viewed.add(item.mysqlId);
    recordLawView(item.mysqlId).catch(() => viewed.delete(item.mysqlId!));
  }
}

function askAbout(item: LawRow) {
  if (item.mysqlId) saveLibraryRef({type: 'law', id: item.mysqlId});
  sessionStorage.setItem('fazhitong_pending_question', `请结合法条说明：${item.title}`);
  sessionStorage.setItem('fazhitong_force_new', '1');
  router.push('/ask');
}

onMounted(() => load(true));
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
.more {
  display: block;
  width: 100%;
  margin-top: 12px;
  border: 1px solid var(--fz-border, #ebedf0);
  background: #fff;
  border-radius: 999px;
  padding: 10px 12px;
  color: var(--fz-primary, #0f9d8f);
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
  background: #fff;
  border: 1px solid var(--fz-border, #ebedf0);
  border-radius: 14px;
  margin-bottom: 10px;
  overflow: hidden;
}
.head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  border: none;
  background: #fff;
  padding: 14px;
  color: #c8c9cc;
}
.meta {
  font-size: 12px;
  color: var(--fz-muted, #969799);
}
.title {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 650;
  color: var(--fz-text, #323233);
  line-height: 1.45;
}
.body {
  padding: 0 14px 14px;
}
.body p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #323233;
  white-space: pre-wrap;
}
.ask {
  margin-top: 10px;
  border: none;
  background: transparent;
  color: var(--fz-primary, #0f9d8f);
  font-size: 13px;
  padding: 0;
}
</style>
