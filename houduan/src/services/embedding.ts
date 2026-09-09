//文本向量化服务
//通过本地ollama运行Embedding模型,把文本转化成向量
//使用前需要先建好模型,例如：ollama pull nomic-embed-text
import axios from 'axios'

//Ollama 服务地址，从环境变量读取,默认本地11434窗口
const OllAMA_BASE_URL=process.env.OLLAMA_BASE_URL||'http://localhost:11434'

//Embedding模型名，从环境变量读取，默认namic-embed-text
const EMBED_MODEL=process.env.OLLAMA_EMBED_MODEL||'nomic-embed-text';

//把一批文本批量转换成向量
//参数texts:要向量化的文本数组
//返回：二位数组，每个文本对应一个向量
export async function embedTexts(texts:string[]):Promise<number[][]>{
    //空数组直接返回,避免无意义的HTTP请求
    if(texts.length===0){
        return [];
    }
    try{
        //调用ollama的批量向量化接口
        const response=await axios.post(
            `${OllAMA_BASE_URL}/api/embed`,
            {
                model:EMBED_MODEL,
                input:texts
            }
        );
        return response.data.embeddings;
    }catch(error:any){
// 打印详细错误，方便定位（常见原因：Ollama 没启动、模型没安装）
        console.error('向量化失败',error.response?.data||error.message);
        throw new Error(
          'Ollama 向量化调用失败，请确认Ollama服务已启动，且模型已安装。错误信息:'+EMBED_MODEL
)
    }
}
//把单个问题文本转化成向量(检索时候用)
export async function embedQuery(query:string):Promise<number[]>{
    const vectors=await embedTexts([query])
    return vectors[0]
}