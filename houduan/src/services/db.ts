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
export default pool;