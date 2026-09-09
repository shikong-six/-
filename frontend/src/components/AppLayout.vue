<!--整个后台管理系统的布局组件-->
<template>
    <!--el-container 是Element Plus的容器组件,class="layout"用于设置高度-->
    <el-container class="layout">
        <!--顶部栏：显示当前用户和退出按钮-->
        <el-header class="topbar">
            <span class="topbar-user">当前用户：{{ username }}</span>
            <el-button link type="danger" @click="handleLogout">退出登录</el-button>
        </el-header>
        <el-container>
        <!--左侧侧边栏，宽度固定220-->
        <el-aside width="220px" class="aside">
            <!--顶部Logo区域-->
            <div class="logo">法制通</div>
            <!--左侧导航菜单-->
            <!--router 属性表示点击菜单项会自动跳转对应路由-->
            <!--default-active表示当前高亮的菜单项-->
            <el-menu :default-active="activeMenu"
 router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF">
      <!--首页菜单-->
      <el-menu-item index="/">
        <!--el-icon 是Element Plus的图标容器-->
        <el-icon><HomeFilled/></el-icon>
        <span>首页</span>
      </el-menu-item>

      <!--智能问答菜单-->
    <el-menu-item index="/chat">
        <el-icon><ChatDotRound/></el-icon>
        <span>智能问答</span>
    </el-menu-item>

    <!--知识库菜单-->
        <el-menu-item index="/knowledge">
            <el-icon><Document/></el-icon>
            <span>知识库</span>
        </el-menu-item>
    <!--对话历史菜单-->
    <el-menu-item index="/history">
      <el-icon><Clock/></el-icon>
      <span>对话历史</span>
    </el-menu-item>
    </el-menu>
</el-aside>
   <!--右侧主内容区-->
   <el-main class="main">
    <!--router-view是Vue Router提供的组件，用来显示当前路由对应的页面-->
    <router-view/>
   </el-main>
    </el-container>
    </el-container>
</template>

<script setup lang="ts">
//从vue中引入计算属性
import {computed} from 'vue'
//从vue-router中引入获取当前路由的钩子和跳转方法
import {useRoute, useRouter} from 'vue-router';
//从图标中引入四个图标组件
import {HomeFilled, ChatDotRound, Document,Clock} from '@element-plus/icons-vue'
//引入认证相关：显示用户名、退出登录
import {getUsername, logout} from '@/services/auth'

//获取当前激活的路由对象
const route=useRoute()
//路由跳转，退出登录后用
const router=useRouter()
//顶部显示当前登录用户名
const username=getUsername()

//退出登录：清掉本地凭证，回登录页（路由守卫会放行 /login）
const handleLogout=()=>{
    logout()
    router.push('/login')
}
//根据当前路径计算要高亮的菜单项
const activeMenu=computed(()=>route.path);
</script>
<style scoped>
/* 整个布局占满视口高度 */
.layout {
  height: 100vh;
}

/* 顶部栏：白底，右侧放用户信息 */
.topbar {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

/* 顶部用户名 */
.topbar-user {
  color: #606266;
  font-size: 14px;
}

/* 侧边栏背景色 */
.aside {
  background-color: #304156;
}

/* Logo 样式 */
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 1px solid #1f2d3d;
}

/* 主内容区背景色和内边距 */
.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>