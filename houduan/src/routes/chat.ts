// 问答路由：RAG 完整流程 —— 检索向量库 → 组装带法条的 Prompt → 调用 Kimi → 返回答案 + 引用
import {Router} from 'express';
// Kimi 调用封装（非流式 + 流式）
import {chatWithKimi, chatWithKimiStream} from '../services/kimi'
// MySQL 连接池（存问答历史）
import pool from '../services/db'
// 检索：本机重排。复杂问题按连接词拆开，再逐件检索。
import {buildLegalPrompt, flattenReferences, questionForRetrieval, retrieveForUserQuestion} from '../services/retrieve'
import {earlierFactNote, packConversation} from '../services/conversation'

// 创建路由实例
const router=Router();

// ===== 提问输入质量校验（第一道防线：垃圾输入不进 RAG 流程，防锚定幻觉）=====
// 返回 null = 合法；否则返回拒绝原因文案。与前端 ChatView 的校验保持一致。
function validateQuestion(text:string):string|null{
    // 去掉标点、符号、空白、控制字符后统计有效字符
    const meaningful=text.replace(/[\p{P}\p{S}\p{Z}\p{C}]/gu,'');
    if(meaningful.length<2){
        return '请输入有效的法律问题（至少 2 个字），描述你遇到的具体情况';
    }
    // 同一字符重复刷屏："aaaaaaaa"、"哈哈哈哈"、"？？？？"（去标点后）
    if(meaningful.length>=4&&/^(.)\1+$/u.test(meaningful)){
        return '请输入有效的法律问题，重复内容无法解答';
    }
    // 纯拉丁字母长串（键盘乱敲）：中文法律咨询场景下无意义（短代码如"N+1"不拦）
    if(!/[一-鿿]/.test(text)&&meaningful.length>=8){
        return '请用中文描述你遇到的法律问题';
    }
    return null;
}

function parseStoredReferences(raw: unknown): Array<{docName: string; chunkIndex: number; text: string}> {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) => item && typeof item.docName === 'string' && typeof item.text === 'string');
    } catch {
        return [];
    }
}

// 解析/创建会话：确保本次问答挂在一个属于当前用户的会话上
// 传了合法 sessionId（存在且属于当前用户）就沿用；否则新建会话（标题取问题前 20 字）
// 返回会话 ID；数据库故障时返回 null（问答照旧进行，只是不挂会话）
async function resolveSession(userId:number,sessionId:any,question:string):Promise<number|null>{
    try{
        // 传了会话 ID：先确认会话存在且属于当前用户（防越权把消息挂到别人的会话）
        if(sessionId){
            // 按 ID + 用户双重条件查询
            const [rows]=await pool.query<any[]>('SELECT id FROM chat_sessions WHERE id=? AND user_id=?',[Number(sessionId),userId]);
            // 查到就沿用该会话
            if(rows.length>0)return rows[0].id;
        }
        // 没有合法会话：新建一个，标题取问题前 20 字
        const [result]=await pool.query<any>('INSERT INTO chat_sessions (user_id,title) VALUES (?,?)',[userId,question.slice(0,20)]);
        // 返回新会话 ID
        return result.insertId;
    }catch(error:any){
        // 会话解析失败不阻断问答，只记日志
        console.error('解析会话失败:',error.message);
        return null;
    }
}

// 定义 POST /api/chat
// 前端调用这个接口来发送消息，返回 AI 回答和引用来源
router.post('/',async (req,res)=>{
    try{
        // 从请求体中读取 messages，格式：[{role:'user',content:'你好'}]；sessionId 可选（继续已有会话时传）
        const {messages,sessionId}=req.body;

        // 如果前端没传 messages，返回 400 错误
        if(!messages||!Array.isArray(messages)){
            // 这条 400 原先毫无痕迹：不建会话、不写历史、不打日志，出问题时完全黑盒
            console.warn('[chat] messages 不是数组:', typeof messages, '｜请求体:', JSON.stringify(req.body).slice(0, 160));
            return res.status(400).json({
                success:false,
                message:'参数错误,messages必须是一个数组'
            });
        }

        // 取最后一条用户消息作为本次要回答的问题
        const question=messages[messages.length-1].content;

        // 输入质量校验：垃圾问题直接 400，不进 RAG（在发 SSE 头之前，还能正常返回 JSON）
        const invalid=validateQuestion(question);
        if(invalid){
            // 记下被拒的原文：只显示状态码时根本查不出是谁发了什么
            console.warn('[chat] 输入校验拒绝:', invalid, '｜收到:', JSON.stringify(question).slice(0, 160));
            return res.status(400).json({success:false,message:invalid});
        }

        // 解析会话：没有合法 sessionId 就新建（标题取问题前 20 字）
        const sid=await resolveSession(req.user!.userId,sessionId,question);

        // 先在本地分清有几件事。一件事检索后本机重排，最多留 4 条；好几件事则逐件检索、逐件重排。
        const asked = questionForRetrieval(messages);
        let references:Array<{docName:string;chunkIndex:number;text:string}>=[];
        let issues:Array<{question:string;references:typeof references}>=[];
        try{
            const groups = await Promise.all(asked.queries.map((query) => retrieveForUserQuestion(query)));
            for (const group of groups) issues.push(...group);
            references=flattenReferences(issues);
        }catch(searchError:any){
            console.error('检索失败，本次问答不带知识库上下文:',searchError.message);
        }

        const packed = packConversation(messages);
        const systemMessage={
            role:'system' as const,
            content:buildLegalPrompt(issues, asked.followUp) + earlierFactNote(packed.earlierFacts)
        };

        // ===== RAG 第三步：带上下文调用 Kimi 生成答案 =====
        // 最近几轮原话保留。更早的回答不带上，避免旧法条被后面的问题沿用。
        const reply=await chatWithKimi([systemMessage,...packed.history]);

        // 把本次问答写入 MySQL 历史表（带上会话 ID；存库失败不影响回复，只记日志）
        // 拿到自增 ID 一并返回：前端点赞/点踩要用它定位这条记录
        let historyId:number|null=null;
        try{
            const [insertResult]=await pool.query<any>(
                'INSERT INTO chat_history (question,answer,user_id,session_id,references_json) VALUES (?,?,?,?,?)',
                [question,reply,req.user!.userId,sid,JSON.stringify(references)]
            );
            // 取出刚插入记录的自增 ID
            historyId=insertResult.insertId;
        }catch(dbError:any){
            console.error('保存对话历史失败:',dbError.message);
        }

        // 返回成功结果：答案 + 引用来源 + 会话 ID + 历史记录 ID（前端据此更新路由/点赞）
        res.json({
            success:true,
            data:{
                answer:reply,
                references,
                sessionId:sid,
                historyId
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

// ===== 流式问答接口 POST /api/chat/stream（SSE）=====
// 流程和非流式一致（检索→拼 prompt→Kimi），区别是 Kimi 的回复逐 token 推给前端
router.post('/stream', async (req, res) => {
    try {
        // 从请求体中读取 messages，格式：[{role:'user',content:'你好'}]；sessionId 可选（继续已有会话时传）
        const {messages,sessionId} = req.body;

        // 如果前端没传 messages，返回 400 错误
        if (!messages || !Array.isArray(messages)) {
            // 这条 400 原先毫无痕迹：不建会话、不写历史、不打日志，出问题时完全黑盒
            console.warn('[chat] messages 不是数组:', typeof messages, '｜请求体:', JSON.stringify(req.body).slice(0, 160));
            return res.status(400).json({
                success: false,
                message: '参数错误,messages必须是一个数组'
            });
        }

        // 取最后一条用户消息作为本次要回答的问题
        const question = messages[messages.length - 1].content;

        // 输入质量校验：垃圾问题直接 400（此时还没发 SSE 头，可以正常返回 JSON）
        const invalid = validateQuestion(question);
        if (invalid) {
            // 记下被拒的原文：只显示状态码时根本查不出是谁发了什么
            console.warn('[chat] 输入校验拒绝:', invalid, '｜收到:', JSON.stringify(question).slice(0, 160));
            return res.status(400).json({success: false, message: invalid});
        }

        // 解析会话：没有合法 sessionId 就新建（标题取问题前 20 字）
        const sid = await resolveSession(req.user!.userId, sessionId, question);

        // ===== 设置 SSE 响应头（检索和重排都比较慢，先把头发出去，页面才有进度）=====
        // text/event-stream：告诉浏览器这是 SSE 流
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        // 禁止缓存，保证每次拿到新数据
        res.setHeader('Cache-Control', 'no-cache');
        // 保持长连接
        res.setHeader('Connection', 'keep-alive');
        // 立即把响应头发出去（不然前端要等第一块数据才能收到头）
        res.flushHeaders();

        const writeStatus = (message: string) => {
            res.write(`data: ${JSON.stringify({type: 'status', message})}\n\n`);
        };

        const asked = questionForRetrieval(messages);
        // 追问先查前面的事实。这句还有新问题时，再查这句。
        let references: Array<{docName: string; chunkIndex: number; text: string}> = [];
        let issues: Array<{question: string; references: typeof references}> = [];
        try {
            const groups = await Promise.all(asked.queries.map((query) => retrieveForUserQuestion(query, writeStatus)));
            for (const group of groups) issues.push(...group);
            references = flattenReferences(issues);
        } catch (searchError: any) {
            console.error('检索失败，本次问答不带知识库上下文:', searchError.message);
        }
        const packed = packConversation(messages);
        const systemMessage = {
            role: 'system' as const,
            content: buildLegalPrompt(issues, asked.followUp) + earlierFactNote(packed.earlierFacts),
        };

        writeStatus(references.length > 0
            ? `已核对 ${references.length} 条相关资料，正在生成回答…`
            : '知识库未检索到相关资料，正在生成回答…');

        // 客户端中途断开标记（关闭页面/切走都会触发）
        let clientGone = false;
        // res close 事件：连接关闭时触发；writableEnded 为 true 说明是正常走完的，不算断开
        res.on('close', () => {
            if (!res.writableEnded) clientGone = true;
        });

        // ===== 调用 Kimi 流式生成，收到 token 就推给前端 =====
        // reply 是拼好的完整回复，结束后用于写历史
        const reply = await chatWithKimiStream([systemMessage, ...packed.history], (token) => {
            // SSE 协议：每条消息格式为 "data: <json>\n\n"（两个换行表示一条结束）
            res.write(`data: ${JSON.stringify({type: 'token', content: token})}\n\n`);
        }, () => clientGone);

        // 客户端已断开：残缺的回复不入历史，直接结束
        if (clientGone) {
            return;
        }

        // ===== 先入库、再推结束事件 =====
        // 顺序很重要：历史记录的自增 ID 要随事件发给前端（点赞/点踩靠它定位记录），
        // 所以必须先 INSERT 拿到 ID，再发 references/session/done 事件
        let historyId: number | null = null;
        try {
            // 把本次问答写入 MySQL 历史表
            const [insertResult] = await pool.query<any>(
                'INSERT INTO chat_history (question,answer,user_id,session_id,references_json) VALUES (?,?,?,?,?)',
                [question, reply, req.user!.userId, sid, JSON.stringify(references)]
            );
            // 取出刚插入记录的自增 ID
            historyId = insertResult.insertId;
        } catch (dbError: any) {
            // 写历史失败不阻断推送，只记日志（前端这条就不能点赞了）
            console.error('保存对话历史失败:', dbError.message);
        }

        // ===== 生成完毕：把引用来源、会话 ID、历史记录 ID 和结束标记推给前端 =====
        res.write(`data: ${JSON.stringify({type: 'references', references})}\n\n`);
        res.write(`data: ${JSON.stringify({type: 'session', sessionId: sid, historyId})}\n\n`);
        res.write(`data: ${JSON.stringify({type: 'done'})}\n\n`);
        // 关闭响应流
        res.end();
    } catch (error: any) {
        // 出错分两种情况：
        if (res.headersSent) {
            // 1. SSE 头已发出（流已开始）：没法再改状态码，只能推一条错误事件再结束
            console.error('流式问答中途出错:', error.message);
            res.write(`data: ${JSON.stringify({type: 'error', message: error.message || '生成失败'})}\n\n`);
            res.end();
        } else {
            // 2. 头还没发（检索阶段就挂了）：可以正常返回 500 JSON
            console.error('流式问答接口出错:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || '服务器内部错误'
            });
        }
    }
});

//查询当前用户的会话列表 GET /api/chat/sessions
//按最后活跃时间倒序，附带每个会话的消息条数，供前端会话侧栏/会话管理页展示
router.get('/sessions',async (req,res)=>{
    try{
        //关联 chat_history 统计每个会话的消息数；updated_at 起别名 updatedAt 对齐前端命名
        //HAVING messageCount > 0：只返回真正提问留下记录的会话，空会话（未提问/入库失败）不展示
        const [rows]=await pool.query(
            `SELECT s.id, s.title, s.created_at AS createdAt, s.updated_at AS updatedAt,
                    COUNT(h.id) AS messageCount
             FROM chat_sessions s
             LEFT JOIN chat_history h ON h.session_id = s.id
             WHERE s.user_id=?
             GROUP BY s.id
             HAVING messageCount > 0
             ORDER BY s.updated_at DESC
             LIMIT 100`,
            [req.user!.userId]
        );
        //返回查询结果
        res.json({success:true,data:rows});
    }catch(error:any){
        //查询失败返回500
        console.error('查询会话列表失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

//查询单个会话的消息 GET /api/chat/sessions/:id/messages
//按时间正序返回（前端加载进对话窗口继续多轮问答）；仅限本人的会话
router.get('/sessions/:id/messages',async (req,res)=>{
    try{
        //从路径参数取会话 ID
        const id=Number(req.params.id);
        //先确认会话属于当前用户（防越权看别人的对话）
        const [sessions]=await pool.query<any[]>('SELECT id FROM chat_sessions WHERE id=? AND user_id=?',[id,req.user!.userId]);
        //不属于就 404（不暴露"存在但不属于你"的信息）
        if(sessions.length===0){
            return res.status(404).json({success:false,message:'会话不存在'});
        }
        //取该会话的全部问答，按时间正序（带 id 和 feedback：id 供点赞定位，feedback 供回填已点赞状态）
        const [rows]=await pool.query<any[]>(
            'SELECT id,question,answer,feedback,references_json AS referencesJson,created_at AS createdAt FROM chat_history WHERE session_id=? ORDER BY id ASC',
            [id]
        );
        const data = rows.map((row) => ({
            id: row.id,
            question: row.question,
            answer: row.answer,
            feedback: row.feedback,
            createdAt: row.createdAt,
            references: parseStoredReferences(row.referencesJson),
        }));
        //返回消息列表
        res.json({success:true,data});
    }catch(error:any){
        //查询失败返回500
        console.error('查询会话消息失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

//重命名会话 PUT /api/chat/sessions/:id
//请求体：{ title: '新标题' }；仅限本人的会话
router.put('/sessions/:id',async (req,res)=>{
    try{
        //从路径参数取会话 ID
        const id=Number(req.params.id);
        //从请求体取新标题
        const {title}=req.body;
        //标题不能为空
        if(!title||!title.trim()){
            return res.status(400).json({success:false,message:'标题不能为空'});
        }
        //执行更新，affectedRows 为 0 说明会话不存在或不属于当前用户
        const [result]=await pool.query<any>(
            'UPDATE chat_sessions SET title=? WHERE id=? AND user_id=?',
            [title.trim().slice(0,100),id,req.user!.userId]
        );
        if(result.affectedRows===0){
            return res.status(404).json({success:false,message:'会话不存在'});
        }
        //更新成功
        res.json({success:true,data:{id}});
    }catch(error:any){
        //更新失败返回500
        console.error('重命名会话失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

//删除会话 DELETE /api/chat/sessions/:id
//会话和会话下的消息一起删（先删消息再删会话，防孤儿数据）；仅限本人的会话
router.delete('/sessions/:id',async (req,res)=>{
    try{
        //从路径参数取会话 ID
        const id=Number(req.params.id);
        //先确认会话属于当前用户
        const [sessions]=await pool.query<any[]>('SELECT id FROM chat_sessions WHERE id=? AND user_id=?',[id,req.user!.userId]);
        if(sessions.length===0){
            return res.status(404).json({success:false,message:'会话不存在'});
        }
        //先删会话下的全部消息
        await pool.query('DELETE FROM chat_history WHERE session_id=?',[id]);
        //再删会话本身
        await pool.query('DELETE FROM chat_sessions WHERE id=?',[id]);
        //删除成功
        res.json({success:true,data:{id}});
    }catch(error:any){
        //删除失败返回500
        console.error('删除会话失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

//查询对话历史接口GET /api/chat/history
//从MySQL chat_history表按当前登录用户过滤，时间倒序读，最多返回50条
router.get('/history',async (req,res)=>{
    try{
        //查询当前用户的历史记录，created_at起别名createdAt,和前端字段命名保持一致
        const [rows]=await pool.query(
            'SELECT id,question,answer,created_at AS createdAt FROM chat_history WHERE user_id=? ORDER BY id DESC LIMIT 50',
            [req.user!.userId]
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

//给答案点赞/点踩 PUT /api/chat/history/:id/feedback
//请求体：{ feedback: 1 } 点赞 / { feedback: -1 } 点踩 / { feedback: 0 } 取消反馈；仅限本人的记录
router.put('/history/:id/feedback',async (req,res)=>{
    try{
        //从路径参数取历史记录 ID
        const id=Number(req.params.id);
        //从请求体取反馈值
        const {feedback}=req.body;
        //只允许 1（赞）/-1（踩）/0（取消），其他值一律 400
        if(![1,-1,0].includes(Number(feedback))){
            return res.status(400).json({success:false,message:'feedback 只能是 1、-1 或 0'});
        }
        //执行更新，affectedRows 为 0 说明记录不存在或不属于当前用户
        const [result]=await pool.query<any>(
            'UPDATE chat_history SET feedback=? WHERE id=? AND user_id=?',
            [Number(feedback),id,req.user!.userId]
        );
        if(result.affectedRows===0){
            return res.status(404).json({success:false,message:'记录不存在'});
        }
        //更新成功，返回最新反馈值（前端据此高亮图标）
        res.json({success:true,data:{id,feedback:Number(feedback)}});
    }catch(error:any){
        //更新失败返回500
        console.error('保存反馈失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

//删除单条对话历史接口 DELETE /api/chat/history/:id
//只删属于当前用户的记录（WHERE 里带 user_id，防止越权删别人的）
router.delete('/history/:id',async (req,res)=>{
    try{
        //从路径参数取记录 ID
        const id=Number(req.params.id);
        //执行删除，affectedRows 表示实际删了几条
        const [result]=await pool.query<any>(
            'DELETE FROM chat_history WHERE id=? AND user_id=?',
            [id,req.user!.userId]
        );
        //affectedRows 为 0：记录不存在或不属于当前用户
        if(result.affectedRows===0){
            return res.status(404).json({success:false,message:'记录不存在'});
        }
        //删除成功
        res.json({success:true,data:{id}});
    }catch(error:any){
        //删除失败返回500
        console.error('删除对话历史失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
});

// 导出路由
export default router;