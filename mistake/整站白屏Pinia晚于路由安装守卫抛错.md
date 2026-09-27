# 整站白屏（双根因）：深链下 bundle.js 相对路径 404 + Pinia 安装顺序隐患

## ⚠️ 勘误（先看这个）

初版记录把白屏归因于"Pinia 晚于路由安装"，是**不完整诊断**——当时没看浏览器控制台就下了结论。真正的元凶是 **webpack `publicPath` 缺失导致深链下 `bundle.js` 404**：直接访问 `/cases/marriage` 时，index.html 里相对路径的 `bundle.js` 被浏览器解析成 `/cases/bundle.js` → 404 → historyApiFallback 返回 HTML → MIME 类型 `text/html` 拒绝执行 → JS 根本没运行 → 白屏。

Pinia 顺序问题**同时真实存在**（守卫里 `useStore()` 在 pinia 未激活时会抛错，是必炸的隐患），也一并修了，但它不是这次白屏的直接原因——bundle 都没加载，根本轮不到守卫执行。两次误判合并成一次完整修复。

**教训置顶：白屏排查第一步不是猜，是让客户/自己打开控制台看第一条红字。** 本记录的"排查步骤"一节后补了正确版本。

## 问题现象

Web 端打开任何页面都是**白屏**，地址栏正常、页面标题正常，DevTools 的 Elements 里 `<div id="app">` 是空的（Vue 根本没渲染），控制台报错。dev server 日志显示 `compiled successfully`——**编译没有任何报错，是资源加载/运行时问题**。

## 排查步骤（正确版本——白屏排查第一件事是看控制台）

1. **打开浏览器控制台看第一条红字**——本案例它就是答案：`Failed to load resource: 404 bundle.js` + `Refused to execute script from '.../cases/bundle.js' because its MIME type ('text/html') is not executable`。**资源加载失败和代码运行错误，控制台一条就能区分**
2. **核对浏览器实际请求的 URL**（Network 面板）：请求的是 `/cases/bundle.js` 而非 `/bundle.js`——相对路径被当前 URL 带偏了
3. 顺着线索查 `webpack.config.js`：output 没有 `publicPath`，HtmlWebpackPlugin 注入的就是相对路径 `bundle.js`
4. **时间线回溯辅助定位"什么时候坏的"**：直接访问深层路由（/cases/marriage）才触发；从根路径 / 进入再点菜单（客户端路由切换）不触发——所以"项目看着好好的，一刷新深链就白"

> 初版记录在这里走了弯路：跳过第 1 步直接做了"时间线回溯"，把锅扣给了 Pinia 顺序——方向对了一半但真凶漏了。**猜之前先看控制台。**

## 问题原因（两个，叠加存在）

### 元凶：publicPath 缺失，深链下 bundle 404

```
浏览器地址栏访问 /cases/marriage
  → dev server historyApiFallback 返回 index.html（内容里有 <script src="bundle.js">）
  → 浏览器按当前 URL 解析相对路径：/cases/ + bundle.js = /cases/bundle.js
  → dev server 没有这个文件 → 404 → fallback 又返回 index.html
  → 响应头 Content-Type: text/html → 浏览器拒绝当脚本执行
  → JS 完全没运行 → #app 空白
```

根路径 / 访问正常（解析为 /bundle.js 恰好对），所以从首页点进去一切正常、一刷新或直接开深链就白屏——这解释了为什么这个 bug 潜伏了很久才暴露。

### 隐患：Pinia 晚于路由安装（同样真实存在，已一并修复）

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

## 解决方法（两处都改）

**① webpack `output.publicPath: '/'`（真元凶的修复）**——资源引用固定从根路径解析，与当前页面 URL 无关：

```js
output: {
  path: path.resolve(__dirname, 'dist'),
  filename: 'bundle.js',
  publicPath: '/',   // history 深链（/cases/marriage）下，index.html 的 bundle.js 才会解析到 /bundle.js
  clean: true
}
```

**② main.ts 调整安装顺序（隐患修复，仍然必要）**——Pinia 先于路由：

```ts
app.use(ElementPlus);
app.use(store);    // 状态管理先装
app.use(router);   // 路由后装：它会立即触发首次导航
app.mount('#app');
```

**③ dev server 顺手加 `headers: {'Cache-Control': 'no-store'}`**——bundle 文件名无 hash，浏览器缓存旧包会让"已修复"看起来像"没修复"，排查时多绕一圈。

## 经验总结

- **白屏排查第一步永远是控制台第一条红字**，不是猜、不是时间线回溯。本案例控制台一眼可见：`/cases/bundle.js` 404 + MIME 拒绝执行
- **history 模式 + 相对路径资源 = 深链白屏经典组合**：`output.publicPath` 必须显式设为 `'/'`，或保证所有资源引用绝对路径
- **app.use 的顺序有语义**：任何会被"路由守卫 / 组件 setup"用到的插件（Pinia、i18n），必须装在 router 之前
- **运行时问题静态检查抓不到**：type-check / build 全绿 ≠ 页面能开；动了启动流程、路由、构建配置，必须浏览器实测
- **多端同构要逐端验证**：H5 的 main.ts 顺序本来就对、Vite 的 publicPath 行为也不同——同一逻辑在不同工程的表现可能完全不同
- **缓存是排查的搅局者**：dev 下给 bundle 加 no-store，或至少记住"改了代码没变化先 Ctrl+F5"

## 一句话总结

history 模式下深链访问时，相对路径的 `bundle.js` 被解析成 `/cases/bundle.js` 导致 404、JS 未运行而整站白屏；修复是 `output.publicPath: '/'`（顺带修掉 Pinia 晚于路由安装的隐患）。**白屏排查：先看控制台第一条红字，再谈其他。**
