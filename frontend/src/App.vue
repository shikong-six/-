<!-- 整个应用的根组件 -->
<template>
  <!-- 直接使用布局组件，整个页面由 AppLayout 控制 -->
  <AppLayout/>
</template>

<script setup lang="ts">
// 引入整体布局组件
import AppLayout from '@/components/AppLayout.vue';
</script>

<style>
/*全局样式:去掉浏览器默认的body边距*/
body{
  margin:0;
  padding:0;
  font-family:'Microsoft YaHei-serif'
}
</style>