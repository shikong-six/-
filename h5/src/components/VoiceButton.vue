// 语音输入按钮：按住说话，松手结束，识别结果通过 final 事件抛给父组件
// 同时支持 touch（移动端）和 mouse（桌面端调试）；不支持的浏览器由父组件决定不渲染
<template>
  <button
    class="voice-btn"
    :class="{listening}"
    type="button"
    aria-label="按住说话"
    @touchstart.prevent="onTouchStart"
    @touchend.prevent="onTouchEnd"
    @touchcancel.prevent="onTouchEnd"
    @mousedown.prevent="onMouseDown"
    @mouseup.prevent="onMouseUp"
    @mouseleave="onMouseUp"
  >
    <van-icon name="audio" />
    <span>{{ listening ? '松开发送' : '按住说' }}</span>
  </button>
</template>

<script setup lang="ts">
import {onBeforeUnmount} from 'vue';
import {showFailToast} from 'vant';
import {useSpeechRecognition} from '@/composables/useSpeechRecognition';

// 识别出最终文本时抛给父组件
const emit = defineEmits<{final: [text: string]}>();

// 第二个参数是识别失败时的提示。不传的话用户点了麦克风却毫无反应，
// 看起来像功能坏了 —— 尤其是「拒绝授权」和「没听到声音」这两种最常见的情况。
// 用 vant 的 toast：父组件 ChatView 已经在用它（showFailToast），样式必然是加载好的。
const {listening, start, stop} = useSpeechRecognition(
  (text) => {
    emit('final', text);
  },
  (message) => showFailToast(message)
);

let fromTouch = false;
// 触摸后 400ms 内忽略鼠标事件：移动端浏览器会补发一套 mouse 事件，
// 不挡的话一次按下会被当成两次（start/stop 各多跑一轮）。
// ★ 句柄必须留着：组件卸载时要清掉，否则定时器会一直持有已销毁组件的闭包。
let fromTouchTimer: ReturnType<typeof setTimeout> | null = null;

function onTouchStart() {
  fromTouch = true;
  start();
}

function onTouchEnd() {
  stop();
  if (fromTouchTimer) clearTimeout(fromTouchTimer);
  fromTouchTimer = setTimeout(() => {
    fromTouch = false;
    fromTouchTimer = null;
  }, 400);
}

function onMouseDown() {
  if (fromTouch) return;
  start();
}

function onMouseUp() {
  if (fromTouch) return;
  stop();
}

// 卸载时清掉自己的定时器（语音识别的清理由 composable 内部负责）
onBeforeUnmount(() => {
  if (fromTouchTimer) clearTimeout(fromTouchTimer);
});
</script>

<style scoped>
.voice-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 18px;
  background: #f2f3f5;
  color: #646566;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

/* 收音中高亮 */
.voice-btn.listening {
  background: var(--fz-primary, #0f9d8f);
  color: #fff;
}
</style>
