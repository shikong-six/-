# 踩坑记录：dev server 报类型错但生产构建通过 + 端口占用导致配置不生效

## 问题现象

1. `npm run build`（生产）编译通过，`npm run dev`（开发）却报 3 个类型错：
   `Cannot find name 'ChatHistoryItem'` / `'DocumentItem'`，指向的是模板插槽里的类型标注：
   `<template #default="{ row }: { row: DocumentItem }">`
2. 重启 dev server 应用新配置时失败：`EADDRINUSE: address already in use :::8080`。

## 问题原因

### 坑 1：同一份代码，dev 和 prod 编译结果不一致

`ts-loader` + `vue-loader` 对 `.vue` 模板里的 TypeScript 类型标注，在开发模式和生产模式下的编译产物结构不同：dev 模式下模板编译后的模块里访问不到 script 里的 `import type`，于是报"找不到名称"；prod 模式下没有这个问题。属于工具链的怪癖，不是代码写错了（`vue-tsc --noEmit` 对同一份代码零错误，也证明类型本身没问题）。

### 坑 2：旧进程占用端口，新 dev server 起不来

用工具停止后台任务时，只杀掉了外层 shell 进程，**子进程 node（webpack-dev-server）还活着**，继续占着 8080。新实例启动报 `EADDRINUSE`。而当时浏览器还能访问 8080——访问到的其实是旧实例，所以配置改了也不生效。

## 解决方法

### 坑 1：dev 关闭类型检查，类型把关交给 vue-tsc

`webpack.config.js` 里给 ts-loader 加 `transpileOnly: true`：

```js
{
    test:/\.ts$/,
    loader:'ts-loader',
    options:{
        appendTsSuffixTo:[/\.vue$/],
        // dev 只转译不做类型检查，类型检查统一用 npm run type-check（vue-tsc）
        transpileOnly:true
    },
    exclude:/node_modules/
},
```

这是社区标准分工：**开发时追求快（转译即可），类型检查交给 `npm run type-check`（vue-tsc）和 CI/构建时做**。改完记得重启 dev server（改 webpack 配置不会热更新）。

### 坑 2：找到占用端口的进程并杀掉

Git Bash 里没有 netstat/taskkill，用 PowerShell：

```bash
# 查谁在监听 8080，拿到 PID
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique"

# 按 PID 强杀
powershell -NoProfile -Command "Stop-Process -Id <PID> -Force"
```

## 经验总结

1. **dev 报错先看是不是工具链差异**：同代码 build 过、vue-tsc 过，就怀疑 dev 编译路径（loader 配置），别急着改业务代码。
2. **改 webpack 配置必须重启 dev server**；重启失败先看是不是旧进程还占着端口——"浏览器能访问"不代表你起的新实例在工作。
3. 排障时确认"正在服务的是哪个进程"：`EADDRINUSE` 时 curl 到的 200 是旧进程的响应，别被误导。
