// 引入 Express 框架
import express from 'express';
// 引入跨域中间件
import cors from 'cors';
// 引入环境变量读取工具
import dotenv from 'dotenv';

// 加载项目根目录下的 .env 文件
dotenv.config();

// 创建 Express 应用实例
const app = express();

// 从环境变量读取端口，没有则默认 3000
const PORT = process.env.PORT || 3000;

// 允许前端跨域访问
app.use(cors());

// 解析 JSON 格式的请求体
app.use(express.json());


// 测试路由：访问 http://localhost:3000/ 会返回这条消息
app.get('/',(req,res)=>{
res.json({ message: '法制通后端服务运行中' });
});

// 启动服务，监听指定端口
app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
});