// 引入 Vue 的 createApp，用于创建应用实例
import {createApp} from 'vue';
// 引入 Element Plus 组件库
import ElementPlus from 'element-plus';
// 引入 Element Plus 的全局样式
import 'element-plus/dist/index.css'
// 引入根组件
import App from './App.vue';
// 引入路由实例
import router from './router';
// 引入 Pinia 状态管理实例
import store from './store';

 // 创建应用实例
 const app=createApp(App);
 // 注册 Element Plus
 app.use(ElementPlus);
 // 注册路由
 app.use(router);
 // 注册状态管理
 app.use(store);
 // 挂载到 index.html 中的 #app 节点
 app.mount('#app');