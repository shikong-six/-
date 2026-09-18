import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import {VantResolver} from 'unplugin-vue-components/resolvers';
import {fileURLToPath, URL} from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    // Vant 按需引入：模板里用到哪个组件就自动注册并引入样式
    Components({resolvers: [VantResolver()]}),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8081,
    // 监听局域网 IP：手机连同一 WiFi 可直接访问 http://<电脑IP>:8081 做真机调试
    host: true,
    // 所有 /api 请求代理到后端（与 Web 端 webpack devServer 同思路）
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
