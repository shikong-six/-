# 踩坑记录：后端跑 npx tsc 报平台包缺失

## 问题现象

- 在 `houduan/` 目录执行 `npx tsc --noEmit`，直接报错退出：

```
Error: Unable to resolve @typescript/typescript-win32-x64. Either your platform is unsupported, or you are missing the package on disk.
```

- 但 `npm run dev`（tsx）一直运行正常，业务代码没有任何问题。

## 问题原因

`houduan/package.json` 的 devDependencies 里**根本没有写 typescript**，`node_modules` 里却躺着一个 7.0.2 版本的 typescript——它是 typescript 7 的原生预览版（tsgo），运行依赖一个平台相关的二进制包 `@typescript/typescript-win32-x64`。

这个二进制包是 optionalDependency，当初安装时没装上（可能 npm 版本或安装中断导致），而 `npx tsc` 恰好解析到了这个残缺的 7.0.2，于是启动就抛错。

关键点：**tsx 走的是 esbuild 转译、不做类型检查**，所以它一直正常，问题只藏在 `tsc` 这条路上，一直没暴露。

## 解决方法

把 typescript 5 正式装为开发依赖，覆盖掉残缺的 7.0.2：

```bash
npm i -D typescript@^5.5.0
npx tsc --noEmit   # 通过
```

## 经验总结

- 验证项目要跑"项目声明的标准命令"：`npm run build` 就是 `tsc`，依赖没装全时 build 必挂，tsx 能跑不代表类型没问题。
- `npx xxx` 会在 node_modules 里找可执行文件，解析到的版本不一定是你以为的那个；装包前先 `npm ls` 或看 `package.json` 确认它在依赖清单里。
- optionalDependency 缺失 npm 不会报错，出现 "Unable to resolve ... platform" 类错误先怀疑它。
