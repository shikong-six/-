# 踩坑记录：MySQL 不支持 ADD COLUMN IF NOT EXISTS

## 问题现象

- 给 `chat_history` 表加 `user_id` 列（做数据按用户隔离），第一反应是写：

```sql
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id INT NULL;
```

- MySQL 直接语法报错（MariaDB 支持这个写法，MySQL 不支持）。

## 问题原因

MySQL 的 `ALTER TABLE` 不支持对列使用 `IF NOT EXISTS`（只有 `CREATE TABLE IF NOT EXISTS` 和 `DROP TABLE IF EXISTS` 这类表级语句才有）。而代码里这段迁移每次启动都会跑，必须做到幂等——重复执行不能报错。

## 解决方法

先查 `information_schema.COLUMNS` 判断列是否存在，不存在才 ALTER：

```ts
const [columns] = await pool.query<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history' AND COLUMN_NAME = 'user_id'`
);
if (columns.length === 0) {
    await pool.query(`ALTER TABLE chat_history ADD COLUMN user_id INT NULL COMMENT '提问用户ID'`);
}
```

同时在 `sql/fazhitong.sql` 建表脚本里给新装的库直接带上 `user_id` 列，双保险。

## 经验总结

- 启动时自动迁移要幂等：查元数据再改，比 try/catch 吞 `ER_DUP_FIELDNAME` 更稳妥（还能区分"列已存在"和其他真实错误）。
- 迁移成功后记得同步更新 `sql/fazhitong.sql`，否则新环境老脚本、旧环境新代码，两边对不上。
