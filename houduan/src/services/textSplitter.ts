// 文本分块服务
// 把长文本切成固定长度的小块，方便向量化

// 分块配置
const CHUNK_SIZE=500 // 每个块最大字符数
const CHUNK_OVERLAP=100 // 相邻块之间的重叠字符数

// 分块函数
export function splitText(text:string):string[]{
    const chunks:string[]=[]
    // 先按段落拆，过滤掉空行
    const paragraphs=text.split('\n').filter(p=>p.trim().length>0);
    // 当前正在累积的文本块
    let currentChunk=''
    for (const paragraph of paragraphs){
        // 当前块加上这段还没超上限，就继续拼进去
        if(currentChunk.length+paragraph.length<CHUNK_SIZE){
            currentChunk+=paragraph+'\n'
        }else{
            // 当前块够大了，先存起来
            if(currentChunk.trim()){
                chunks.push(currentChunk.trim())
            }
            // 保留上一块结尾的一部分作为重叠上下文，再开始新块
            currentChunk=getOverlap(currentChunk)+paragraph+'\n'
        }
    }
    // 循环结束后把最后一块加进去
    if(currentChunk.trim()){
        chunks.push(currentChunk.trim())
    }
    return chunks;
}

// 取文本末尾的一部分作为重叠
function getOverlap(text:string):string{
    if(text.length<=CHUNK_OVERLAP){
        return text;
    }
    return text.slice(-CHUNK_OVERLAP)
}