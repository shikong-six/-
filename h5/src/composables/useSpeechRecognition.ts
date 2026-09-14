// 语音输入组合式函数：封装 Web Speech API（浏览器原生语音识别，免费离线调浏览器能力）
// 注意：TS 标准 DOM 库还没收编 SpeechRecognition（Chrome 需要 webkit 前缀），这里声明最小可用类型
import {onBeforeUnmount, ref} from 'vue';

// 只声明我们用到的成员，不做完整类型定义
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// 从 window 上取构造函数（标准名或 webkit 前缀名），不支持就返回 null
function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// 独立导出：当前浏览器是否支持语音识别（页面据此决定显隐语音按钮，不用创建实例）
export function isSpeechSupported(): boolean {
  return !!getRecognitionCtor();
}

// onFinal：识别出最终文本时回调（把文本交给调用方）
export function useSpeechRecognition(onFinal: (text: string) => void) {
  // 当前浏览器是否支持（不支持的隐藏语音按钮，静默降级）
  const supported = ref(!!getRecognitionCtor());
  // 是否正在收音
  const listening = ref(false);
  let recognition: SpeechRecognitionLike | null = null;

  function start(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening.value) return;
    recognition = new Ctor();
    recognition.lang = 'zh-CN';
    // 说一句停一句，拿到最终结果就结束（移动端短问句场景）
    recognition.continuous = false;
    recognition.interimResults = false;
    // 识别成功：取最终结果文本（results[0][0].transcript）
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? '';
      if (text.trim()) {
        onFinal(text.trim());
      }
    };
    // 识别出错（用户拒绝麦克风授权、网络错误等）：静默结束，不打扰用户
    recognition.onerror = () => {
      listening.value = false;
    };
    // 识别结束（含手动 stop 和自然结束）：复位状态
    recognition.onend = () => {
      listening.value = false;
    };
    recognition.start();
    listening.value = true;
  }

  function stop(): void {
    recognition?.stop();
    listening.value = false;
  }

  // 组件卸载时确保收音停止，避免游离对象占用麦克风
  onBeforeUnmount(() => {
    if (listening.value) recognition?.stop();
  });

  return {supported, listening, start, stop};
}
