# 法制通

基于大模型 + RAG 架构的法律智能问答系统：法律文档按**条文**入库，提问时**多路召回 + 本机重排**，
生成带引用来源的回答；PC 端与移动端（H5）双端，含自建评测体系。

## 技术栈

| 层 | 技术 |
|---|---|
| PC 前端 | Vue 3、TypeScript、**Webpack 5** + vue-loader、Vue Router、Pinia、Element Plus、Axios、marked + DOMPurify |
| 移动端 H5 | Vue 3、TypeScript、**Vite** + unplugin-vue-components（按需引入）、Vant、Web Speech（语音输入） |
| 后端 | Node.js、Express、TypeScript（tsx watch） |
| 大模型 | Kimi API（`kimi-k2.6`），SSE 流式输出 |
| 检索 | **本机向量化 + 本机重排，不依赖外部向量服务**：`bge-small-zh-v1.5`（向量）、`bge-reranker-base`（交叉编码重排），首次运行自动从 ModelScope 下载 |
| 向量库 | LanceDB（本地文件） |
| 数据库 | MySQL（用户、文档元数据、会话、问答历史、结构化法条/案例） |

## 目录结构

```
法制通/
├── frontend/        # PC 端（webpack dev server，:8080）
├── h5/              # 移动端（vite，:8081；host:true 便于真机联调）
├── houduan/         # 后端（Express，:3000）
│   ├── src/routes/      # 接口：auth / chat（问答，含 SSE）/ knowledge / content / stats
│   ├── src/services/    # 核心：retrieve 检索编排、rerankLocal 本机重排、
│   │                    #       embedding 向量化、vectorStore 向量库、textSplitter 按条分块、
│   │                    #       conversation 历史裁剪、kimi 流式调用、content 法条案例
│   ├── knowledge_seed/  # 初始语料
│   ├── scripts/         # 灌库脚本（seedLaws / seedKnowledge）
│   ├── sql/             # 建库建表
│   └── vector_db/       # LanceDB 数据目录
├── eval/            # 分类评测：题库 + 脚本 + 历史报告
└── mistake/         # 踩坑记录（37 篇：现象 / 原因 / 解决方法）
```

## 快速开始

**环境要求**：Node.js 18+、MySQL 5.7+、Kimi API Key。
**不需要 Ollama**——向量与重排模型在本进程内跑，首次运行会从 ModelScope 下载（约几百 MB）。

```bash
# 1. 建库建表
mysql -u root -p < houduan/sql/fazhitong.sql

# 2. 配置
cp houduan/.env.example houduan/.env     # 填 KIMI_API_KEY、DB_PASSWORD

# 3. 启动（三个终端）
cd houduan  && npm install && npm run dev    # 后端 :3000
cd frontend && npm install && npm run dev    # PC 端 :8080
cd h5       && npm install && npm run dev    # 移动端 :8081
```

PC 端打开 <http://localhost:8080>；手机连同一 WiFi 打开 `http://<电脑IP>:8081`。

## 核心链路

### 入库

```
文档 → 解析（docx/pdf/txt）→ 按“第X条”切块（没有条文号才退化到按段落）
     → 每块冠以《法律名》→ bge 向量化 → LanceDB + MySQL 双写
     → 同时把结构化条文同步进法条库（供法条/案例浏览接口）
```

**为什么按条切**：向量检索的返回单位会直接出现在回答里。按固定字数切会把一条法条劈成两半，
模型拿到的就是残条。

### 提问

```
问题 → ① 口语→法条用语同义词扩展（“违法开除”→“赔偿金”）
     → ② 判断“像不像好几件事”，是就按连接词/逗号拆开，各自检索（最多 3 件）
     → ③ 双路召回：稠密（LanceDB top-24）+ 词法（全量扫描 + 术语命中）
     → ④ RRF 融合（k=60，词法权重 1.4）
     → ⑤ 本机重排（bge-reranker 交叉编码）
     → ⑥ 相关性闸门（余弦下限）→ 按事项拼 prompt → Kimi 流式生成
```

三个值得说的设计：

- **RRF 融合**：稠密和词法两路分数不可比，用排名倒数融合；词法那路权重更高，因为“第X条”这类
  字面命中比语义相近更可信。
- **本机重排 + 场景闸门**（`rerankLocal.ts`）：交叉编码对「问题 + 条文」直接打分，
  **开头句与全文分两轮分别计算**（不同长度垫进同一次前向会让分数失真，所以逐条算，开 2 个 worker 槽）；
  另有 13 条**场景闸门**，专门拦“只是因为出现同一个动词”的误引——例如用户没提“公共交通工具”，
  就不能因为出现“驾驶”二字而把相关罪名当依据。重排全程不调用大模型。
- **多事项与追问**：一句话里两件事会拆成两组资料、分段作答；追问（“那要是公司不给我怎么办”）
  会先回到上文那句事实去检索，避免只看最后一句而召回错法条。

### 会话

最近 3 轮对话原样保留；更早的**只留用户原话、每条裁到 120 字、最多 16 条**，拼成一份“更早说过的事实”，
并明确告诉模型“更早的回答已省略，不要沿用其中的法条编号”——避免旧法条污染新问题。

## 功能

- **认证**：注册/登录（bcrypt + JWT），Axios 拦截器自动带 Token，路由守卫，401 自动跳登录
- **智能问答**：SSE 流式输出（`status` / `token` / `references` / `session` / `done` / `error`），
  引用卡片可展开原文，支持点赞点踩、重新生成、多轮会话与历史管理
- **知识库管理**：上传 → 解析 → 按条分块 → 向量化 → 双写；文档列表与删除（向量库与 MySQL 同步删）
- **法条库 / 案例库**：按分类浏览与检索
- **移动端**：场景化首页、语音输入、键盘弹起适配、安全区适配、真机联调（`host: true`）

## 评测（`eval/`）

自建 24 条分类题库，覆盖 7 类：简单 / 口语化 / **多事项** / **跨法典** / **追问** / 越界（测拒答）/ 新入库法条。
五个指标，全部由脚本按确定性规则计算（**不用大模型当裁判**）：

| 指标 | 判据 |
|---|---|
| 文档召回率 | 期望文档是否出现在**后端返回的引用列表**里（多事项要求每件事的文档都命中） |
| 条文命中率 | 期望条文号是否出现在引用原文里（比“命中了民法典”严格得多） |
| 引用正确率 | 回答里写的“第X条”是否都在给定资料中（**编造就扣分**） |
| 要点覆盖率 | 回答是否覆盖了标准要点（比对时先归一化虚词，避免“照抄原文反被判 0%”） |
| 拒答率 | 库里没有的问题，是否正确说“未找到依据”而不是硬答 |

**2026-10-14 实测（24 条）**：文档召回 **100%**、条文命中 **96%**、引用正确 **100%**、要点覆盖 **88%**、拒答 **100%**。

```bash
cd eval
python run_eval.py --full --user <账号> --password <密码> --sleep 20   # 端到端（花 token，约 20 分钟）
python run_eval.py --retrieval-only                                    # 只打检索接口（几乎不花 token）
```

> 注：`--retrieval-only` 打的是知识库裸检索接口，**不经过 RRF / 重排 / 多事项拆分**，
> 不能当作 RAG 链路的质量指标——验证检索侧改动必须走 `--full`。

## 踩坑记录（`mistake/`，37 篇）

每条按「现象 / 原因 / 解决方法」写。其中几条对理解本项目很关键：

- `SSE被devServer代理缓冲.md`、`流式一大坨冒出来是首字延迟不是代理缓冲.md`（把错误假设和真因分开）
- `流式回答乱码toString截断多字节字符.md`（用 `TextDecoder(stream:true)` 处理跨包的多字节字符）
- `客户端断开Kimi白跑占并发.md`、`流式接口要先入库再发事件.md`
- `垃圾输入触发锚定幻觉.md`（输入校验这条防线的由来）
- `v-html渲染AI回答必须DOMPurify消毒.md`
- `修一个端别忘另一个端同款代码要全局排查.md`（PC / H5 双端同源问题的教训）
- `WebSpeechAPI只在安全上下文可用.md`（语音输入的环境限制）

## 已知限制

- **语音输入**依赖浏览器 Web Speech API：需要 HTTPS 或 localhost（局域网 http 调试会被拒），
  Chrome 走境外服务、国内网络常不可用，微信内置浏览器不提供该 API。面向微信需走 JS-SDK，尚未实现。
- 多事项场景下个别用例仍会漏召回（例如「上班途中被车撞」要求同时命中工伤保险条例与道交法）。
- PC 端目前**全量引入 Element Plus**（单包约 1.15 MB），按需引入尚未做。
- `h5/dist`、`houduan/dist` 是历史构建产物，开发与演示请用 dev server。
- 项目根目录的 `qdrant/`、`qdrant_storage/` 是早期方案的遗留空目录，当前向量库为 LanceDB。
