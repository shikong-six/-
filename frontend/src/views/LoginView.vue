<!-- 登录/注册页面：记住我、确认密码、行内错误、加载态 -->
<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">⚖️</div>
      <h2 class="login-title">法制通</h2>
      <p class="login-subtitle">法律知识服务平台 · LEGAL KNOWLEDGE PLATFORM</p>
      <div class="title-divider"></div>

      <el-tabs v-model="mode" class="login-tabs" stretch @tab-change="onTabChange">
        <el-tab-pane label="登录" name="login">
          <p class="demo-account">账号 user　密码 123456</p>
          <el-form @submit.prevent="handleSubmit">
            <el-form-item :class="{ 'is-error': !!fieldError.username }">
              <el-input
                v-model="username"
                placeholder="用户名"
                :prefix-icon="User"
                :class="{ 'input-error': !!fieldError.username }"
                @input="fieldError.username = ''"
              />
              <div v-if="fieldError.username" class="field-error">{{ fieldError.username }}</div>
            </el-form-item>
            <el-form-item :class="{ 'is-error': !!fieldError.password }">
              <el-input
                v-model="password"
                type="password"
                placeholder="密码"
                show-password
                :prefix-icon="Lock"
                :class="{ 'input-error': !!fieldError.password }"
                @keyup.enter="handleSubmit"
                @input="fieldError.password = ''"
              />
              <div v-if="fieldError.password" class="field-error">{{ fieldError.password }}</div>
            </el-form-item>
            <div class="form-extra">
              <el-checkbox v-model="rememberMe">记住我</el-checkbox>
            </div>
            <div v-if="formError" class="form-error">{{ formError }}</div>
            <el-button type="primary" class="submit-btn" :loading="loading" :disabled="loading" @click="handleSubmit">
              {{ loading ? '登录中...' : '登录' }}
            </el-button>
            <p class="switch-hint">
              还没有账号？
              <a href="javascript:;" @click="mode = 'register'">立即注册</a>
            </p>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form @submit.prevent="handleSubmit">
            <el-form-item>
              <el-input
                v-model="username"
                placeholder="用户名（3-20 个字符）"
                :prefix-icon="User"
                :class="{ 'input-error': !!fieldError.username }"
                @input="fieldError.username = ''"
              />
              <div v-if="fieldError.username" class="field-error">{{ fieldError.username }}</div>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="password"
                type="password"
                placeholder="密码（至少 6 位）"
                show-password
                :prefix-icon="Lock"
                :class="{ 'input-error': !!fieldError.password }"
                @input="fieldError.password = ''"
              />
              <div v-if="fieldError.password" class="field-error">{{ fieldError.password }}</div>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="confirmPassword"
                type="password"
                placeholder="确认密码"
                show-password
                :prefix-icon="Lock"
                :class="{ 'input-error': !!fieldError.confirm }"
                @keyup.enter="handleSubmit"
                @input="fieldError.confirm = ''"
              />
              <div v-if="fieldError.confirm" class="field-error">{{ fieldError.confirm }}</div>
            </el-form-item>
            <div v-if="formError" class="form-error">{{ formError }}</div>
            <el-button type="primary" class="submit-btn" :loading="loading" :disabled="loading" @click="handleSubmit">
              {{ loading ? '注册中...' : '注册' }}
            </el-button>
            <p class="switch-hint">
              已有账号？
              <a href="javascript:;" @click="mode = 'login'">去登录</a>
            </p>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { login, register } from '../services/auth';

const router = useRouter();
const DEMO_USERNAME = 'user';
const DEMO_PASSWORD = '123456';
const mode = ref<'login' | 'register'>('login');
const username = ref(DEMO_USERNAME);
const password = ref(DEMO_PASSWORD);
const confirmPassword = ref('');
const rememberMe = ref(true);
const loading = ref(false);
const formError = ref('');
const fieldError = reactive({ username: '', password: '', confirm: '' });

function clearErrors() {
  formError.value = '';
  fieldError.username = '';
  fieldError.password = '';
  fieldError.confirm = '';
}

function onTabChange() {
  clearErrors();
  if (mode.value === 'login') {
    username.value = DEMO_USERNAME;
    password.value = DEMO_PASSWORD;
    confirmPassword.value = '';
  } else {
    username.value = '';
    password.value = '';
    confirmPassword.value = '';
  }
}

const handleSubmit = async () => {
  clearErrors();
  if (!username.value.trim()) {
    fieldError.username = '请输入用户名';
    return;
  }
  if (!password.value) {
    fieldError.password = '请输入密码';
    return;
  }
  if (mode.value === 'register') {
    if (password.value.length < 6) {
      fieldError.password = '密码至少 6 位';
      return;
    }
    if (password.value !== confirmPassword.value) {
      fieldError.confirm = '两次输入的密码不一致';
      return;
    }
  }
  if (loading.value) return;
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await login(username.value.trim(), password.value, rememberMe.value);
      ElMessage.success('登录成功');
    } else {
      await register(username.value.trim(), password.value, rememberMe.value);
      ElMessage.success('注册成功，已自动登录');
    }
    router.push('/');
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || '操作失败';
    // 登录失败统一文案（对齐方案）
    formError.value = mode.value === 'login' ? '用户名或密码错误' : msg;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f2d40 0%, #16324a 55%, #0d3b46 100%);
}
.login-card {
  width: 380px;
  background-color: rgba(255, 255, 255, 0.97);
  border-radius: 16px;
  padding: 40px 36px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.login-logo {
  text-align: center;
  font-size: 42px;
  line-height: 1;
  margin-bottom: 10px;
}
.login-title {
  margin: 0;
  text-align: center;
  font-size: 30px;
  letter-spacing: 4px;
  background: linear-gradient(90deg, #2ad4a4, #0f9d8f);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.login-subtitle {
  margin: 10px 0 0;
  text-align: center;
  color: #909399;
  font-size: 12px;
  letter-spacing: 1px;
}
.title-divider {
  width: 60px;
  height: 3px;
  margin: 20px auto 24px;
  border-radius: 2px;
  background: linear-gradient(90deg, #2ad4a4, #0f9d8f);
}
.login-tabs :deep(.el-tabs__item.is-active) {
  color: #0f9d8f;
}
.login-tabs :deep(.el-tabs__active-bar) {
  background-color: #0f9d8f;
}
.demo-account {
  margin: 0 0 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f3fbf9;
  color: #0f766e;
  font-size: 13px;
  text-align: center;
}
.form-extra {
  margin: -4px 0 12px;
}
.form-error {
  color: var(--fz-error, #f56c6c);
  font-size: 13px;
  margin-bottom: 10px;
}
.field-error {
  color: var(--fz-error, #f56c6c);
  font-size: 12px;
  line-height: 1.4;
  margin-top: 4px;
}
.input-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--fz-error, #f56c6c) inset !important;
}
.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
  border-color: transparent;
  font-weight: 600;
  letter-spacing: 4px;
}
.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2ad4a4 0%, #0f9d8f 100%);
  border-color: transparent;
}
.submit-btn:active:not(:disabled) {
  background: #0a7369;
}
.submit-btn.is-disabled,
.submit-btn:disabled {
  opacity: 0.65;
}
.switch-hint {
  margin: 14px 0 0;
  text-align: center;
  font-size: 13px;
  color: #909399;
}
.switch-hint a {
  color: #0f9d8f;
  text-decoration: none;
}
.switch-hint a:hover {
  text-decoration: underline;
}
</style>
