// 文本向量化：进程内运行中文小模型 bge-small-zh，不经过 Ollama。
// 文档和问题必须用同一个模型。换模型后要清空向量库重灌，不能混用旧向量。
import {env, pipeline, type FeatureExtractionPipeline} from '@huggingface/transformers';

const MODEL_ID = 'Xenova/bge-small-zh-v1.5';
// bge 检索时，只给问题加这句指令，条文原文不加
const QUERY_PREFIX = '为这个句子生成表示以用于检索相关文章：';
const EMBED_BATCH = 32;

// huggingface.co 在这边连不上。默认从 ModelScope 拉模型，可用 HF_ENDPOINT 覆盖。
const modelHost = (process.env.HF_ENDPOINT || 'https://www.modelscope.cn/models/').replace(/\/?$/, '/');
env.remoteHost = modelHost;
if (modelHost.includes('modelscope.cn')) {
  env.remotePathTemplate = '{model}/resolve/master/';
}

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let embedTail: Promise<void> = Promise.resolve();

function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = embedTail.then(job, job);
  embedTail = run.then(() => undefined, () => undefined);
  return run;
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    console.log('正在加载 bge-small-zh（首次会下载模型）…');
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {dtype: 'q8'}).catch((error) => {
      extractorPromise = null;
      throw error;
    });
  }
  return extractorPromise;
}

function toVectors(tensor: {tolist: () => number[] | number[][]}, count: number): number[][] {
  const list = tensor.tolist();
  if (count === 1) {
    const row = Array.isArray(list[0]) ? (list as number[][])[0] : (list as number[]);
    return [row];
  }
  return list as number[][];
}

// 把条文原文转成向量。不要给原文加检索指令。
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return exclusive(async () => {
    const extractor = await getExtractor();
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const input = texts.slice(i, i + EMBED_BATCH);
      const tensor = await extractor(input, {pooling: 'cls', normalize: true});
      embeddings.push(...toVectors(tensor, input.length));
    }
    return embeddings;
  });
}

// 把用户问题转成向量。bge 要求问题前面加检索指令，否则和条文对不齐。
export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embedQueries([query]);
  return vector;
}

// 几件事的问题一次算完。简单问题仍走 embedQuery。
export async function embedQueries(queries: string[]): Promise<number[][]> {
  if (queries.length === 0) return [];
  return embedTexts(queries.map((query) => QUERY_PREFIX + query));
}
