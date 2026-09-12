<!--系统首页：渐变横幅介绍 + 统计卡片 + 快捷入口-->
<template>
  <div class="home">
    <!--系统介绍区：渐变横幅-->
    <div class="hero">
      <!--大标题-->
      <h1>欢迎来到法制通</h1>
      <!--副标题，说明系统定位-->
      <p class="subtitle">基于 Kimi 大模型 + RAG 检索增强的法律智能问答系统</p>
      <!--一句话说明系统能做什么-->
      <p class="desc">上传法律文档构建知识库，提问即可获取附有法条引用的专业回答，答案可溯源、更可信。</p>
      <!--点击按钮跳转到智能问答页面-->
      <el-button class="hero-btn" size="large" @click="$router.push('/chat')">
        开始提问
      </el-button>
    </div>

    <!--统计卡片区：知识库文档数 / 累计问答数 / 今日问答数-->
    <div class="stats-cards" v-loading="statsLoading">
      <!--单张统计卡片：知识库文档-->
      <div class="stat-card">
        <!--卡片图标-->
        <el-icon class="stat-icon"><Collection /></el-icon>
        <!--卡片数字-->
        <div class="stat-value">{{ stats.documentCount }}</div>
        <!--卡片标签-->
        <div class="stat-label">知识库文档</div>
      </div>
      <!--单张统计卡片：累计问答-->
      <div class="stat-card">
        <!--卡片图标-->
        <el-icon class="stat-icon"><ChatDotRound /></el-icon>
        <!--卡片数字-->
        <div class="stat-value">{{ stats.totalQaCount }}</div>
        <!--卡片标签-->
        <div class="stat-label">累计问答</div>
      </div>
      <!--单张统计卡片：今日问答-->
      <div class="stat-card">
        <!--卡片图标-->
        <el-icon class="stat-icon"><Sunny /></el-icon>
        <!--卡片数字-->
        <div class="stat-value">{{ stats.todayQaCount }}</div>
        <!--卡片标签-->
        <div class="stat-label">今日问答</div>
      </div>
    </div>

    <!--热门问题区：点击自动跳问答页发问-->
    <div class="hot-questions">
      <h3 class="hot-title">热门问题</h3>
      <div class="hot-list">
        <!--单个热门问题：点击跳转发问-->
        <div v-for="(q,index) in hotQuestions" :key="index" class="hot-item" @click="askQuestion(q)">
          <!--问题序号-->
          <span class="hot-index">{{ index+1 }}</span>
          <!--问题文本-->
          <span class="hot-text">{{ q }}</span>
        </div>
      </div>
    </div>

    <!--快捷入口区：三个功能页的快捷跳转卡片-->
    <div class="quick-links">
      <!--知识库入口卡片-->
      <div class="quick-card" @click="$router.push('/knowledge/list')">
        <!--入口图标-->
        <el-icon class="quick-icon"><Collection /></el-icon>
        <!--入口标题-->
        <div class="quick-title">知识库管理</div>
        <!--入口描述-->
        <div class="quick-desc">上传法律文档，构建专属法律知识库</div>
      </div>
      <!--智能问答入口卡片-->
      <div class="quick-card" @click="$router.push('/chat')">
        <!--入口图标-->
        <el-icon class="quick-icon"><ChatDotRound /></el-icon>
        <!--入口标题-->
        <div class="quick-title">智能问答</div>
        <!--入口描述-->
        <div class="quick-desc">基于知识库的智能法律咨询，答案附引用</div>
      </div>
      <!--会话历史入口卡片-->
      <div class="quick-card" @click="$router.push('/history')">
        <!--入口图标-->
        <el-icon class="quick-icon"><Clock /></el-icon>
        <!--入口标题-->
        <div class="quick-title">会话历史</div>
        <!--入口描述-->
        <div class="quick-desc">查看过往问答记录，随时继续对话</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API 和生命周期钩子
import { ref, onMounted } from 'vue';
// 引入路由跳转（热门问题点击跳问答页）
import { useRouter } from 'vue-router';
// 引入 Element Plus 的消息提示组件
import { ElMessage } from 'element-plus';
// 引入统计卡片用的图标
import { Collection, ChatDotRound, Sunny, Clock } from '@element-plus/icons-vue';
// 引入统计接口封装
import { getStats } from '../services/stats';
// 类型用 import type 单独引入
import type { StatsData } from '../services/stats';

// 路由实例
const router = useRouter();

// 热门问题列表（预置常见法律咨询问题，点击自动发问）
const hotQuestions = [
  '经济补偿金怎么算？',
  '公司不签劳动合同怎么办？',
  '试用期被辞退有赔偿吗？',
  '加班费怎么计算？'
];

// 点击热门问题：暂存问题 → 跳问答页（ChatView 读取后自动发送）
const askQuestion = (question: string) => {
  // 暂存到 sessionStorage（跨页传递，刷新即失效，比 Vuex/Pinia 轻量）
  sessionStorage.setItem('fazhitong_pending_question', question);
  // 跳问答页
  router.push('/chat');
};

// 统计数据，初始全为 0，页面加载后再从后端拉取
const stats = ref<StatsData>({ documentCount: 0, totalQaCount: 0, todayQaCount: 0 });
// 统计接口加载中标记
const statsLoading = ref(false);

// 页面加载时获取统计数据
onMounted(() => {
  loadStats();
});

// 从后端加载统计数据
const loadStats = async () => {
  // 标记加载中
  statsLoading.value = true;
  try {
    // 调用 /api/stats 接口
    stats.value = await getStats();
  } catch (error: any) {
    // 加载失败提示错误（卡片保持 0 显示）
    ElMessage.error('加载统计数据失败：' + error.message);
  } finally {
    // 无论成功失败都取消加载标记
    statsLoading.value = false;
  }
};
</script>

<style scoped>
/*首页整体居中，顶部留白*/
.home{
  text-align:center;
  padding-top:10px;
}

/*系统介绍区：蓝色渐变横幅，白字*/
.hero{
  background: linear-gradient(135deg, #409eff 0%, #2b6fd4 100%);
  border-radius: 12px;
  padding: 44px 20px;
  margin-bottom: 28px;
  color: #fff;
}

/*大标题样式*/
.home h1{
  font-size: 32px;
  margin: 0 0 12px;
  color: #fff;
}

/*副标题样式*/
.subtitle{
  color: rgba(255, 255, 255, 0.92);
  font-size: 16px;
  margin: 0 0 10px;
}

/*系统能力描述*/
.desc{
  color: rgba(255, 255, 255, 0.78);
  margin: 0 0 24px;
  font-size: 14px;
}

/*横幅里的开始提问按钮：白底主色字*/
.hero-btn{
  background-color: #fff;
  border-color: #fff;
  color: #2b6fd4;
  font-weight: bold;
}

/*鼠标悬停按钮：微上浮*/
.hero-btn:hover{
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/*统计卡片容器：三张卡片横排，水平居中*/
.stats-cards{
  display:flex;
  justify-content:center;
  gap:24px;
  margin-bottom:28px;
}

/*单张统计卡片样式：悬停上浮*/
.stat-card{
  width:200px;
  background-color:#fff;
  border-radius:8px;
  padding:24px 0;
  box-shadow:0 2px 12px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

/*统计卡片悬停效果*/
.stat-card:hover{
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.2);
}

/*卡片图标：主色*/
.stat-icon{
  font-size: 28px;
  color: #409eff;
  margin-bottom: 8px;
}

/*卡片数字样式*/
.stat-value{
  font-size:36px;
  font-weight:bold;
  color:#409eff;
  margin-bottom:8px;
}

/*卡片标签样式*/
.stat-label{
  color:#909399;
  font-size:14px;
}

/*快捷入口容器：三张卡片横排，水平居中*/
.quick-links{
  display:flex;
  justify-content:center;
  gap:24px;
}

/*热门问题区*/
.hot-questions{
  margin-bottom: 28px;
}

/*热门问题标题*/
.hot-title{
  font-size: 18px;
  color: #303133;
  margin: 0 0 14px;
}

/*热门问题列表：两列排布*/
.hot-list{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}

/*单个热门问题：白底卡片，悬停加主色边框*/
.hot-item{
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #fff;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: border-color 0.2s, box-shadow 0.2s;
}

/*热门问题悬停效果*/
.hot-item:hover{
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64,158,255,0.2);
}

/*问题序号：主色圆形底*/
.hot-index{
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background-color: #ecf5ff;
  color: #409eff;
  font-size: 12px;
  flex-shrink: 0;
}

/*问题文本*/
.hot-text{
  font-size: 14px;
  color: #606266;
}

/*单个快捷入口卡片：悬停加主色阴影和边框*/
.quick-card{
  width:220px;
  background-color:#fff;
  border: 1px solid transparent;
  border-radius:8px;
  padding:24px 20px;
  box-shadow:0 2px 12px rgba(0,0,0,0.06);
  cursor:pointer;
  text-align:left;
  transition: box-shadow 0.2s, border-color 0.2s;
}

/*入口卡片悬停效果*/
.quick-card:hover{
  border-color: #409eff;
  box-shadow:0 6px 20px rgba(64,158,255,0.25);
}

/*入口图标：主色大图标*/
.quick-icon{
  font-size: 26px;
  color: #409eff;
  margin-bottom: 10px;
}

/*入口标题样式*/
.quick-title{
  font-size:16px;
  font-weight:bold;
  color:#303133;
  margin-bottom:8px;
}

/*入口描述样式*/
.quick-desc{
  font-size:13px;
  color:#909399;
  line-height:1.6;
}
</style>
