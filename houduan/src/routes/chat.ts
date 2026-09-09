// 问答路由：RAG 完整流程 —— 检索向量库 → 组装带法条的 Prompt → 调用 Kimi → 返回答案 + 引用
import {Router} from 'express';
// Kimi 调用封装
import {chatWithKimi} from '../services/kimi'
// MySQL 连接池（存问答历史）
import pool from '../services/db'
// Ollama 向量化（把用户问题转成查询向量）
import {embedQuery} from '../services/embedding'
// LanceDB 相似度检索
import {searchChunks} from '../services/vectorStore'

// 创建路由实例
const router=Router();

// 定义 POST /api/chat
// 前端调用这个接口来发送消息，返回 AI 回答和引用来源
router.post('/',async (req,res)=>{
    try{
        // 从请求体中读取 messages，格式：[{role:'user',content:'你好'}]
        const {messages}=req.body;

        // 如果前端没传 messages，返回 400 错误
        if(!messages||!Array.isArray(messages)){
            return res.status(400).json({
                success:false,
                message:'参数错误,messages必须是一个数组'
            });
        }

        // 取最后一条用户消息作为本次要回答的问题
        const question=messages[messages.length-1].content;

        // ===== RAG 第一步：检索向量库，召回相关法条 =====
        // references 保存召回的文本块，最后会一起返回给前端展示引用
        let references:Array<{docName:string;chunkIndex:number;text:string}>=[];
        try{
            // 1. 把问题文本向量化
            const queryVector=await embedQuery(question);
            // 2. 在向量库里找与问题最相近的 3 个文本块
            const chunks=await searchChunks(queryVector,3);
            references=chunks;
            //按"文档名+块号"去重，避免内容重叠的分块重复出现在引用里
            const seen=new Set<string>()
            references=references.filter(chunk=>{
                //用文档名#块号作为唯一标识
                const key=`${chunk.docName}#${chunk.chunkIndex}`;
                //已经出现过就过滤掉
                if(seen.has(key))
                    return false
                //没出现过就记下，保留这一条
                seen.add(key)
                return true;
            })
        }catch(searchError:any){
            // 检索失败（比如 Ollama 没启动）不阻断问答，只是本次没有上下文，记个日志
            console.error('向量检索失败，本次问答不带知识库上下文:',searchError.message);
        }

        // ===== RAG 第二步：把召回的法条拼进 system 提示词 =====
        // 每个文本块编号放进【资料】区，并要求 Kimi 只依据资料回答
        const context=references.map((chunk,index)=>
            `【资料${index+1}】（出自《${chunk.docName}》第${chunk.chunkIndex+1}块）\n${chunk.text}`
        ).join('\n\n');

        // system 消息：告诉 Kimi 它是谁、按什么规则回答、资料有哪些
        const systemMessage={
            role:'system' as const,
            content:`你是"法制通"法律智能问答助手。请根据下面提供的法律条文资料回答用户的问题。
回答要求：
1. 只依据提供的资料回答，不要编造法条；资料里没有的内容，要明确说明"知识库中未找到相关依据"。
2. 尽量引用资料中的原文条款表述。
3. 用中文回答，条理清晰。

${context?`【法律资料】\n${context}`:'（本次未检索到相关法律资料，请基于常识谨慎回答，并提示用户知识库可能为空。）'}`
        };

        // ===== RAG 第三步：带上下文调用 Kimi 生成答案 =====
        // messages 是用户的多轮对话历史，前面补上 system 消息
        const reply=await chatWithKimi([systemMessage,...messages]);

        // 把本次问答写入 MySQL 历史表（存库失败不影响回复，只记日志）
        try{
            await pool.query(
                'INSERT INTO chat_history (question,answer) VALUES (?,?)',
                [question,reply]
            );
        }catch(dbError:any){
            console.error('保存对话历史失败:',dbError.message);
        }

        // 返回成功结果：答案 + 引用来源
        res.json({
            success:true,
            data:{
                answer:reply,
                references
            }
        });
    }catch(error:any){
        // 如果 Kimi 调用失败，返回 500 错误
        console.error('聊天接口出错:',error.message);
        res.status(500).json({
            success:false,
            message:error.message||'服务器内部错误'
        })
    }
});
//查询对话历史接口GET /api/chat/history
//从MySQL chat_history表按时间倒序读，最多返回50条
router.get('/history',async (req,res)=>{
    try{
        //查询历史记录,created_at起别名createdAt,和前端字段命名保持一致
        const [rows]=await pool.query(
            'SELECT id,question,answer,created_at AS createdAt FROM chat_history ORDER BY id DESC LIMIT 50'
        )
        //返回查询结果
        res.json({
            success:true,
            data:rows
        })
    }catch(error:any){
        //查询失败返回500'
        console.error('查询对话历史失败',error.message);
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
});

// 导出路由
export default router;