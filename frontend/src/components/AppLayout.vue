<!--整个后台管理系统的布局组件：顶部栏 + 侧边栏（含知识库子菜单）+ 主内容区-->
<template>
    <!--el-container 是Element Plus的容器组件,class="layout"用于设置高度-->
    <el-container class="layout">
        <!--顶部栏：左侧系统名，右侧当前用户和退出按钮-->
        <el-header class="topbar">
            <!--系统名称-->
            <span class="topbar-brand">法制通 · 法律智能问答</span>
            <!--右侧用户区-->
            <div class="topbar-right">
                <span class="topbar-user">{{ username }}</span>
                <el-button link type="danger" @click="handleLogout">退出登录</el-button>
            </div>
        </el-header>
        <el-container>
        <!--左侧侧边栏，宽度固定220-->
        <el-aside width="220px" class="aside">
            <!--顶部Logo区域：渐变文字-->
            <div class="logo">法制通</div>
            <!--左侧导航菜单-->
            <!--router 属性表示点击菜单项会自动跳转对应路由-->
            <!--default-active表示当前高亮的菜单项，绑计算属性跟随路由变化-->
            <!--菜单背景透明，透出侧边栏渐变-->
            <el-menu :default-active="activeMenu"
                    router
                    class="side-menu"
                    background-color="transparent"
                    text-color="#bfcbd9"
                    active-text-color="#ffffff">
                <!--首页菜单-->
                <el-menu-item index="/">
                    <!--el-icon 是Element Plus的图标容器-->
                    <el-icon><HomeFilled /></el-icon>
                    <span>首页</span>
                </el-menu-item>

                <!--智能问答菜单（/chat 和 /chat/:id 都高亮它）-->
                <el-menu-item index="/chat">
                    <el-icon><ChatDotRound /></el-icon>
                    <span>智能问答</span>
                </el-menu-item>

                <!--知识库子菜单：对应嵌套子路由 /knowledge/list 和 /knowledge/search-->
                <!--index 是子菜单标识；default-active 命中子项时会自动展开-->
                <el-sub-menu index="/knowledge">
                    <!--子菜单标题-->
                    <template #title>
                        <el-icon><Document /></el-icon>
                        <span>知识库</span>
                    </template>
                    <!--文档列表子项-->
                    <el-menu-item index="/knowledge/list">
                        <el-icon><FolderOpened /></el-icon>
                        <span>文档管理</span>
                    </el-menu-item>
                    <!--检索测试子项-->
                    <el-menu-item index="/knowledge/search">
                        <el-icon><Search /></el-icon>
                        <span>检索测试</span>
                    </el-menu-item>
                </el-sub-menu>

                <!--会话历史菜单-->
                <el-menu-item index="/history">
                    <el-icon><Clock /></el-icon>
                    <span>会话历史</span>
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
//从图标中引入图标组件
import {HomeFilled, ChatDotRound, Document, FolderOpened, Search, Clock} from '@element-plus/icons-vue'
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
///chat/123 这类会话页高亮"智能问答"（/chat），其余用完整路径（子菜单子项需要完整路径才能命中）
const activeMenu=computed(()=>{
    //路径以 /chat 开头（含 /chat/:sessionId）→ 高亮智能问答
    if(route.path.startsWith('/chat')){
        return '/chat'
    }
    //其余直接用完整路径（/knowledge/list、/knowledge/search、/、/history 都能命中）
    return route.path
});
</script>
<style scoped>
/* 整个布局占满视口高度 */
.layout {
  height: 100vh;
}

/* 顶部栏：白底 + 底部阴影，左右分栏 */
.topbar {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

/* 顶部栏左侧系统名 */
.topbar-brand {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

/* 顶部栏右侧用户区 */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 顶部用户名 */
.topbar-user {
  color: #606266;
  font-size: 14px;
}

/* 侧边栏：深色渐变背景 */
.aside {
  background: linear-gradient(180deg, #1f2d3d 0%, #304156 100%);
}

/* 侧边栏菜单：去掉默认右边框，融入背景 */
.side-menu {
  border-right: none;
}

/* Logo 样式：渐变文字 */
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  /* 渐变文字：背景裁剪成文字形状 */
  background: linear-gradient(90deg, #409eff, #67c23a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* 主内容区背景色和内边距 */
.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
