# vite.config.ts 里用 __dirname 报 TS 类型错误

## 问题

Vite 工程里 `vite.config.ts` 写惯用写法：

```ts
import path from 'path';
export default defineConfig({
  resolve: {alias: {'@': path.resolve(__dirname, 'src')}},
});
```

`npm run type-check`（vue-tsc）报两个错：

```
vite.config.ts(5,18): error TS2307: Cannot find module 'path'
vite.config.ts(15,25): error TS2304: Cannot find name '__dirname'
```

## 原因

`path`、`__dirname` 是 Node.js 的 API，类型定义在 `@types/node` 里。前端工程的 tsconfig 没装也没引入 Node 类型，vue-tsc 自然不认识。webpack 时代没这问题是因为 webpack.config.js 是 JS 文件，不走类型检查；Vite 官方模板用 TS 写配置，把这个坑暴露出来了。

## 解决方法

两种，任选其一（本项目选了第二种的组合）：

1. **装 Node 类型**：`npm i -D @types/node`，tsconfig 的 `compilerOptions.types` 加 `"node"`
2. **用 ESM 原生写法**：`import {fileURLToPath, URL} from 'node:url'`，别名写成 `fileURLToPath(new URL('./src', import.meta.url))`——`node:url` 是内置模块的显式写法，配合 Vite 的 ESM 环境不需要 `__dirname`

注意点：tsconfig 的 `include` 如果含 `vite.config.ts`，vue-tsc 还是会检查它。本项目最终把 `vite.config.ts` 移出了 include（`"include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"]`），构建期配置由 Vite 运行时自己校验，类型检查专注业务代码。

## 一句话总结

前端工程默认没有 Node 类型，`vite.config.ts` 里要么装 `@types/node`，要么用 `fileURLToPath(new URL(...))` 的 ESM 写法绕开 `__dirname`。
