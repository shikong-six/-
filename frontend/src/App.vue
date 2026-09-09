<!-- 整个应用的根组件 -->
<template>
  <!-- 直接渲染当前路由对应的页面（登录页或带布局的业务页面） -->
  <router-view/>
</template>

<script setup lang="ts">
</script>

<style>
/*全局样式:去掉浏览器默认的body边距*/
body{
  margin:0;
  padding:0;
  font-family:'Microsoft YaHei-serif'
}
</style>
