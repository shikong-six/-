# 踩坑记录：multer 的文件超限错误 try/catch 接不住

## 问题现象

- 给上传接口加 `limits:{fileSize:...}` 限制文件大小，然后在路由处理器 try/catch 里想返回友好提示——**没用**。
- 上传超限文件时请求挂在那，最终拿到的是 Express 默认的错误页（HTML），而不是 JSON 提示。

## 问题原因

multer 是**路由处理器之前**的中间件，文件大小检查也在那一层做。超限时它不调 `next()` 进路由，而是直接 `next(err)` 把错误**跳过所有正常中间件**，冒泡到错误处理中间件——路由里的 try/catch 根本轮不到执行。

这是 Express 的中间件错误传播机制：错误会跳过所有 `(req,res,next)` 签名的中间件/路由，只被 `(err,req,res,next)` 签名的错误中间件接住。

## 解决方法

在 app.ts 的 404 之后加一个统一错误处理中间件（必须放最后）：

```ts
// 4 个参数是 Express 识别错误中间件的标志，少一个就会被当成普通中间件
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({success: false, message: '文件超过 20MB 大小限制'});
  }
  console.error('服务器未处理异常:', err.message);
  res.status(500).json({success: false, message: err.message || '服务器内部错误'});
});
```

实测：上传 21MB 文件返回 `{"success":false,"message":"文件超过 20MB 大小限制"}`。

## 经验总结

- 判断错误会落在哪层处理，关键看**错误抛出时请求走到了哪层**：中间件阶段抛的错，业务层的 try/catch 永远接不住。
- 项目里凡是"包了一层中间件"的功能（multer、鉴权、body 解析），错误兜底都要在应用级的错误中间件做。
