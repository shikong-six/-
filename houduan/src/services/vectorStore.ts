//向量数据库存储服务(LanceDB 实现)
//负责文本块向量的写入和相似度检索
import * as lancedb from "@lancedb/lancedb"
import path from 'path'

//向量库里每条记录的字段结构
export type ChunkRecord={
    vector:number[];//文本块的embedding向量
    text:string;//文本块原文
    docName:string;//文档名
    chunkIndex:number;//在文档中的分块序号
}

//检索结果的结构
export type SearcheResult={
    text:string; //命中的文本块原文
    docName:string;//所属文档名
    chunkIndex:number;//分块序号
    score:number;//相似度得分(LanceDB返回的_disttance,越小越相似)
}
//数据文件存放目录，从环境变量读取，默认后端目录下的vector_db
const DB_PATH=process.env.LANCEDB_PATH||path.resolve(process.cwd(),'vector_db');
//表名:存放文档分块
const TABLE_NAME='documents';

//链接数据库并拿到表
//表不存在时:传了数据就用数据建表，没传数据说明还没入库过，返回null
async function getTable(records?:ChunkRecord[]):Promise<lancedb.Table|null>{
    const db=await lancedb.connect(DB_PATH);
    //查看当前有哪些表
    const names=await db.tableNames()
    if(names.includes(TABLE_NAME)){
        //表存在，直接返打开
        return await db.openTable(TABLE_NAME);
    }
    //表不存在且没有数据可建表，返回null
    if(!records||records.length===0){
        return null;
    }
    //用第一批数据创建表(字段结构按ChunkRecord推断)
    return await db.createTable(TABLE_NAME,records);
}

//把文档分块批量写入向量库
export async function addChunks(records:ChunkRecord[]):Promise<void>{
    //没有数据直接返回
    if(records.length===0){
        return;
    }
    const table=await getTable(records);
    if(table){
        //把记录追加到表里
        await table.add(records);
    }
}

//相似度检索:返回与查询向量相近的topk个文本块
export async function searchChunks(queryVector:number[],topk:number=3):Promise<SearcheResult[]>{
    const table=await getTable()
    //还没入库过任何文档,直接返回空结果
    if(!table){
        return[];
    }
    //nearestTo:按向量距离排序：limit:取前topK条
    const results=await table.query().nearestTo(queryVector).limit(topk).toArray();
    //把LanceDB返回的原始记录整理成SearcheResult结构
    return results.map((r:any)=>({
        text:r.text,
        docName:r.docName,
        chunkIndex:r.chunkIndex,
        score:r._distance
    }));
}
    