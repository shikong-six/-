// 引入 axios... 改为统一 request 实例（自动携带 token，401 自动跳登录）
import request from './request';

// 引用来源：后端召回的法条块信息
export interface Reference {
  docName: string;    // 出自哪个文档
  chunkIndex: number; // 第几个分块
  text: string;       // 法条原文
}

// 定义消息类型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 对话会话（对应后端 chat_sessions 表）
export interface ChatSession {
  id: number;          // 会话 ID
  title: string;       // 会话标题（首问前 20 字）
  createdAt: string;   // 创建时间
  updatedAt: string;   // 最后活跃时间
  messageCount: number;// 会话内消息条数
}

// 会话内的一条问答记录（加载历史会话时还原对话窗口用）
export interface SessionMessage {
  id: number;          // 历史记录 ID（点赞/点踩定位用）
  question: string;    // 用户问题
  answer: string;      // AI 回答
  feedback: number | null; // 用户反馈：1赞 -1踩 null未反馈
  createdAt: string;   // 问答时间
}

// 定义后端返回格式（RAG 接入后，data 里同时带答案和引用来源；sessionId/historyId 供前端更新路由和点赞）
interface ChatResponse {
  success: boolean;
  data: {
    answer: string;
    references: Reference[];
    sessionId: number | null;
    historyId: number | null;
  };
}

// 后端统一返回格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

//调用后端聊天接口（非流式，降级保留）
// messages：当前对话的消息历史
// sessionId：可选，继续某个已有会话时传
// 返回值：AI 的回答 + 引用来源列表 + 会话 ID + 历史记录 ID
export async function sendMessage(
  messages: ChatMessage[],
  sessionId?: number | null
): Promise<{ answer: string; references: Reference[]; sessionId: number | null; historyId: number | null }> {
  // 发送 POST 请求到 /api/chat
  const response = await request.post<ChatResponse>(
    '/chat',
    { messages, sessionId: sessionId ?? null }
  );
  // 如果后端返回成功
  if (response.data.success) {
    return response.data.data;
  }

  // 如果后端返回失败，抛出错误
  throw new Error('聊天接口返回失败');
}

// ===== 流式发送消息（SSE）=====
// 用原生 fetch 读流（axios 处理 SSE 不方便），不走 request 实例的拦截器，401 在这里手动处理
// callbacks.onToken：每收到一个 token 回调一次（用于逐字渲染）
// callbacks.onReferences：生成完毕后回调引用来源
// callbacks.onSession：生成完毕后回调会话 ID（新建会话时前端据此更新路由）
export async function sendMessageStream(
  messages: ChatMessage[],
  sessionId: number | null,
  callbacks: {
    onToken: (token: string) => void;
    onReferences: (references: Reference[]) => void;
    onSession: (sessionId: number | null, historyId: number | null) => void;
  }
): Promise<void> {
  // 从本地存储取 token（对齐 request.ts 拦截器的取法）
  const token = localStorage.getItem('fazhitong_token');
  // 发起 POST 请求到流式接口
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    // 手动带 Content-Type 和 Authorization（没有请求拦截器帮忙了）
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    // 消息历史和会话 ID 放在请求体里
    body: JSON.stringify({messages, sessionId: sessionId ?? null})
  });
  // 401 处理（对齐 request.ts 响应拦截器的行为：清凭证跳登录）
  if (response.status === 401) {
    localStorage.removeItem('fazhitong_token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('登录已过期，请重新登录');
  }
  // 其他错误状态直接抛错
  if (!response.ok || !response.body) {
    throw new Error('请求失败：' + response.status);
  }
  // 拿响应体的读取器，逐块读流
  const reader = response.body.getReader();
  // 解码器：把字节流解码成字符串（utf-8）
  const decoder = new TextDecoder('utf-8');
  // 缓存没处理完的半条数据（网络分包可能把一条 SSE 切成两块）
  let buffer = '';
  // 循环读，直到流结束
  for (;;) {
    // 读一块：done 表示流结束，value 是字节数据
    const {done, value} = await reader.read();
    // 流结束就退出循环
    if (done) break;
    // 解码并拼进缓存
    buffer += decoder.decode(value, {stream: true});
    // SSE 一条消息以空行（\n\n）结尾，按它切开
    const events = buffer.split('\n\n');
    // 最后一段是不完整的消息，留回缓存等下一块
    buffer = events.pop() || '';
    // 逐条处理完整消息
    for (const event of events) {
      // 去掉首尾空白
      const line = event.trim();
      // 只认 data: 开头的数据行
      if (!line.startsWith('data:')) continue;
      // 解析 data 后面的 JSON
      const data = JSON.parse(line.slice(5).trim());
      // token 事件：把内容抛给页面逐字渲染
      if (data.type === 'token') {
        callbacks.onToken(data.content);
      } else if (data.type === 'references') {
        // 引用来源：生成完毕，交给页面展示
        callbacks.onReferences(data.references);
      } else if (data.type === 'session') {
        // 会话 ID + 历史记录 ID：交给页面更新路由、点亮点赞按钮
        callbacks.onSession(data.sessionId, data.historyId);
      } else if (data.type === 'error') {
        // 后端流中途出错
        throw new Error(data.message || '生成失败');
      }
    }
  }
}

// ===== 会话管理接口 =====

// 查询当前用户的会话列表（按最后活跃倒序，含每个会话的消息条数）
export async function getSessions(): Promise<ChatSession[]> {
  // 发送 GET 请求到 /api/chat/sessions
  const response = await request.get<ApiResponse<ChatSession[]>>('/chat/sessions');
  // 后端返回成功则取 data
  if (response.data.success) {
    return response.data.data;
  }
  // 失败则抛出后端给的错误信息
  throw new Error(response.data.message || '获取会话列表失败');
}

// 查询某个会话的消息（按时间正序，用于还原对话窗口继续问答）
export async function getSessionMessages(sessionId: number): Promise<SessionMessage[]> {
  // 发送 GET 请求到 /api/chat/sessions/:id/messages
  const response = await request.get<ApiResponse<SessionMessage[]>>(`/chat/sessions/${sessionId}/messages`);
  // 后端返回成功则取 data
  if (response.data.success) {
    return response.data.data;
  }
  // 失败则抛出后端给的错误信息
  throw new Error(response.data.message || '获取会话消息失败');
}

// 重命名会话
export async function renameSession(sessionId: number, title: string): Promise<void> {
  // 发送 PUT 请求到 /api/chat/sessions/:id
  const response = await request.put<ApiResponse<{ id: number }>>(`/chat/sessions/${sessionId}`, {title});
  // 后端返回失败时抛出错误信息
  if (!response.data.success) {
    throw new Error(response.data.message || '重命名失败');
  }
}

// 删除会话（会话和消息一起删）
export async function deleteSession(sessionId: number): Promise<void> {
  // 发送 DELETE 请求到 /api/chat/sessions/:id
  const response = await request.delete<ApiResponse<{ id: number }>>(`/chat/sessions/${sessionId}`);
  // 后端返回失败时抛出错误信息
  if (!response.data.success) {
    throw new Error(response.data.message || '删除失败');
  }
}

// ===== 消息级历史接口（旧版历史页用；会话管理上线后主要用上面的会话接口）=====

// 单条历史消息
export interface ChatHistoryItem {
  id: number;
  question: string;
  answer: string;
  createdAt: string;
}

//查询对话历史列表(最多50条，时间倒序，只含当前登录用户的)
export async function getChatHistory(): Promise<ChatHistoryItem[]> {
  // 发送 GET 请求到 /api/chat/history
  const response = await request.get<ApiResponse<ChatHistoryItem[]>>('/chat/history');
  // 后端返回成功则取 data
  if (response.data.success) {
    return response.data.data;
  }
  // 失败则抛出后端给的错误信息
  throw new Error(response.data.message || '获取对话历史失败');
}

//删除单条对话历史
export async function deleteChatHistory(id: number): Promise<void> {
  //发送 DELETE 请求到 /api/chat/history/:id
  const response = await request.delete<ApiResponse<{ id: number }>>(`/chat/history/${id}`);
  //后端返回失败时抛出错误信息
  if (!response.data.success) {
    throw new Error(response.data.message || '删除失败');
  }
}

// 给答案点赞/点踩
// feedback：1 点赞 / -1 点踩 / 0 取消反馈
export async function setFeedback(id: number, feedback: number): Promise<void> {
  // 发送 PUT 请求到 /api/chat/history/:id/feedback
  const response = await request.put<ApiResponse<{ id: number; feedback: number }>>(
    `/chat/history/${id}/feedback`,
    {feedback}
  );
  // 后端返回失败时抛出错误信息
  if (!response.data.success) {
    throw new Error(response.data.message || '反馈失败');
  }
}
