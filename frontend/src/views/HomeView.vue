<!-- 门户首页：Hero + 统计 + 热门问题 + 核心功能 -->
<template>
  <div class="home">
    <div class="hero">
      <h1>AI 法律助手，让法律知识更容易获取</h1>
      <p class="subtitle">基于法律知识库与 RAG 检索增强，为你提供可追溯的法律信息与智能问答。</p>
      <div class="hero-actions">
        <el-button class="hero-btn primary" size="large" @click="$router.push('/chat')">
          开始咨询
        </el-button>
        <el-button class="hero-btn ghost" size="large" @click="$router.push('/laws')">
          浏览法律条文
        </el-button>
      </div>
    </div>

    <div class="stats-cards" v-loading="statsLoading">
      <div class="stat-card">
        <el-icon class="stat-icon"><Collection /></el-icon>
        <div class="stat-value">{{ stats.documentCount }}</div>
        <div class="stat-label">知识库文档</div>
      </div>
      <div class="stat-card">
        <el-icon class="stat-icon"><ChatDotRound /></el-icon>
        <div class="stat-value">{{ stats.totalQaCount }}</div>
        <div class="stat-label">累计问答</div>
      </div>
      <div class="stat-card">
        <el-icon class="stat-icon"><Sunny /></el-icon>
        <div class="stat-value">{{ stats.todayQaCount }}</div>
        <div class="stat-label">今日问答</div>
      </div>
    </div>

    <div class="hot-questions">
      <h3 class="section-title">热门问题</h3>
      <div class="hot-list">
        <div v-for="(q, index) in hotQuestions" :key="index" class="hot-item" @click="askQuestion(q)">
          <span class="hot-index">{{ index + 1 }}</span>
          <span class="hot-text">{{ q }}</span>
        </div>
      </div>
    </div>

    <!-- 核心功能入口（放在热门问题下方） -->
    <div class="core-features">
      <h3 class="section-title">核心功能</h3>
      <div class="feature-list">
        <div class="feature-item" @click="$router.push('/cases')">
          <div class="feature-title">案例检索</div>
          <div class="feature-desc">快速查找相关法律案例</div>
        </div>
        <div class="feature-item" @click="$router.push('/laws')">
          <div class="feature-title">法律条文</div>
          <div class="feature-desc">搜索法律法规与具体条款</div>
        </div>
        <div class="feature-item" @click="$router.push('/chat')">
          <div class="feature-title">AI 法律咨询</div>
          <div class="feature-desc">基于知识库智能回答</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Collection, ChatDotRound, Sunny} from '@element-plus/icons-vue';
import {getStats} from '@/services/stats';
import type {StatsData} from '@/services/stats';

const router = useRouter();

const hotQuestions = [
  '经济补偿金怎么算？',
  '公司不签劳动合同怎么办？',
  '试用期被辞退有赔偿吗？',
  '加班费怎么计算？'
];

function askQuestion(question: string) {
  sessionStorage.setItem('fazhitong_pending_question', question);
  router.push('/chat');
}

const stats = ref<StatsData>({documentCount: 0, totalQaCount: 0, todayQaCount: 0});
const statsLoading = ref(false);

onMounted(() => {
  loadStats();
});

async function loadStats() {
  statsLoading.value = true;
  try {
    stats.value = await getStats();
  } catch (error: any) {
    ElMessage.error('加载统计数据失败：' + error.message);
  } finally {
    statsLoading.value = false;
  }
}
</script>

<style scoped>
.home {
  max-width: var(--fz-page-max, 1400px);
  margin: 0 auto;
  text-align: center;
  padding-top: 10px;
}
.hero {
  background: linear-gradient(135deg, #0f9d8f 0%, #0c7a70 100%);
  border-radius: var(--fz-radius, 12px);
  padding: 48px 24px;
  margin-bottom: 28px;
  color: #fff;
}
.home h1 {
  font-size: var(--fz-title, 28px);
  font-weight: 700;
  margin: 0 0 12px;
  color: #fff;
}
.subtitle {
  color: rgba(255, 255, 255, 0.92);
  font-size: 15px;
  margin: 0 0 28px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-btn.primary {
  background-color: #fff;
  border-color: #fff;
  color: #0f9d8f;
  font-weight: 700;
}
.hero-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.hero-btn.ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.75);
  color: #fff;
  font-weight: 600;
}
.hero-btn.ghost:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: #fff;
  color: #fff;
}

.stats-cards {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}
.stat-card {
  width: 200px;
  background-color: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 24px 0;
  box-shadow: var(--fz-shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--fz-shadow-hover);
}
.stat-icon {
  font-size: 28px;
  color: var(--fz-primary, #0f9d8f);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: var(--fz-primary, #0f9d8f);
  margin-bottom: 8px;
}
.stat-label {
  color: var(--fz-muted, #909399);
  font-size: var(--fz-aux, 13px);
}

.section-title {
  font-size: var(--fz-module, 20px);
  font-weight: 600;
  color: var(--fz-text, #303133);
  margin: 0 0 14px;
  text-align: left;
}
.hot-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto 28px;
}
.hot-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 14px 16px;
  cursor: pointer;
  text-align: left;
  box-shadow: var(--fz-shadow);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}
.hot-item:hover {
  border-color: var(--fz-primary, #0f9d8f);
  box-shadow: var(--fz-shadow-hover);
  transform: translateY(-2px);
}
.hot-index {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: var(--fz-primary-soft, #e6f7f5);
  color: var(--fz-primary, #0f9d8f);
  font-size: 12px;
  flex-shrink: 0;
}
.hot-text {
  font-size: var(--fz-body, 14px);
  color: var(--fz-text-secondary, #606266);
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}
.feature-item {
  background: var(--fz-card, #fff);
  border: 1px solid var(--fz-border, #E5E7EB);
  border-radius: var(--fz-radius, 12px);
  padding: 20px 18px;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--fz-shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--fz-shadow-hover);
}
.feature-title {
  font-size: var(--fz-card-title, 17px);
  font-weight: 600;
  color: var(--fz-text, #303133);
  margin-bottom: 6px;
}
.feature-desc {
  font-size: var(--fz-aux, 13px);
  color: var(--fz-muted, #909399);
}

@media (max-width: 768px) {
  .hot-list,
  .feature-list {
    grid-template-columns: 1fr;
  }
}
</style>
