# 踩坑记录：SSE 经过 webpack-dev-server 代理后变成"一大块冒出"

## 问题现象

- 流式问答在浏览器里看不到逐字输出：转圈等十几秒，然后答案**一次性整块显示**。
- 但绕开代理直连后端（curl 打 3000 端口）测试，token 明明是一条一条增量到达的。

## 问题原因

webpack-dev-server v5 的 devServer **默认开启 gzip 压缩**（`compress: true`，内部是 compression 中间件）。压缩为了拿到更好的压缩率，会**攒住响应体、凑一批再刷出**——对普通接口无所谓，对 SSE 流就是灾难：整个流被攒到结束才一次性到达浏览器。

于是链路变成了：后端逐 token 推 → dev server 代理全攒住 → 结束时一大块给浏览器。后端"锅"背得挺冤。

验证方法：对代理和直连分别 `curl -sN ... | head -1` 计首条耗时——直连 2 秒内出首 token，代理要等十几秒（整流完成）。修复后逐条加时间戳打印，token 间隔 ~50ms，确认恢复流式。

## 解决方法

webpack.config.js 的 devServer 关掉压缩：

```js
devServer: {
  // 关闭 gzip 压缩：v5 默认开启，压缩中间件会攒住 SSE 流、结束才一次性刷出
  compress: false,
  proxy: [{context: ['/api'], target: 'http://localhost:3000', changeOrigin: true}]
}
```

改完**必须重启 dev server**才生效。

## 经验总结

- SSE 排查口诀：**先绕开代理直连后端**，直连正常就是代理层在缓冲。常见缓冲源有三个：gzip 压缩、代理的 `proxy_buffering`（Nginx）、前端框架 dev server 的默认压缩。
- Nginx 部署时同理要 `proxy_buffering off`（已写进部署方案）。
- 测流式接口别只看"最终拿到了多少条"，要给每条加时间戳看**到达节奏**。
