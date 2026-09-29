import './config'
// 引入 Express 框架
import express from 'express'
// 引入跨域中间件
import cors from 'cors';
// 引入环境变量读取工具
import dotenv from 'dotenv';
import path from 'path';
// 引入聊天路由
import chatRouter from './routes/chat'
// 引入鉴权中间件
import {authMiddleware} from './services/auth'

// 明确指定 .env 文件路径为当前工作目录下的 .env
dotenv.config({path:path.resolve(process.cwd(),'.env')})

// 再次调用 dotenv.config()，从默认路径加载环境变量（作为兜底）
dotenv.config()

// 创建 Express 应用实例
const app=express()
// 从环境变量读取端口，没有则默认 3000
const PORT=process.env.PORT||3000
// 允许前端跨域访问
app.use(cors());
// 解析 JSON 格式的请求体
app.use(express.json());

// 测试路由，访问 http://localhost:3000/ 会返回这条消息
app.get('/',(req,res)=>{
  res.json({message:'法制通后端服务运行中'});
});
// 注册聊天路由
// 前端访问 http://localhost:3000/api/chat 会进入 chatRouter 处理
// authMiddleware 鉴权：没带有效 token 的请求直接 401，不会进入业务路由
app.use('/api/chat', authMiddleware, chatRouter);
// 注册知识库路由（同样受鉴权保护）
import knowledgeRouter from './routes/knowledge'
app.use('/api/knowledge', authMiddleware, knowledgeRouter)
// 注册认证路由（注册/登录是公开接口，不能加鉴权，否则永远登不进去）
import authRouter from './routes/auth'
app.use('/api/auth', authRouter)
// 注册统计路由（首页统计卡片用，需登录）
import statsRouter from './routes/stats'
app.use('/api/stats', authMiddleware, statsRouter)
// 注册内容库路由（法律案例/法条，需登录）
import contentRouter from './routes/content'
app.use('/api/content', authMiddleware, contentRouter)
// 404 处理：如果请求的路径没有匹配任何路由，返回 404
app.use((req,res)=>{
  res.status(404).json({
    success:false,
    message:'接口不存在'
  });
});
// 统一错误处理中间件：捕获 multer 文件超限、路由抛出的异常等
// 注意：Express 靠 4 个参数识别错误中间件，少一个参数就会被当成普通中间件
app.use((err:any,req:express.Request,res:express.Response,next:express.NextFunction)=>{
  // multer 文件大小超限
  if(err.code==='LIMIT_FILE_SIZE'){
    return res.status(400).json({success:false,message:'文件超过 20MB 大小限制'});
  }
  // 其他未预料的错误：打日志，对外只给笼统提示（不泄露内部细节）
  console.error('服务器未处理异常:',err.message);
  res.status(500).json({success:false,message:err.message||'服务器内部错误'});
});
// 启动服务，监听指定端口
app.listen(PORT,()=>{
  console.log(`后端服务已启动:http://localhost:${PORT}`)
})
console.log('当前工作目录:',process.cwd())
