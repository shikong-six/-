// 语音输入组合式函数：封装 Web Speech API（浏览器原生语音识别，免费离线调浏览器能力）
// 注意：TS 标准 DOM 库还没收编 SpeechRecognition（Chrome 需要 webkit 前缀），这里声明最小可用类型
import {onBeforeUnmount, ref} from 'vue';

// 只声明我们用到的成员，不做完整类型定义
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  // 识别出错时浏览器会把原因放在 event.error（not-allowed / no-speech / network …），
  // 丢掉它就等于「用户点了麦克风却毫无反应」—— 看起来像功能坏了。
  onerror: ((event: {error?: string}) => void) | null;
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
export function useSpeechRecognition(
  onFinal: (text: string) => void,
  // onError 可选：调用方想给用户提示就传；不传则维持原来的静默行为
  onError?: (message: string) => void
) {
  // 当前浏览器是否支持（不支持的隐藏语音按钮，静默降级）
  const supported = ref(!!getRecognitionCtor());
  // 是否正在收音
  const listening = ref(false);
  let recognition: SpeechRecognitionLike | null = null;

  function start(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening.value) return;
    // ★ 安全上下文检查：Chrome 在「http:// + 非 localhost」的页面上会直接拒绝麦克风，
    //   只回一个 not-allowed，用户完全不知道为什么。
    //   手机连局域网 IP 调试（http://192.168.x.x:8081）正好命中这一条。
    const {protocol, hostname} = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (protocol !== 'https:' && !isLocalhost) {
      onError?.(`语音输入需要 HTTPS（当前是 ${protocol}//${hostname}），浏览器会拒绝麦克风`);
      return;
    }
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
    // 识别出错：按 event.error 分类给一句能看懂的话。
    // 原来这里是静默结束，实测后果是「用户拒绝麦克风授权后点按钮毫无反应」。
    recognition.onerror = (event) => {
      listening.value = false;
      const hints: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置里允许后重试',
        'service-not-allowed': '麦克风权限被拒绝，请在浏览器设置里允许后重试',
        'no-speech': '没有听到声音，请再按住说一次',
        'audio-capture': '没有找到麦克风设备',
        // Chrome 的语音识别把音频送到境外服务，国内网络通常连不上 → 会报 network。
        // 这不是用户网络坏了，所以说清楚，并给出可用的替代路径。
        network: '语音识别依赖浏览器自带服务（国内网络常不可用），建议改用键盘输入'
      };
      onError?.(hints[event?.error || ''] || '语音识别失败，可以改用键盘输入');
    };
    // 识别结束（含手动 stop 和自然结束）：复位状态
    recognition.onend = () => {
      listening.value = false;
    };
    // start() 可能同步抛（例如上一次还没结束就又启动 → InvalidStateError）。
    // 不接住的话异常会冒到模板事件上，而且 listening 会卡在「正在收音」。
    try {
      recognition.start();
    } catch {
      listening.value = false;
      onError?.('录音启动失败，请稍后再试');
      return;
    }
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
