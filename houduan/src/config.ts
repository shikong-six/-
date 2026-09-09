//环境边加载模块
//必须作为第一个被引入的模块，保证其他模块读process.env时.env已加载
import dotenv from 'dotenv';
import path from 'path'

//加载当前工作目录下的.env文件
dotenv.config({path:path.resolve(process.cwd(),'.env')});