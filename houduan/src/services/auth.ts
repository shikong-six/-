// 用户认证服务：密码加密(bcrypt)、JWT 签发与校验、鉴权中间件
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {Request, Response, NextFunction} from 'express';

// JWT 密钥，从环境变量读取；开发环境用默认值，生产必须在 .env 里配置
const JWT_SECRET = process.env.JWT_SECRET || 'fazhitong-dev-secret';
// token 有效期
const TOKEN_EXPIRES = '24h';

// 扩展 Express 的 Request 类型：校验通过后把用户信息挂在 req.user 上
declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; username: string };
    }
  }
}

// 密码加密：bcrypt 加盐哈希，数据库只存哈希不存明文
export async function hashPassword(password: string): Promise<string> {
  // 10 是加盐轮数，越大越安全但越慢，10 是常用平衡点
  return bcrypt.hash(password, 10);
}

// 密码校验：登录时比对用户输入的明文和数据库里的哈希
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 签发 JWT，payload 里放用户标识，前端之后凭这个 token 访问受保护接口
export function signToken(userId: number, username: string): string {
  return jwt.sign({userId, username}, JWT_SECRET, {expiresIn: TOKEN_EXPIRES});
}

// 鉴权中间件：校验请求头里的 Bearer token
// 用法：app.use('/api/chat', authMiddleware, chatRouter)
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 取 Authorization 头，格式必须是：Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({success: false, message: '未登录或缺少凭证'});
  }
  // 去掉 "Bearer " 前缀，拿到真正的 token
  const token = authHeader.slice(7);
  try {
    // 校验签名和有效期，通过则解出 payload
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    // 把用户信息挂到请求对象上，后面的路由和业务代码能通过 req.user 拿到
    req.user = payload;
    // 放行，交给后面的路由处理
    next();
  } catch {
    // token 伪造或过期都会走到这里
    return res.status(401).json({success: false, message: '凭证无效或已过期'});
  }
}
