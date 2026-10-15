//MySQL数据库连接服务
//使用连接池管理连接，避免每次查询都新建/销毁连接
import mysql from 'mysql2/promise'
import {comparePassword, hashPassword} from './auth'

//创建连接池，参数全部从环境变量读取
const pool=mysql.createPool({
    host:process.env.DB||'localhost',
    port:Number(process.env.DB_PORT)||3306,
    user:process.env.DB_USER||'root',
    password:process.env.DB_PASSWORD||'',
    database:process.env.DB_NAME||'fazhitong',
    //池里最多同时保持10个连接，小项目可以
    connectionLimit:10
});
//导出连接池
//其他地方使用：await pool.query('SQL语句',[参数])

// 启动时确保 users 表存在（CREATE TABLE IF NOT EXISTS 是幂等的，重复执行无副作用）
// 好处：新环境拉代码启动即自动建表，不用手动执行 SQL 文件
async function initDb(){
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
            username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名，唯一',
            password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密后的密码哈希',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
        ) COMMENT='用户表'
    `);
    // ===== 自动迁移：给 chat_history 表补 user_id 列（数据按用户隔离用）=====
    // MySQL 不支持 ADD COLUMN IF NOT EXISTS，所以先查 information_schema 确认列不存在再 ALTER
    try {
        // 查询 chat_history 表里是否已有 user_id 列
        const [columns] = await pool.query<any[]>(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history' AND COLUMN_NAME = 'user_id'`
        );
        // 查询结果为空说明列不存在，执行 ALTER 补上（允许 NULL：老数据没有归属用户）
        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE chat_history ADD COLUMN user_id INT NULL COMMENT '提问用户ID'`
            );
            console.log('chat_history 表已补充 user_id 列');
        }
    } catch (err: any) {
        // 迁移失败只打日志不阻断启动（可能是数据库没起或表还没建）
        console.error('chat_history 补 user_id 列失败:', err.message);
    }
    // ===== 自动迁移：chat_sessions 会话表 =====
    // 一次提问生成一个会话，多轮消息挂在会话下；建表语句幂等，可重复执行
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
                user_id INT NOT NULL COMMENT '所属用户ID',
                title VARCHAR(100) NOT NULL COMMENT '会话标题（取首问前20字）',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
                INDEX idx_user (user_id)
            ) COMMENT='对话会话'
        `);
    } catch (err: any) {
        // 建表失败只打日志不阻断启动
        console.error('初始化 chat_sessions 表失败:', err.message);
    }
    // ===== 自动迁移：给 chat_history 表补 session_id 列（消息挂到会话下）=====
    // 老数据 session_id 为 NULL（历史页只显示挂上了会话的记录，不影响）
    try {
        // 查询 chat_history 表里是否已有 session_id 列
        const [columns] = await pool.query<any[]>(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history' AND COLUMN_NAME = 'session_id'`
        );
        // 查询结果为空说明列不存在，执行 ALTER 补上并加索引（按会话查消息是高频查询）
        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE chat_history ADD COLUMN session_id INT NULL COMMENT '所属会话ID'`
            );
            await pool.query(
                `ALTER TABLE chat_history ADD INDEX idx_session (session_id)`
            );
            console.log('chat_history 表已补充 session_id 列');
        }
    } catch (err: any) {
        // 迁移失败只打日志不阻断启动
        console.error('chat_history 补 session_id 列失败:', err.message);
    }
    // ===== 自动迁移：给 chat_history 表补 feedback 列（答案点赞/点踩：1赞 -1踩 NULL未反馈）=====
    try {
        // 查询 chat_history 表里是否已有 feedback 列
        const [columns] = await pool.query<any[]>(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history' AND COLUMN_NAME = 'feedback'`
        );
        // 查询结果为空说明列不存在，执行 ALTER 补上（允许 NULL：未反馈）
        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE chat_history ADD COLUMN feedback TINYINT NULL COMMENT '用户反馈：1赞 -1踩 NULL未反馈'`
            );
            console.log('chat_history 表已补充 feedback 列');
        }
    } catch (err: any) {
        // 迁移失败只打日志不阻断启动
        console.error('chat_history 补 feedback 列失败:', err.message);
    }
    // ===== 个人中心：用户浏览案例去重表 =====
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_case_views (
                user_id INT NOT NULL COMMENT '用户ID',
                case_id INT NOT NULL COMMENT '案例ID',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次浏览时间',
                PRIMARY KEY (user_id, case_id),
                INDEX idx_user (user_id)
            ) COMMENT='用户浏览案例记录（去重）'
        `);
    } catch (err: any) {
        console.error('初始化 user_case_views 表失败:', err.message);
    }
    // ===== 自动迁移：documents 表补 user_id（个人上传统计）=====
    try {
        const [columns] = await pool.query<any[]>(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'user_id'`
        );
        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE documents ADD COLUMN user_id INT NULL COMMENT '上传用户ID'`
            );
            console.log('documents 表已补充 user_id 列');
        }
    } catch (err: any) {
        console.error('documents 补 user_id 列失败:', err.message);
    }
    // 引用条文随回答入库。刷新后从历史还原，不靠当次页面里的临时数据。
    try {
        const [columns] = await pool.query<any[]>(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history' AND COLUMN_NAME = 'references_json'`
        );
        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE chat_history ADD COLUMN references_json MEDIUMTEXT NULL COMMENT '回答引用的法条 JSON'`
            );
            console.log('chat_history 表已补充 references_json 列');
        }
    } catch (err: any) {
        console.error('chat_history 补 references_json 列失败:', err.message);
    }
    // 演示账号写在两端登录页上，库里没有就建一个，密码不对就改成页面上的那组
    try {
        const demoUser = 'user';
        const demoPassword = '123456';
        const [rows] = await pool.query<any[]>(
            'SELECT id, password_hash FROM users WHERE username = ?',
            [demoUser]
        );
        const passwordHash = await hashPassword(demoPassword);
        if (rows.length === 0) {
            await pool.query(
                'INSERT INTO users (username, password_hash) VALUES (?,?)',
                [demoUser, passwordHash]
            );
            console.log('已创建演示账号 user');
        } else if (!(await comparePassword(demoPassword, rows[0].password_hash))) {
            await pool.query(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [passwordHash, rows[0].id]
            );
            console.log('已将演示账号 user 的密码同步为登录页上的密码');
        }
    } catch (err: any) {
        console.error('创建演示账号失败:', err.message);
    }
}
// 异步执行建表，失败只打日志不阻断启动（可能是数据库没起）
initDb().catch(err=>console.error('初始化 users 表失败:',err.message));

export default pool;