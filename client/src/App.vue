<template>
  <div id="app">
    <!-- 全局背景容器 -->
    <div class="app-background">
      <transition name="app-toast-fade">
        <div
          v-if="toastState"
          :key="toastState.id"
          class="app-toast"
          :class="`is-${toastState.type}`"
        >
          {{ toastState.message }}
        </div>
      </transition>
      <!-- 路由出口：这里显示登录页 / 首页 / 管理页等 -->
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useAppToast } from './composables/useAppToast'

const { toastState } = useAppToast()
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

.app-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 220px;
  max-width: min(640px, calc(100vw - 32px));
  padding: 11px 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
  border: 1px solid transparent;
  backdrop-filter: blur(6px);
}

.app-toast.is-success {
  color: #0f5132;
  background: linear-gradient(135deg, rgba(177, 243, 214, 0.97), rgba(205, 250, 227, 0.97));
  border-color: rgba(38, 166, 91, 0.32);
  box-shadow: 0 10px 24px rgba(26, 85, 59, 0.18);
}

.app-toast.is-error {
  color: #8f1f1f;
  background: linear-gradient(135deg, rgba(255, 219, 219, 0.97), rgba(255, 238, 238, 0.97));
  border-color: rgba(221, 76, 76, 0.34);
  box-shadow: 0 10px 24px rgba(128, 35, 35, 0.18);
}

.app-toast.is-info {
  color: #1c3f6f;
  background: linear-gradient(135deg, rgba(222, 239, 255, 0.97), rgba(236, 246, 255, 0.97));
  border-color: rgba(79, 137, 212, 0.32);
  box-shadow: 0 10px 24px rgba(47, 89, 153, 0.16);
}

.app-toast-fade-enter-active,
.app-toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.app-toast-fade-enter-from,
.app-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
