<!-- 登录/注册页面：独立页面，不显示侧边栏 -->
<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 系统标题 -->
      <h2 class="login-title">法制通</h2>
      <p class="login-subtitle">法律智能问答系统</p>

      <!-- 登录/注册切换标签 -->
      <el-tabs v-model="mode" class="login-tabs" stretch>
        <!-- 登录面板 -->
        <el-tab-pane label="登录" name="login">
          <el-form @submit.prevent="handleSubmit">
            <el-form-item>
              <el-input v-model="username" placeholder="用户名" :prefix-icon="User" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="password" type="password" placeholder="密码" show-password :prefix-icon="Lock" @keyup.enter="handleSubmit" />
            </el-form-item>
            <el-button type="primary" class="submit-btn" :loading="loading" @click="handleSubmit">
              登录
            </el-button>
          </el-form>
        </el-tab-pane>

        <!-- 注册面板 -->
        <el-tab-pane label="注册" name="register">
          <el-form @submit.prevent="handleSubmit">
            <el-form-item>
              <el-input v-model="username" placeholder="用户名（3-20 个字符）" :prefix-icon="User" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="password" type="password" placeholder="密码（至少 6 位）" show-password :prefix-icon="Lock" @keyup.enter="handleSubmit" />
            </el-form-item>
            <el-button type="primary" class="submit-btn" :loading="loading" @click="handleSubmit">
              注册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从 vue 中引入响应式 API 和路由
import { ref } from 'vue';
import { useRouter } from 'vue-router';
// 引入 Element Plus 的消息提示和图标
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
// 引入认证 API
import { login, register } from '../services/auth';

// 路由实例，登录成功后跳转首页
const router = useRouter();

// 当前处于登录还是注册面板
const mode = ref<'login' | 'register'>('login');
// 表单数据
const username = ref('');
const password = ref('');
// 提交中标记，防止重复点击
const loading = ref(false);

// 提交处理：按当前面板调用登录或注册
const handleSubmit = async () => {
  // 基本校验
  if (!username.value.trim() || !password.value) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  if (loading.value) return;
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await login(username.value.trim(), password.value);
      ElMessage.success('登录成功');
    } else {
      await register(username.value.trim(), password.value);
      ElMessage.success('注册成功，已自动登录');
    }
    // 成功就回首页
    router.push('/');
  } catch (error: any) {
    // 失败提示后端返回的具体原因（如"用户名已被注册"）
    ElMessage.error(error.response?.data?.message || error.message);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* 整页居中，给卡片一个背景色 */
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

/* 登录卡片 */
.login-card {
  width: 380px;
  background-color: #fff;
  border-radius: 12px;
  padding: 36px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* 系统标题 */
.login-title {
  margin: 0;
  text-align: center;
  font-size: 28px;
  color: #303133;
}

/* 副标题 */
.login-subtitle {
  margin: 8px 0 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

/* 提交按钮占满整行 */
.submit-btn {
  width: 100%;
}
</style>
