<!-- 法律条文：白底文档型卡片，突出法条编号，支持名称/条号/关键词搜索 -->
<template>
  <div class="laws-page">
    <div class="chip-row">
      <span class="chip-label">法律</span>
      <div class="chips">
        <div :class="['chip', {active: activeDoc === ''}]" @click="pickDoc('')">全部</div>
        <div
          v-for="law in corpusLaws"
          :key="law.docName"
          :class="['chip', {active: activeDoc === law.docName}]"
          @click="pickDoc(law.docName)"
        >
          {{ shortLaw(law.title) }}
          <span class="chip-count">{{ law.count }}</span>
        </div>
        <div :class="['chip', {active: activeDoc === CURATED}]" @click="pickDoc(CURATED)">常用摘录</div>
      </div>
    </div>

    <div v-if="activeDoc === CURATED" class="chip-row">
      <span class="chip-label">分类</span>
      <div class="chips">
        <div :class="['chip', {active: activeKey === ''}]" @click="activeKey = ''">全部</div>
        <div
          v-for="category in lawCategories"
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
        placeholder="法律名称 / 条号 / 关键词，如 1079、抚养费"
        clearable
        @keyup.enter="reload()"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <!-- 必须写成 reload()：直接写 reload 会把 PointerEvent 当 resetPage 传进去，
           虽然 Truthy 恰好等于 true、行为看着对，但语义错了，类型检查也会报错 -->
      <button class="search-btn" @click="reload()">搜索</button>
      <el-button class="upload-btn" @click="uploadDialogVisible = true">
        <el-icon><Paperclip /></el-icon>
        <span>上传文档</span>
      </el-button>
    </div>

    <div v-loading="loading" class="grid-wrap">
      <el-empty v-if="!loading && articleList.length === 0" description="没有匹配的法条，换个关键词试试" />
      <div v-else class="law-grid">
        <div v-for="item in paged" :key="item.key" class="law-card">
          <div class="card-body">
            <div class="card-top">
              <span class="cat-tag">{{ categoryTitle(item.category) }}</span>
            </div>
            <div class="law-name">{{ parseSource(item.source).lawName }}</div>
            <div class="article-no">{{ parseSource(item.source).articleNo || item.title }}</div>
            <div v-if="item.title" class="article-title">{{ item.title }}</div>
            <p class="law-content" :class="{expanded: expandedIds.has(item.key)}">{{ item.content }}</p>
            <div class="law-footer">
              <span class="source-chip">{{ parseSource(item.source).shortName }}</span>
              <a class="expand-link" @click.prevent="toggleExpand(item)">
                {{ expandedIds.has(item.key) ? '收起' : '查看全文 →' }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div v-if="listTotal > 0" class="law-footer-bar">
        <el-pagination
          v-if="listTotal > pageSize"
          v-model:current-page="page"
          class="law-pagination"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="listTotal"
          @current-change="onPageChange"
        />
        <el-input
          v-model="jumpPage"
          class="page-search"
          size="small"
          placeholder="页码"
          @keyup.enter="goToPage"
        />
      </div>
    </div>

    <el-dialog v-model="uploadDialogVisible" title="上传法律文档" width="480px">
      <el-upload
        drag
        action=""
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击选择</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 PDF、DOCX、TXT，单个文件不超过 20MB</div>
        </template>
      </el-upload>
      <div class="upload-actions">
        <div class="upload-status">
          <span v-if="selectedFile && uploadPhase === 'idle'">已选择：{{ selectedFile.name }}</span>
          <span v-else-if="uploadPhase === 'uploading'">上传中 {{ uploadPercent }}%</span>
          <span v-else-if="uploadPhase === 'parsing'">解析中…</span>
          <span v-else-if="uploadPhase === 'done'">完成</span>
        </div>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!selectedFile || uploading"
          @click="doUpload"
        >
          {{ uploading ? (uploadPhase === 'parsing' ? '解析入库中…' : '上传中…') : '上传并入库' }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Search, Paperclip, UploadFilled} from '@element-plus/icons-vue';
import {lawCategories} from '@/data/laws';
import {getCorpus, getLaws, recordLawView} from '@/services/content';
import type {CorpusLaw, LawArticle} from '@/services/content';
import {uploadDocument} from '@/services/knowledge';

const CURATED = '__curated__';

interface LawCard {
  key: string;
  category: string;
  title: string;
  source: string;
  content: string;
  mysqlId?: number;
}

const route = useRoute();
const router = useRouter();
const expandedIds = reactive(new Set<string>());
const keyword = ref('');
const jumpPage = ref('');
const activeKey = ref('');
const activeDoc = ref('');
const corpusLaws = ref<CorpusLaw[]>([]);
const articleList = ref<LawCard[]>([]);
const listTotal = ref(0);
const loading = ref(false);
const page = ref(1);
const pageSize = 12;

function shortLaw(title: string): string {
  return title.replace(/^中华人民共和国/, '') || title;
}

function toCuratedCard(item: LawArticle): LawCard {
  return {
    key: `curated-${item.id}`,
    category: item.category,
    title: item.title,
    source: item.source,
    content: item.content,
    mysqlId: item.id,
  };
}

onMounted(() => {
  if (typeof route.query.category === 'string' && route.query.category) {
    activeDoc.value = CURATED;
    activeKey.value = route.query.category;
  }
  const saved = Number(route.query.page);
  if (Number.isInteger(saved) && saved > 0) page.value = saved;
  reload(false);
});

function writePage(n: number) {
  const current = typeof route.query.page === 'string' ? route.query.page : '';
  const next = n > 1 ? String(n) : '';
  if (current === next) return;
  const query = {...route.query};
  if (n > 1) query.page = String(n);
  else delete query.page;
  router.replace({query});
}

watch(activeKey, () => {
  if (activeDoc.value === CURATED) reload(true);
});

function pickDoc(docName: string) {
  activeDoc.value = docName;
  reload(true);
}

async function reload(resetPage = true) {
  loading.value = true;
  if (resetPage) page.value = 1;
  try {
    if (activeDoc.value === CURATED) {
      const [articles, corpus] = await Promise.all([
        getLaws({
          category: activeKey.value || undefined,
          keyword: keyword.value.trim() || undefined,
        }),
        getCorpus({page: 1, pageSize: 1}),
      ]);
      corpusLaws.value = corpus.laws;
      articleList.value = articles.map(toCuratedCard);
      listTotal.value = articleList.value.length;
    } else {
      const corpus = await getCorpus({
        docName: activeDoc.value || undefined,
        keyword: keyword.value.trim() || undefined,
        page: page.value,
        pageSize,
      });
      corpusLaws.value = corpus.laws;
      listTotal.value = corpus.total;
      page.value = corpus.page;
      articleList.value = corpus.items.map((item) => ({
        key: item.key,
        category: shortLaw(item.source.replace(/^《/, '').split('》')[0] || ''),
        title: '',
        source: item.source,
        content: item.content,
      }));
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载法律条文失败');
  } finally {
    loading.value = false;
    writePage(page.value);
  }
}

function pageCount(): number {
  return Math.max(1, Math.ceil(listTotal.value / pageSize));
}

function goToPage() {
  const n = Number(jumpPage.value.trim());
  if (!Number.isInteger(n) || n < 1) {
    ElMessage.warning('请输入页码');
    return;
  }
  const target = Math.min(n, pageCount());
  jumpPage.value = '';
  if (target === page.value) return;
  // 先挡住分页组件的 current-change，避免它和这里各请求一次
  loading.value = true;
  page.value = target;
  if (activeDoc.value === CURATED) {
    loading.value = false;
    writePage(target);
    return;
  }
  reload(false);
}

function onPageChange() {
  if (loading.value) return;
  writePage(page.value);
  if (activeDoc.value === CURATED) return;
  reload(false);
}

function categoryTitle(key: string): string {
  return lawCategories.find((c) => c.key === key)?.title ?? key;
}

/** 从「《民法典》第1079条」拆出法律名与条号 */
function parseSource(source: string): {lawName: string; articleNo: string; shortName: string} {
  const m = source.match(/^(《[^》]+》)(.*)$/);
  if (!m) {
    return {lawName: source || '相关法律', articleNo: '', shortName: source || ''};
  }
  const lawName = m[1];
  const articleNo = (m[2] || '').trim();
  const shortName = lawName.replace('中华人民共和国', '');
  return {lawName, articleNo, shortName};
}

function toggleExpand(item: LawCard) {
  if (expandedIds.has(item.key)) {
    expandedIds.delete(item.key);
    return;
  }
  expandedIds.add(item.key);
  if (item.mysqlId) recordLawView(item.mysqlId).catch(() => {});
}

const paged = computed(() => {
  if (activeDoc.value !== CURATED) return articleList.value;
  const start = (page.value - 1) * pageSize;
  return articleList.value.slice(start, start + pageSize);
});

const uploadDialogVisible = ref(false);
const selectedFile = ref<File | null>(null);
const uploading = ref(false);
const uploadPhase = ref<'idle' | 'uploading' | 'parsing' | 'done'>('idle');
const uploadPercent = ref(0);

function handleFileChange(uploadFile: any) {
  selectedFile.value = uploadFile.raw;
  uploadPhase.value = 'idle';
  uploadPercent.value = 0;
}

async function doUpload() {
  if (!selectedFile.value || uploading.value) return;
  uploading.value = true;
  uploadPhase.value = 'uploading';
  uploadPercent.value = 30;
  try {
    // 模拟上传进度阶段：实际上传+解析由后端一次完成
    const tick = setInterval(() => {
      if (uploadPercent.value < 85) uploadPercent.value += 8;
    }, 200);
    uploadPhase.value = 'parsing';
    const result = await uploadDocument(selectedFile.value);
    clearInterval(tick);
    uploadPercent.value = 100;
    uploadPhase.value = 'done';
    ElMessage.success(
      `《${result.filename}》已入库（${result.chunkCount} 个分块${result.articleCount ? `，已同步 ${result.articleCount} 条法条` : ''}）`
    );
    if (result.articleCount || activeDoc.value !== CURATED) reload(true);
    setTimeout(() => {
      uploadDialogVisible.value = false;
      selectedFile.value = null;
      uploadPhase.value = 'idle';
      uploadPercent.value = 0;
    }, 600);
  } catch (error: any) {
    ElMessage.error('上传失败：' + (error?.message ?? '未知错误'));
    uploadPhase.value = 'idle';
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.laws-page {
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
.chip-count {
  margin-left: 4px;
  opacity: 0.75;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.kw-input {
  max-width: 520px;
  flex: 1;
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
.upload-btn {
  margin-left: auto;
}
.grid-wrap {
  min-height: 200px;
}
.law-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.law-card {
  background: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  box-shadow: var(--fz-shadow);
  transition: transform 0.15s, box-shadow 0.15s;
}
.law-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--fz-shadow-hover);
}
.card-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  min-height: 220px;
}
.cat-tag {
  display: inline-block;
  font-size: 12px;
  color: var(--fz-primary, #0f9d8f);
  background: var(--fz-primary-soft, #e6f7f5);
  border-radius: 4px;
  padding: 2px 8px;
  margin-bottom: 10px;
}
.law-name {
  font-size: 13px;
  color: var(--fz-muted, #909399);
  margin-bottom: 4px;
}
.article-no {
  font-size: 20px;
  font-weight: 700;
  color: var(--fz-dark, #0f2d40);
  margin-bottom: 4px;
}
.article-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fz-text, #303133);
  margin-bottom: 10px;
}
.law-content {
  margin: 0;
  font-size: 13px;
  color: var(--fz-text-secondary, #606266);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
.law-content.expanded {
  display: block;
  -webkit-line-clamp: unset;
  overflow: visible;
}
.law-footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.source-chip {
  font-size: 11px;
  color: var(--fz-muted, #909399);
  background: #f4f4f5;
  border-radius: 4px;
  padding: 2px 8px;
}
.expand-link {
  font-size: 13px;
  color: var(--fz-primary, #0f9d8f);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.expand-link:hover {
  text-decoration: underline;
}
.law-footer-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.law-pagination {
  margin-top: 0;
}
.page-search {
  width: 148px;
  flex-shrink: 0;
}
.upload-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.upload-status {
  font-size: 13px;
  color: var(--fz-text-secondary, #606266);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 960px) {
  .law-grid {
    grid-template-columns: 1fr;
  }
}
</style>
