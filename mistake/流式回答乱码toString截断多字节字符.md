# 流式回答偶发乱码：chunk.toString('utf8') 截断多字节字符

## 问题

H5 真机测试时发现 AI 回答里偶发乱码：本该是"试**用期**规定"的位置显示成"**��**用期规定"——一个中文字符变成了两个 U+FFFD（�）替换符。不是每次出现，时好时坏。

## 原因

后端 `houduan/src/services/kimi.ts` 解码 Kimi 流式响应时写的是：

```js
buffer += chunk.toString('utf8');
```

问题在于：**TCP 分包不保证按字符边界切**。一个中文字符是 3 字节（UTF-8），它的字节完全可能被拆在相邻两个 chunk 里——前一个 chunk 末尾是前 1~2 个字节，后一个 chunk 开头是剩下的字节。

`chunk.toString('utf8')` 是**对每个 chunk 独立解码**的：遇到不完整的多字节序列，Node 不会等下一个 chunk，直接把残缺字节替换成 `�`；下一个 chunk 开头剩下的字节也解码成 `�`。于是 1 个汉字 → 2 个乱码。

这属于**概率性 bug**：只有当多字节字符恰好跨在分包边界上才触发。中文回答字符密集、流式 chunk 又小，所以出现频率不低。前端没这问题是因为用了 `TextDecoder` 的 `stream: true` 模式——它会自动把半个字符的字节留到下次解码。

## 解决方法

改用增量解码器，和前端同一套路：

```js
import {TextDecoder} from 'node:util';
const decoder = new TextDecoder('utf-8');

response.data.on('data', (chunk) => {
  buffer += decoder.decode(chunk, {stream: true});  // 半个字符的字节留在解码器里等下一个 chunk
  // ...按行切分解析不变
});
response.data.on('end', () => {
  buffer += decoder.decode();  // 流结束时冲刷解码器，把残留字节解码完
  resolve();
});
```

`{stream: true}` 会暂存不完整的多字节序列，等后续 chunk 补齐后再输出完整字符，`end` 时调用不带参数的 `decode()` 冲刷收尾。

## 一句话总结

Node 里解码流式数据别用 `chunk.toString('utf8')`——它对每个 chunk 独立解码，跨 chunk 的多字节字符（中文必踩）会变成乱码 �；必须用 `TextDecoder` 的 `{stream: true}` 增量解码，结束时 `decode()` 冲刷。

## 排查线索（下次遇到乱码怎么想）

- 乱码是 `�`（U+FFFD 替换符）→ 编码解码问题，查 TextDecoder/toString 用法
- 乱码是"娴嬭瘯"这种规律性错字 → 把 UTF-8 按 GBK/Latin1 解码了，查编码声明
- 只有流式场景出现、非流式正常 → 锁定流式解码那一行
