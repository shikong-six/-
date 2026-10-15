// 知识库路由：处理文档上传、解析入库、相似度检索
import pool from '../services/db'
import {Router} from 'express'
import multer from 'multer'
import path from 'path'
import {parseDocument} from '../services/documentParser'
import {splitText} from '../services/textSplitter'
import {embedTexts, embedQuery} from '../services/embedding'
import {addChunks, searchChunks, deleteChunksByDocName, ChunkRecord} from '../services/vectorStore'
// 上传文档后把"第X条"式条文同步进法律条文库（文档删除时配套清理）
import {syncDocArticles, deleteDocArticles} from '../services/content'

const router=Router()

// 配置文件上传
// 用 diskStorage 保留原始文件名和扩展名
// 解析文档时要靠扩展名判断格式（.pdf/.docx/.txt）
// 文件名加时间戳前缀，避免不同文档重名互相覆盖
// limits 限制文件最大 20MB：不限制的话超大文件会撑爆磁盘/内存
const storage=multer.diskStorage({
    destination:'upload/',
       filename:(req,file,cb)=>{
        // multer 默认按 latin1 解码文件名，中文会乱码，这里手动转回 UTF-8
        const originalName=Buffer.from(file.originalname,'latin1').toString('utf8')
        cb(null,`${Date.now()}-${originalName}`)
    }
})
const upload=multer({
    storage,
    // 文件大小上限 20MB，超出会抛 LIMIT_FILE_SIZE 错误（由 app.ts 的错误中间件统一兜底）
    limits:{fileSize:20*1024*1024}
});

// 上传文档接口 POST /api/knowledge/upload
// 流程：保存文件 → 解析文本 → 分块 → 向量化 → 写入向量库
router.post('/upload',upload.single('file'),async (req,res)=>{
    try{
        // req.file 是上传的文件信息
        if(!req.file){
            return res.status(400).json({
                success:false,
                message:'没有上传文件'
                   })
                }
        const file=req.file;

        // 1. 解析文档，提取纯文本
        const text=await parseDocument(file.path);
        if(!text.trim()){
            return res.status(400).json({
                success:false,
                message:'文档中没有提取到文字内容'
            });
        }

        // multer 按 latin1 给出文件名，中文要转回 UTF-8，向量库和文档表用同一个名字
        const originalName=Buffer.from(file.originalname,'latin1').toString('utf8');

        // 1.5 顺带把"第X条"式条文同步到法律条文库（失败不阻断向量入库，只记日志）
        let articleCount=0;
        try{
            articleCount=await syncDocArticles(originalName,text);
        }catch(articleError:any){
            console.error('同步法律条文失败:',articleError.message);
        }

        // 2. 按条分块（没有“第X条”的文档按段落，不按固定字数）
        const chunks=splitText(text, originalName);

        // 3. 批量向量化（一次请求算完所有块，比一块请求一次快得多）
        const vectors=await embedTexts(chunks);

        // 4. 组装成向量库记录
        const records:ChunkRecord[]=chunks.map((chunk,index)=>({
            vector:vectors[index],     // 该块对应的向量
            text:chunk,                // 文本块
            docName:originalName, // 所属文档名
            chunkIndex:index           // 分块序号
        }));

        // 5. 写入向量库
        await addChunks(records);
        //6.写入MySQL文档元数据表（带上传用户，供个人中心统计）
        try {
            await pool.query(
                'INSERT INTO documents (filename,size,chunk_count,user_id) VALUES (?,?,?,?)',
                [originalName, file.size, chunks.length, req.user?.userId ?? null]
            )
        } catch {
            // 兼容尚未迁移 user_id 列的旧库
            await pool.query(
                'INSERT INTO documents (filename,size,chunk_count) VALUES (?,?,?)',
                [originalName, file.size, chunks.length]
            )
        }

        // 返回处理结果
        res.json({
            success:true,
            data:{
                filename:originalName,
                size:file.size,
                chunkCount:chunks.length,
                articleCount
            }
        });
    }catch(error:any){
        res.status(500).json({
            success:false,
            message:error.message
        });
    }
})

// 相似度检索接口 POST /api/knowledge/search
// 请求体：{ query: '问题文本', topK: 3 }
// 用于测试向量库检索效果，后面 RAG 问答也会用这条链路
router.post('/search',async (req,res)=>{
    try{
        const {query,topK}=req.body;
        if(!query||typeof query!=='string'){
            return res.status(400).json({
                success:false,
                message:'参数错误，query 必须是非空字符串'
            });
        }

        // 1. 把问题文本向量化
        const queryVector=await embedQuery(query);

        // 2. 在向量库里找最相近的 topK 个文本块
        const results=await searchChunks(queryVector,topK||3);
        //按"文档名＋块号"去重，避免内容重叠的分块重复出现在结果里
        const seen=new Set<string>()
        const deduped=results.filter(chunk=>{
            //用文档名#块号作为唯一标识
            const key=`${chunk.docName}#${chunk.chunkIndex}`;
            //已经出现过的过滤掉
            if(seen.has(key)) return false;
            //没出现过就几下，保留这一条
            seen.add(key);
            return true;
        })

        res.json({
            success:true,
            data:deduped
        });
    }catch(error:any){
        res.status(500).json({
            success:false,
            message:error.message
        });
    }
})

//文档列表接口GET/api/knowledge/List
//从MySQL读已上传文档，前端页面加载时调用
router.get('/list',async (req,res)=>{
    try{
        //接上传时间倒序，新上传的排在最前面
         const [rows]=await pool.query(
            'SELECT id,filename,size,chunk_count AS chunkCount,created_at AS createdAt FROM documents ORDER BY id DESC'
        );
        res.json({
            success:true,
            data:rows
        });
    }catch(error:any){
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
})

//删除文档接口 DELETE /api/knowledge/:id
//MySQL 元数据 + 向量库分块一起删，保证两处数据一致
router.delete('/:id',async (req,res)=>{
    try{
        //从路径参数取文档 ID
        const id=Number(req.params.id);
        //先查文档元数据，拿到文件名（向量库记录按文件名关联）
        const [rows]=await pool.query<any[]>('SELECT id,filename FROM documents WHERE id=?',[id]);
        //查不到说明文档不存在
        if(rows.length===0){
            return res.status(404).json({success:false,message:'文档不存在'});
        }
        //取出文件名，后面删向量库要用
        const filename=rows[0].filename;
        //删除向量库里该文档的所有分块（向量库删失败不阻断，只记日志，MySQL 元数据照常删）
        try{
            await deleteChunksByDocName(filename);
        }catch(vectorError:any){
            console.error('删除向量库分块失败:',vectorError.message);
        }
        //删除 MySQL 里的文档元数据
        await pool.query('DELETE FROM documents WHERE id=?',[id]);
        //同步删除该文档提取到法律条文库的条目（失败只记日志，不阻断文档删除）
        try{
            await deleteDocArticles(filename);
        }catch(articleError:any){
            console.error('删除法律条文条目失败:',articleError.message);
        }
        //删除成功，返回被删文档的 ID
        res.json({success:true,data:{id}});
    }catch(error:any){
        //删除失败返回500
        console.error('删除文档失败:',error.message);
        res.status(500).json({success:false,message:error.message});
    }
})
export default router;
