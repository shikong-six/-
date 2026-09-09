//MySQL数据库连接服务
//使用连接池管理连接，避免每次查询都新建/销毁连接
import mysql from 'mysql2/promise'

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
}
// 异步执行建表，失败只打日志不阻断启动（可能是数据库没起）
initDb().catch(err=>console.error('初始化 users 表失败:',err.message));

export default pool;