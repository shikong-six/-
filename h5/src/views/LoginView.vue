<template>
  <div class="login-page">
    <div class="header">
      <div class="logo">法制通</div>
      <div class="slogan">随身法律顾问</div>
    </div>

    <van-tabs v-model:active="activeTab" class="tabs">
      <van-tab title="登录">
        <van-form @submit="onSubmit">
          <van-cell-group inset>
            <van-field
              v-model="username"
              name="username"
              label="用户名"
              placeholder="请输入用户名"
              :rules="[{required: true, message: '请填写用户名'}]"
            />
            <van-field
              v-model="password"
              type="password"
              name="password"
              label="密码"
              placeholder="请输入密码"
              :rules="[{required: true, message: '请填写密码'}]"
            />
          </van-cell-group>
          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="loading">
              登录
            </van-button>
          </div>
        </van-form>
      </van-tab>

      <van-tab title="注册">
        <van-form @submit="onSubmit">
          <van-cell-group inset>
            <van-field
              v-model="username"
              name="username"
              label="用户名"
              placeholder="请设置用户名"
              :rules="[{required: true, message: '请填写用户名'}]"
            />
            <van-field
              v-model="password"
              type="password"
              name="password"
              label="密码"
              placeholder="请设置密码（至少 6 位）"
              :rules="[
                {required: true, message: '请填写密码'},
                {validator: (v: string) => v.length >= 6, message: '密码至少 6 位'},
              ]"
            />
          </van-cell-group>
          <div class="submit-wrap">
            <van-button round block type="primary" native-type="submit" :loading="loading">
              注册并登录
            </van-button>
          </div>
        </van-form>
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {useRouter} from 'vue-router';
import {showFailToast, showSuccessToast} from 'vant';
import {login, register} from '@/services/auth';

// 当前 tab：0 登录，1 注册
const activeTab = ref(0);
const username = ref('');
const password = ref('');
const loading = ref(false);
const router = useRouter();

// 提交：按当前 tab 调登录或注册（后端注册成功即返回 token）
async function onSubmit() {
  loading.value = true;
  try {
    if (activeTab.value === 0) {
      await login(username.value, password.value);
    } else {
      await register(username.value, password.value);
    }
    showSuccessToast('登录成功');
    // replace 而不是 push：登录后按返回键不回登录页
    router.replace('/');
  } catch (e) {
    showFailToast(e instanceof Error ? e.message : '操作失败，请稍后再试');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  /* 顶部渐变，与 Web 端视觉风格呼应 */
  background: linear-gradient(180deg, #4a6cf7 0%, #f7f8fa 45%);
  padding-bottom: 40px;
}

.header {
  padding: 80px 0 40px;
  text-align: center;
  color: #fff;
}

.logo {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 4px;
}

.slogan {
  margin-top: 10px;
  font-size: 14px;
  opacity: 0.85;
}

.tabs {
  /* 圆角卡片式 tab 区 */
  margin: 0 16px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  padding-bottom: 24px;
}

.submit-wrap {
  margin: 24px 16px 0;
}
</style>
