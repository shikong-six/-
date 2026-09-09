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

-- 对话历史表：先简单存问题+回答，后面做对话列表页再用
CREATE TABLE IF NOT EXISTS chat_history (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
  question TEXT NOT NULL COMMENT '用户问题',
  answer LONGTEXT COMMENT 'AI回答',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '对话时间'
) COMMENT='对话历史';
