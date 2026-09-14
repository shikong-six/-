// 聊天相关类型与接口封装（与后端 /api/chat 契约对齐）

// 引用来源：后端召回的法条块信息
export interface Reference {
  docName: string;    // 出自哪个文档
  chunkIndex: number; // 第几个分块
  text: string;       // 法条原文
}

// 发给后端的消息（只带角色和内容）
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

import request from './request';

// 会话内的一条问答记录（加载历史会话时还原对话窗口用）
export interface SessionMessage {
  id: number;          // 历史记录 ID（点赞/点踩定位用）
  question: string;    // 用户问题
  answer: string;      // AI 回答
  feedback: number | null; // 用户反馈：1赞 -1踩 null未反馈
  createdAt: string;   // 问答时间
}

// 查询某个会话的消息（按时间正序，用于还原对话窗口继续问答）
export async function getSessionMessages(sessionId: number): Promise<SessionMessage[]> {
  const response = await request.get<ApiResponse<SessionMessage[]>>(`/chat/sessions/${sessionId}/messages`);
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取会话消息失败');
}
