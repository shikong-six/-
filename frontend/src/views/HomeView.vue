<!--系统首页-->
<template>
  <div class="home">
    <!--大标题-->
    <h1>欢迎来到法制通</h1>
    <!--副标题，说明系统定位-->
    <p>基于kimi+RAG的法律智能问答系统</p>
    <!--点击按钮跳转到智能问答页面-->
    <el-button type="primary" @click="$router.push('/chat')">
        开始提问
    </el-button>
  </div>
</template>
<script setup lang="ts">
</script>

<style scoped>
/*首页内容居中*/
.home{
    text-align:center;
    padding-top:80px;
}
/*大标题样式*/
.home h1{
    font-size:32px;
    margin-bottom:16px;
}

/*副标题样式*/
.home p{
    color:#666;
    margin-bottom:32px;
}
</style>