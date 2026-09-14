// 语音输入按钮：按住说话，松手结束，识别结果通过 final 事件抛给父组件
// 同时支持 touch（移动端）和 mouse（桌面端调试）；不支持的浏览器由父组件决定不渲染
<template>
  <button
    class="voice-btn"
    :class="{listening}"
    type="button"
    @touchstart.prevent="start"
    @touchend.prevent="stop"
    @touchcancel.prevent="stop"
    @mousedown.prevent="start"
    @mouseup.prevent="stop"
    @mouseleave="stop"
  >
    <van-icon :name="listening ? 'volume-o' : 'volume'" />
    <span>{{ listening ? '松开发送' : '按住说' }}</span>
  </button>
</template>

<script setup lang="ts">
import {useSpeechRecognition} from '@/composables/useSpeechRecognition';

// 识别出最终文本时抛给父组件
const emit = defineEmits<{final: [text: string]}>();

const {listening, start, stop} = useSpeechRecognition((text) => {
  emit('final', text);
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
  background: #4a6cf7;
  color: #fff;
}
</style>
