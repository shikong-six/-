// 引入 axios，用于发送 HTTP 请求
import axios from 'axios';

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
        }
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
