// 聊天相关类型与接口封装（与后端 /api/chat 契约对齐）

import request from './request';

// 引用来源：后端召回的法条块信息
export interface Reference {
  docName: string;    // 出自哪个文档（库里的原始文件名，含日期和扩展名）
  chunkIndex: number; // 第几个分块
  text: string;       // 法条原文
}

// 引用卡片上的法律名。文件名里的 _20121228 和 .docx 只用于入库，不显示。
export function lawDisplayName(docName: string): string {
  const name = docName.replace(/\.[^.]+$/, '').replace(/_\d{8}$/, '').trim();
  return name || docName;
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

// 对话会话（对应后端 chat_sessions 表）
export interface ChatSession {
  id: number;           // 会话 ID
  title: string;        // 会话标题（首问前 20 字）
  createdAt: string;    // 创建时间
  updatedAt: string;    // 最后活跃时间
  messageCount: number; // 会话内消息条数
}

// 会话内的一条问答记录（加载历史会话时还原对话窗口用）
export interface SessionMessage {
  id: number;          // 历史记录 ID（点赞/点踩定位用）
  question: string;    // 用户问题
  answer: string;      // AI 回答
  feedback: number | null; // 用户反馈：1赞 -1踩 null未反馈
  references?: Reference[]; // 回答引用的法条，刷新后从历史还原
  createdAt: string;   // 问答时间
}

// 查询当前用户的会话列表（按最后活跃倒序，含每个会话的消息条数）
export async function getSessions(): Promise<ChatSession[]> {
  const response = await request.get<ApiResponse<ChatSession[]>>('/chat/sessions');
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取会话列表失败');
}

// 查询某个会话的消息（按时间正序，用于还原对话窗口继续问答）
export async function getSessionMessages(sessionId: number): Promise<SessionMessage[]> {
  const response = await request.get<ApiResponse<SessionMessage[]>>(`/chat/sessions/${sessionId}/messages`);
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || '获取会话消息失败');
}

// 重命名会话
export async function renameSession(sessionId: number, title: string): Promise<void> {
  const response = await request.put<ApiResponse<{id: number}>>(`/chat/sessions/${sessionId}`, {title});
  if (!response.data.success) {
    throw new Error(response.data.message || '重命名失败');
  }
}

// 删除会话（会话和消息一起删）
export async function deleteSession(sessionId: number): Promise<void> {
  const response = await request.delete<ApiResponse<{id: number}>>(`/chat/sessions/${sessionId}`);
  if (!response.data.success) {
    throw new Error(response.data.message || '删除失败');
  }
}

// feedback：1 点赞 / -1 点踩 / 0 取消
export async function setFeedback(id: number, feedback: number): Promise<void> {
  const response = await request.put<ApiResponse<{id: number; feedback: number}>>(
    `/chat/history/${id}/feedback`,
    {feedback}
  );
  if (!response.data.success) {
    throw new Error(response.data.message || '反馈失败');
  }
}
