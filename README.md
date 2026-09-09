# 法制通

基于大模型 + RAG 架构的法律智能问答系统：上传法律文档自动解析入库，提问时检索相关法条并生成带引用来源的回答。

## 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Vue 3、TypeScript、Webpack、Vue Router、Pinia、Element Plus、Axios |
| 后端 | Node.js、Express、TypeScript |
| AI / RAG | Kimi API（kimi-k2.6）、Ollama（nomic-embed-text 向量化）、LanceDB（向量存储） |
| 数据库 | MySQL（文档元数据、对话历史） |

## 目录结构

```
法制通/
├── frontend/        # 前端工程（webpack dev server，端口 8080）
├── houduan/         # 后端工程（Express，端口 3000）
│   ├── src/routes/      # 接口路由（chat 问答 / knowledge 知识库）
│   ├── src/services/    # 核心业务（Kimi、向量化、向量库、解析、分块、MySQL）
│   ├── sql/             # 建库建表脚本
│   ├── upload/          # 上传临时目录（不入库）
│   └── vector_db/       # LanceDB 数据目录（不入库）
├── mistake/         # 踩坑记录（问题 / 原因 / 解决方法）
├── test_files/      # 测试文档
└── 开发计划书.md
```

## 快速开始

### 环境要求

- Node.js + npm
- MySQL 5.7+（先执行 `houduan/sql/fazhitong.sql` 建库建表）
- Ollama（`ollama pull nomic-embed-text` 并常驻运行）
- Kimi API Key（<https://platform.moonshot.cn>）

### 配置

```bash
cp houduan/.env.example houduan/.env
# 编辑 .env，填入 KIMI_API_KEY 和 DB_PASSWORD
```

### 启动

```bash
# 终端 1：后端（tsx watch，改代码自动重启）
cd houduan && npm install && npm run dev

# 终端 2：前端（webpack dev server，代理 /api 到 3000）
cd frontend && npm install && npm run dev
```

打开 <http://localhost:8080>。

## 功能

- **智能问答**：RAG 检索相关法条 → Kimi 生成回答 → 答案附引用来源（文档名 + 分块号），支持多轮对话，问答历史落库
- **知识库管理**：PDF/Word/TXT 上传，自动解析 → 分块（500 字/块，100 字重叠）→ 向量化 → LanceDB + MySQL 双写；文档列表；检索测试
- **对话历史**：最近 50 条问答记录列表

## RAG 流程

```
用户提问 → 问题向量化(Ollama) → LanceDB Top-K 检索(按文档+块号去重)
        → 召回法条拼入 system prompt → Kimi 生成答案 → 返回 answer + references
```

检索失败时自动降级为无上下文问答，不阻断对话。

## 常用命令

```bash
cd frontend && npm run build       # 生产构建
cd frontend && npm run type-check  # 类型检查（vue-tsc）
```
