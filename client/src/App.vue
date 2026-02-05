<template>
  <div id="app">
    <!-- 全局背景容器 -->
    <div class="app-background">
      <!-- 路由出口：这里显示登录页 / 首页 / 管理页等 -->
      <router-view />
    </div>
  </div>
</template>

<script setup>
// 这里通常不需要逻辑
</script>

<style>
/* 全局样式初始化 */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
}

body {
  overflow-x: hidden;
}

/* 整个系统统一背景 */
.app-background {
  width: 100%;
  min-height: 100%;
  background: linear-gradient(
    135deg,
    #9fb7d4 0%,
    #b7cbe4 50%,
    #9fb7d4 100%
  );
  overflow: clip; 
}
</style>
