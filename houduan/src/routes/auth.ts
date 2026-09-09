// 用户认证路由：注册、登录
import {Router} from 'express';
// MySQL 连接池
import pool from '../services/db';
// 认证相关函数
import {hashPassword, comparePassword, signToken} from '../services/auth';

const router = Router();

// 注册接口 POST /api/auth/register
// 注册成功直接签发 token，省得注册完再登一次
router.post('/register', async (req, res) => {
  try {
    const {username, password} = req.body;

    // ===== 基本参数校验 =====
    if (!username || !password) {
      return res.status(400).json({success: false, message: '用户名和密码不能为空'});
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({success: false, message: '参数格式错误'});
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({success: false, message: '用户名长度需为 3-20 个字符'});
    }
    if (password.length < 6) {
      return res.status(400).json({success: false, message: '密码长度至少 6 位'});
    }

    // 检查用户名是否已被注册
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if ((existing as any[]).length > 0) {
      return res.status(409).json({success: false, message: '用户名已被注册'});
    }

    // 密码加密后入库，数据库永远不存明文密码
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (?,?)',
      [username, passwordHash]
    );
    const userId = (result as any).insertId;

    // 签发 token，注册完即登录状态
    const token = signToken(userId, username);
    res.json({success: true, data: {token, username}});
  } catch (error: any) {
    console.error('注册失败:', error.message);
    res.status(500).json({success: false, message: error.message});
  }
});

// 登录接口 POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const {username, password} = req.body;
    if (!username || !password) {
      return res.status(400).json({success: false, message: '用户名和密码不能为空'});
    }

    // 按用户名查用户
    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username]
    );
    const users = rows as any[];
    // 用户不存在时返回 401；注意和"密码错误"用同样的提示，避免暴露用户名是否已注册
    if (users.length === 0) {
      return res.status(401).json({success: false, message: '用户名或密码错误'});
    }
    const user = users[0];

    // 比对密码（明文 vs 哈希）
    const passwordOk = await comparePassword(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({success: false, message: '用户名或密码错误'});
    }

    // 校验通过，签发 token
    const token = signToken(user.id, user.username);
    res.json({success: true, data: {token, username: user.username}});
  } catch (error: any) {
    console.error('登录失败:', error.message);
    res.status(500).json({success: false, message: error.message});
  }
});

export default router;
