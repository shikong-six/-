// 引入 axios... 改为统一 request 实例（自动携带 token，401 自动跳登录）
import request from './request';

// 引用来源：后端召回的法条块信息
export interface Reference {
  docName: string;    // 出自哪个文档
  chunkIndex: number; // 第几个分块
  text: string;       // 法条原文
}

// 定义消息类型
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 定义后端返回格式（RAG 接入后，data 里同时带答案和引用来源）
interface ChatResponse {
  success: boolean;
  data: {
    answer: string;
    references: Reference[];
  };
}

//调用后端聊天接口
// messages：当前对话的消息历史
// 返回值：AI 的回答 + 引用来源列表
export async function sendMessage(messages: ChatMessage[]): Promise<{ answer: string; references: Reference[] }> {
  // 发送 POST 请求到 /api/chat
  const response = await request.post<ChatResponse>(
    '/chat',
    { messages }
  );
  // 如果后端返回成功
  if (response.data.success) {
    return response.data.data;
  }

  // 如果后端返回失败，抛出错误
  throw new Error('聊天接口返回失败');
}
export interface ChatHistoryItem{
  id:number;
  question:string;
  answer:string;
  createdAt:string;
}
interface ApiResponse<T>{
  success:boolean;
  data:T;
  message?:string
}
//查询对话历史列表(最多50条，时间倒序)
export async function getChatHistory():Promise<ChatHistoryItem[]>{
  const response=await request.get<ApiResponse<ChatHistoryItem[]>>('/chat/history');
  if(response.data.success){
    return response.data.data
  }
  throw new Error(response.data.message||'获取对话历史失败')
}