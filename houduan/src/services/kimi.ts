// 引入 axios，用于发送 HTTP 请求
import axios from 'axios';
import {TextDecoder} from 'node:util';

// 从环境变量读取 Kimi 的基础地址
const BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';

// 定义消息类型
interface ChatMessage {
  role: 'system'|'user'|'assistant';
  content: string;
}

// 封装好的对话函数
export async function chatWithKimi(messages: ChatMessage[]):Promise<string> {
  // 在函数调用时读取 API Key
  const API_KEY = process.env.KIMI_API_KEY;

  // 检查 API Key 是否存在
  if (!API_KEY) {
    throw new Error('缺少环境变量 KIMI_API_KEY，请在 .env 文件中配置');
  }
  try {
    // 调用 Kimi 的 chat/completions 接口
    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: 'kimi-k2.6',
        messages
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        // 超时 120 秒：默认无超时，Kimi 卡住时连接会一直占着
        timeout: 120000
      }
    );

    // 从返回结果中提取 AI 的回复内容
    return response.data.choices[0].message.content;
  } catch (error: any) {
    // 如果请求失败，打印详细错误
    console.error('Kimi 调用失败:', error.response?.data || error.message);
    throw new Error('Kimi 接口调用失败');
  }
}

// 流式对话：请求 Kimi 的 stream 模式，收到一个 token 就通过 onToken 回调推出去
// 返回值为拼好的完整回复（和 chatWithKimi 一样，只是过程中能逐字拿到内容）
// isCancelled：可选的取消检查函数（客户端中途断开时用来中止生成，每收一块检查一次）
export async function chatWithKimiStream(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  isCancelled?: () => boolean
): Promise<string> {
  // 在函数调用时读取 API Key
  const API_KEY = process.env.KIMI_API_KEY;

  // 检查 API Key 是否存在
  if (!API_KEY) {
    throw new Error('缺少环境变量 KIMI_API_KEY，请在 .env 文件中配置');
  }

  // 发起流式请求：stream:true 让 Kimi 逐块返回；responseType:'stream' 让 axios 返回可读流
  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: 'kimi-k2.6',
      messages,
      stream: true
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      // 超时 120 秒：只约束"响应头到达前"的阶段（流式响应头到达很快），不限制生成时长
      timeout: 120000
    }
  );

  // 累加完整回复，结束后作为返回值
  let fullReply = '';
  // 缓存没处理完的半行数据（网络分包可能把一行 SSE 切成两次 chunk）
  let buffer = '';
  // 增量解码器：多字节字符（如中文，3 字节）可能被拆在两个 chunk 里，
  // 必须用它按流解码（stream:true 会把半个字符的字节留到下次），
  // 用 chunk.toString('utf8') 则会把它替换成乱码 �
  const decoder = new TextDecoder('utf-8');

  // 等流结束：包一层 Promise，流的 data/end/error 事件都在这里处理
  await new Promise<void>((resolve, reject) => {
    // 每收到一块数据就解析
    response.data.on('data', (chunk: Buffer) => {
      // 客户端已断开：销毁流，停止继续生成（省 Kimi 并发额度，免费账号并发上限 1）
      if (isCancelled?.()) {
        response.data.destroy();
        return;
      }
      // 增量解码：半个多字节字符的字节会留在解码器里等下一个 chunk
      buffer += decoder.decode(chunk, {stream: true});
      // 按行切开，最后一段可能是半行，先留回缓存
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      // 逐行处理
      for (const line of lines) {
        // 去掉首尾空白
        const trimmed = line.trim();
        // SSE 协议数据行以 "data:" 开头，其他行（空行等）跳过
        if (!trimmed.startsWith('data:')) continue;
        // 取 "data:" 后面的内容
        const payload = trimmed.slice(5).trim();
        // [DONE] 是流结束标记，不需要解析
        if (payload === '[DONE]') continue;
        try {
          // 解析 JSON 块
          const json = JSON.parse(payload);
          // OpenAI 兼容格式：增量内容在 choices[0].delta.content
          const token = json.choices?.[0]?.delta?.content || '';
          // 有内容就累加并回调
          if (token) {
            fullReply += token;
            onToken(token);
          }
        } catch (parseError) {
          // 单个块解析失败不中断，跳过（流式场景偶发截断）
          console.error('解析 Kimi 流式数据块失败:', payload);
        }
      }
    });
    // 流正常结束（end 是 close 之前触发的"读完"信号）
    response.data.on('end', () => {
      // 冲刷解码器：把流末尾可能残留的半个字符解码完（正常情况 buffer 已是空串）
      buffer += decoder.decode();
      resolve();
    });
    // 流被销毁（客户端断开时主动 destroy 会走到这里）
    response.data.on('close', () => resolve());
    // 流异常中断
    response.data.on('error', (err: Error) => reject(err));
  });

  // 返回拼好的完整回复
  return fullReply;
}
