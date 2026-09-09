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
app.use('/api/chat',chatRouter);
// 注册知识库路由
import knowledgeRouter from './routes/knowledge'
app.use('/api/knowledge',knowledgeRouter)
// 404 处理：如果请求的路径没有匹配任何路由，返回 404
app.use((req,res)=>{
  res.status(404).json({
    success:false,
    message:'接口不存在'
  });
});
// 启动服务，监听指定端口
app.listen(PORT,()=>{
  console.log(`后端服务已启动:http://localhost:${PORT}`)
})
console.log('当前工作目录:',process.cwd())
