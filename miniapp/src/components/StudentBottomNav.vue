<template>
  <view class="dock-wrap">
    <view class="dock-shell ui-card fx-fade-up">
      <view class="dock-item" :class="{ active: active === 'assignments' }" @click="goAssignments">
        <image
          class="dock-icon-image"
          :src="active === 'assignments' ? '/static/icons/book-active.png' : '/static/icons/book-default.png'"
          mode="aspectFit"
        />
        <text class="dock-label">作业</text>
      </view>

      <view class="dock-spacer" />

      <view class="dock-item" :class="{ active: active === 'mine' }" @click="goMine">
        <image
          class="dock-icon-image"
          :src="
            active === 'mine'
              ? '/static/icons/address-book-active.png'
              : '/static/icons/address-book-default.png'
          "
          mode="aspectFit"
        />
        <text class="dock-label">我的</text>
      </view>
    </view>

    <view class="dock-ai" @click="goAssistant">
      <view class="dock-ai-core" :class="{ active: active === 'ai' }">
        <image class="dock-ai-image" src="/static/images/ai-tab.png" mode="aspectFill" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { replacePage } from '../utils/navigation'

defineProps({
  active: {
    type: String,
    default: 'mine',
  },
})

function goAssignments() {
  replacePage('/pages/student/assignments')
}

function goMine() {
  replacePage('/pages/student/courses')
}

function goAssistant() {
  replacePage('/pages/student/assistant')
}
</script>

<style scoped>
.dock-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  height: calc(132rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.dock-shell {
  pointer-events: auto;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(106rpx + env(safe-area-inset-bottom));
  border-radius: 0;
  padding: 4rpx 0 env(safe-area-inset-bottom);
  border: 0;
  box-shadow: 0 -4rpx 12rpx rgba(26, 36, 64, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dock-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rpx;
  padding-top: 2rpx;
  color: #69758f;
}

.dock-item.active {
  color: #2a58b7;
}

.dock-icon-image {
  width: 50rpx;
  height: 50rpx;
}

.dock-label {
  font-size: 19rpx;
  font-weight: 600;
  line-height: 1;
}

.dock-spacer {
  width: 156rpx;
  flex: 0 0 156rpx;
}

.dock-ai {
  pointer-events: auto;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(34rpx + env(safe-area-inset-bottom));
  width: 108rpx;
  height: 108rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  animation:
    appScaleIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) both,
    dockFloat 3.8s ease-in-out 0.7s infinite;
}

.dock-ai-core {
  width: 108rpx;
  height: 108rpx;
  border-radius: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dock-ai-core.active {
  transform: scale(1.04);
}

.dock-ai-image {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
}

@keyframes dockFloat {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-7rpx);
  }
}
</style>
