<template>
  <div class="login-page">
    <div class="header">
      <div class="logo">法制通</div>
      <div class="slogan">AI 法律助手 · 随身可问</div>
    </div>

    <van-tabs v-model:active="activeTab" class="tabs" @change="onTabChange">
      <van-tab title="登录">
        <p class="demo-account">账号 user　密码 123456</p>
        <van-form @submit="onSubmit">
          <van-cell-group inset>
            <van-field
              v-model="username"
              name="username"
              label="用户名"
              placeholder="请输入用户名"
              :error="!!fieldError.username"
              :error-message="fieldError.username"
            />
            <van-field
              v-model="password"
              type="password"
              name="password"
              label="密码"
              placeholder="请输入密码"
              :error="!!fieldError.password"
              :error-message="fieldError.password"
            />
          </van-cell-group>
          <div class="extra">
            <van-checkbox v-model="rememberMe" shape="square" icon-size="16px">记住我</van-checkbox>
          </div>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="loading" :loading-text="'登录中...'">
              登录
            </van-button>
          </div>
          <p class="switch-hint">
            还没有账号？
            <button type="button" @click="activeTab = 1">立即注册</button>
          </p>
        </van-form>
      </van-tab>

      <van-tab title="注册">
        <van-form @submit="onSubmit">
          <van-cell-group inset>
            <van-field
              v-model="username"
              name="username"
              label="用户名"
              placeholder="3-20 个字符"
              :error="!!fieldError.username"
              :error-message="fieldError.username"
            />
            <van-field
              v-model="password"
              type="password"
              name="password"
              label="密码"
              placeholder="至少 6 位"
              :error="!!fieldError.password"
              :error-message="fieldError.password"
            />
            <van-field
              v-model="confirmPassword"
              type="password"
              name="confirm"
              label="确认密码"
              placeholder="再次输入密码"
              :error="!!fieldError.confirm"
              :error-message="fieldError.confirm"
            />
          </van-cell-group>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="loading" :loading-text="'注册中...'">
              注册并登录
            </van-button>
          </div>
          <p class="switch-hint">
            已有账号？
            <button type="button" @click="activeTab = 0">去登录</button>
          </p>
        </van-form>
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup lang="ts">
import {reactive, ref} from 'vue';
import {useRouter} from 'vue-router';
import {showSuccessToast} from 'vant';
import {login, register} from '@/services/auth';

const DEMO_USERNAME = 'user';
const DEMO_PASSWORD = '123456';
const activeTab = ref(0);
const username = ref(DEMO_USERNAME);
const password = ref(DEMO_PASSWORD);
const confirmPassword = ref('');
const rememberMe = ref(true);
const loading = ref(false);
const formError = ref('');
const fieldError = reactive({username: '', password: '', confirm: ''});
const router = useRouter();

function clearError() {
  formError.value = '';
  fieldError.username = '';
  fieldError.password = '';
  fieldError.confirm = '';
}

function onTabChange() {
  clearError();
  if (activeTab.value === 0) {
    username.value = DEMO_USERNAME;
    password.value = DEMO_PASSWORD;
    confirmPassword.value = '';
  } else {
    username.value = '';
    password.value = '';
    confirmPassword.value = '';
  }
}

async function onSubmit() {
  clearError();
  if (!username.value.trim()) {
    fieldError.username = '请填写用户名';
    return;
  }
  if (!password.value) {
    fieldError.password = '请填写密码';
    return;
  }
  if (activeTab.value === 1) {
    if (password.value.length < 6) {
      fieldError.password = '密码至少 6 位';
      return;
    }
    if (password.value !== confirmPassword.value) {
      fieldError.confirm = '两次输入的密码不一致';
      return;
    }
  }
  loading.value = true;
  try {
    if (activeTab.value === 0) {
      await login(username.value.trim(), password.value, rememberMe.value);
    } else {
      await register(username.value.trim(), password.value, rememberMe.value);
    }
    showSuccessToast('登录成功');
    router.replace('/');
  } catch {
    formError.value = activeTab.value === 0 ? '用户名或密码错误' : '注册失败，请换个用户名试试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f2d40 0%, #0d3b46 40%, #f3f5f7 40%);
  padding-bottom: 40px;
}
.header {
  padding: 72px 0 36px;
  text-align: center;
  color: #fff;
}
.logo {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 4px;
  background: linear-gradient(90deg, #2ad4a4, #0f9d8f);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: brightness(1.3);
}
.slogan {
  margin-top: 10px;
  font-size: 14px;
  opacity: 0.85;
}
.demo-account {
  margin: 16px 16px 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f3fbf9;
  color: #0f766e;
  font-size: 13px;
  text-align: center;
}
.tabs {
  margin: 0 16px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  padding-bottom: 20px;
  border: 1px solid var(--fz-border, #ebedf0);
}
.extra {
  margin: 12px 28px 0;
}
.form-error {
  margin: 10px 28px 0;
  color: var(--fz-error, #ee0a24);
  font-size: 13px;
}
.submit-wrap {
  margin: 20px 16px 0;
}
.switch-hint {
  margin: 14px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--fz-muted, #969799);
}
.switch-hint button {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--fz-primary, #0f9d8f);
  font-size: inherit;
}
</style>
