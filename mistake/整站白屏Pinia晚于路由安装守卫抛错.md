# 整站白屏：Pinia 晚于路由安装，路由守卫里 useStore() 抛错

## 问题现象

Web 端打开任何页面都是**白屏**，地址栏正常、页面标题正常，DevTools 的 Elements 里 `<div id="app">` 是空的（Vue 根本没渲染），控制台报 7 个错。dev server 日志显示 `compiled successfully`——**编译没有任何报错，是运行时崩的**。

## 排查步骤（按这个顺序可以十分钟定位）

1. **先看构建/编译层**：dev server 日志 `compiled successfully` → 排除语法错误、类型错误、缺文件
2. **再看 DOM**：Elements 里 `#app` 为空 → Vue 没渲染，不是样式问题（样式问题会有 DOM 只是看不见）
3. **缩小范围**：白屏发生在路由页面 → 嫌疑集中在三处：main.ts 启动流程、路由守卫、根组件 setup
4. **时间线回溯**：这个 bug 是什么时候引入的？上一次浏览器里还是好的，之后动过的是"登录态接 Pinia"改造 → 新引入的依赖是 Pinia
5. **看启动顺序**（`main.ts`）：

```ts
app.use(ElementPlus);
app.use(router);   // ← 第 19 行：路由先装
app.use(store);    // ← 第 21 行：Pinia 后装
```

顺序一摆出来，原因立刻可见。

## 问题原因

`app.use(router)` 不只是"注册路由"——**它会立即触发首次导航**（vue-router 4 的 install 行为）。首次导航要执行全局守卫：

```
app.use(router)
  → 立即首次导航
    → beforeEach 守卫
      → isLoggedIn()           （auth.ts）
        → useUserStore()       （改造后委托给 Pinia store）
          → getActivePinia()   → undefined！Pinia 还没装
            → 抛错：getActivePinia() was called but there was no active Pinia
```

守卫抛错 → 首次导航失败 → `router-view` 永远不会渲染 → 白屏。

**为什么以前没事**：Pinia 改造前，守卫的 `isLoggedIn()` 直接读 localStorage，不依赖任何插件安装时机。改造后把 store 引进了守卫执行路径，而 main.ts 的安装顺序是项目早期写的历史代码（router 在前）。**type-check 和 webpack 构建全绿**——因为这是个运行时错误，静态检查根本看不见。

**为什么只有 Web 端炸**：H5 的 main.ts 写法是 `app.use(createPinia())` 在前、router 在后，顺序正确。两端同构代码，一端正一端炸——这类问题只能靠**每个端各自真开浏览器验证**才能发现。

## 解决方法

`main.ts` 调整安装顺序：**Pinia 先于路由**：

```ts
const app = createApp(App);
app.use(ElementPlus);
app.use(store);    // 状态管理先装：守卫和组件 setup 里会用到 store
app.use(router);   // 路由后装：它会立即触发首次导航
app.mount('#app');
```

改完 HMR 自动生效，浏览器刷新即恢复。

## 经验总结

- **app.use 的顺序有语义**：任何会被"路由守卫 / 组件 setup"用到的插件（Pinia、i18n、权限指令），必须装在 router 之前。口诀：**被路由依赖的，先于路由；路由是启动流程的最后一步**（mount 前）
- **运行时错误静态检查抓不到**：type-check 绿、build 绿 ≠ 页面能打开。凡是动了"启动流程、全局守卫、根组件"的改动，必须浏览器里真点一次
- **多端同构要逐端验证**：同一套逻辑在两个工程里，安装顺序、引入方式可能有细微差别（这个项目的 main.ts 就是两端不同人不同时间写的）。一端验证通过 ≠ 另一端通过
- **白屏排查三件套**：编译日志 → #app 有没有 DOM → 时间线回溯最近改动。这套顺序适用几乎所有 Vue/React 白屏

## 一句话总结

Pinia 晚于 vue-router 安装，首次导航的守卫里调 `useStore()` 时 Pinia 还没激活，抛错导致导航失败、整站白屏；把 `app.use(store)` 提到 `app.use(router)` 之前即可。教训：**改动全局守卫/启动流程后，必须浏览器实测，且多端项目要逐端测。**
