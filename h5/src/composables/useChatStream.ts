// SSE 流式问答组合式函数：把 fetch 读流、事件分发、中止控制抽离出页面
// 用法：const {streaming, streamChat, stop} = useChatStream()
// SSE 事件协议与后端对齐：token（增量内容）/ references（引用来源）
//                        / session（会话ID+历史ID）/ done（结束）/ error（中途出错）
import {ref} from 'vue';
import type {ChatMessage, Reference} from '@/services/chat';
import {useUserStore} from '@/store/user';

// 流式过程中的回调集合
export interface StreamHandlers {
  onStatus: (message: string) => void;             // 检索完成，拿到进度提示（首 token 之前）
  onToken: (token: string) => void;                 // 每收到一个增量 token
  onReferences: (references: Reference[]) => void;  // 生成完毕，拿到引用来源
  onSession: (sessionId: number, historyId: number | null) => void; // 拿到会话 ID 和历史 ID
  onDone: () => void;                               // 正常结束
  onError: (message: string) => void;               // 中途出错（含手动中止）
}

export function useChatStream() {
  // 是否正在流式生成中（控制输入框/按钮状态）
  const streaming = ref(false);
  // 中止控制器：手动停止或组件卸载时掐断连接，后端会感知断开并中止 Kimi 生成
  let abortController: AbortController | null = null;

  // 发起流式问答
  // messages：当前对话的消息历史（最后一条必须是用户问题）
  // sessionId：继续已有会话时传，新对话传 null
  async function streamChat(
    messages: ChatMessage[],
    sessionId: number | null,
    handlers: StreamHandlers
  ): Promise<void> {
    streaming.value = true;
    abortController = new AbortController();

    // 手动中止时走统一的结束逻辑
    const onAbort = () => {
      handlers.onError('已停止生成');
    };
    abortController.signal.addEventListener('abort', onAbort, {once: true});

    try {
      // 从 user store 取 token（fetch 不走 Axios 拦截器，手动带）
      const token = useUserStore().token;
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({messages, sessionId: sessionId ?? null}),
        signal: abortController.signal,
      });

      // 401 处理（对齐 request.ts 拦截器：清凭证跳登录）
      if (response.status === 401) {
        useUserStore().logout();
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
        throw new Error('登录已过期，请重新登录');
      }
      if (!response.ok || !response.body) {
        throw new Error('请求失败：' + response.status);
      }

      // 逐块读流
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      // 缓存没处理完的半条数据（网络分包可能把一条 SSE 切成两块）
      let buffer = '';

      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        // SSE 一条消息以空行（\n\n）结尾
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data:')) continue;
          const data = JSON.parse(line.slice(5).trim());
          if (data.type === 'status') {
            // 检索完成：更新等待提示（首 token 前的阶段反馈）
            handlers.onStatus(data.message);
          } else if (data.type === 'token') {
            handlers.onToken(data.content);
          } else if (data.type === 'references') {
            handlers.onReferences(data.references);
          } else if (data.type === 'session') {
            handlers.onSession(data.sessionId, data.historyId);
          } else if (data.type === 'done') {
            handlers.onDone();
          } else if (data.type === 'error') {
            throw new Error(data.message || '生成失败');
          }
        }
      }
    } catch (e) {
      // 手动中止的错误上面已经回调过了，不重复抛
      if (!abortController.signal.aborted) {
        handlers.onError(e instanceof Error ? e.message : '生成失败');
      }
    } finally {
      abortController.signal.removeEventListener('abort', onAbort);
      abortController = null;
      streaming.value = false;
    }
  }

  // 手动停止生成
  function stop(): void {
    abortController?.abort();
  }

  return {streaming, streamChat, stop};
}
