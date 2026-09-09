// 引入 Vue Router 的两个函数
// createRouter 用于创建路由实例
// createWebHistory 用于使用 HTML5 的 history 模式
import {createRouter,createWebHistory} from 'vue-router';

// 定义路由表
// 每个路由对象包含：
// path：访问路径
// name：路由名称
// component：对应的页面组件，用 ()=>import() 实现懒加载
const routes=[
{
    path:'/',
    name:'Home',
    component:()=>import('@/views/HomeView.vue')
},
{
    path:'/chat',
    name:'Chat',
    component:()=>import('@/views/ChatView.vue')
},
{
    path:'/Knowledge',
    name:'Knowledge',
    component:()=>import('@/views/KnowledgeView.vue')
},
{
    path:'/history',
    name:'History',
    component:()=>import('@/views/HistoryView.vue')
}
];

//创建路由实例
const router=createRouter({
    //使用history模式，URL不要#
    history:createWebHistory(),
    routes
});
//导出路由实例，供main.ts使用
export default router;
