# 踩坑记录：SSE 响应开始后没法再返回错误状态码

## 问题现象

- 实现流式问答接口时遇到设计问题：如果 SSE 流已经推了一部分 token，之后 Kimi 中途报错，该怎么把错误告诉前端？
- 第一反应 `res.status(500).json(...)`——**不行**：SSE 的响应头（200 + `text/event-stream`）早已发出，HTTP 状态码和 Content-Type 都改不了了。

## 问题原因

HTTP 响应头是流式响应的第一件事（还要 `flushHeaders()` 让前端尽早收到头），头一旦发出去，这个响应的状态码就定型了。之后的"错误"只能靠响应体里的内容表达。

## 解决方法

按"响应头是否已发"分两条路（`res.headersSent` 判断）：

```ts
if (res.headersSent) {
    // 流已开始：推一条错误事件再结束，前端识别 type:'error' 抛异常
    res.write(`data: ${JSON.stringify({type: 'error', message: '...'})}\n\n`);
    res.end();
} else {
    // 头还没发（检索阶段就挂了）：正常返回 500 JSON
    res.status(500).json({success: false, message: '...'});
}
```

前端在读流循环里识别 `data.type === 'error'` 时 `throw`，和气普通请求的错误走同一条提示路径。

## 经验总结

- 流式接口的错误处理要前置想好：**头已发之后的错误只能用"协议内错误事件"表达**，这要求前后端约定错误事件的格式（本项目：`{type:'error', message}`）。
- 所有"开始流之后还可能失败"的点（生成中途、写历史前）都要走事件分支，漏一处就是前端无限等待。
