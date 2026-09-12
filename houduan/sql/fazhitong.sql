-- 法制通数据库初始化脚本
-- 用法：连上 MySQL 后执行本文件（命令行 source 或客户端里打开执行均可）

-- 建库，utf8mb4 字符集：完整支持中文和特殊符号
CREATE DATABASE IF NOT EXISTS fazhitong DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fazhitong;

-- 文档元数据表：上传记录入库，前端列表从这张表读
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  filename VARCHAR(255) NOT NULL COMMENT '原始文件名',
  size INT NOT NULL COMMENT '文件大小(字节)',
  chunk_count INT NOT NULL DEFAULT 0 COMMENT '分块数量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间'
) COMMENT='知识库文档元数据';

-- 对话历史表：问题+回答，user_id 关联提问用户，session_id 关联会话
CREATE TABLE IF NOT EXISTS chat_history (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  question TEXT NOT NULL COMMENT '用户问题',
  answer LONGTEXT COMMENT 'AI回答',
  user_id INT NULL COMMENT '提问用户ID（关联 users.id）',
  session_id INT NULL COMMENT '所属会话ID（关联 chat_sessions.id）',
  feedback TINYINT NULL COMMENT '用户反馈：1赞 -1踩 NULL未反馈',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '对话时间',
  INDEX idx_session (session_id)
) COMMENT='对话历史';

-- 对话会话表：一次提问生成一个会话，多轮消息挂在会话下
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  user_id INT NOT NULL COMMENT '所属用户ID',
  title VARCHAR(100) NOT NULL COMMENT '会话标题（取首问前20字）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  INDEX idx_user (user_id)
) COMMENT='对话会话';
