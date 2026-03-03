<template>
  <view class="dock-wrap">
    <view class="dock-shell ui-card">
      <view class="dock-item" :class="{ active: active === 'assignments' }" @click="goAssignments">
        <view class="dock-icon">作</view>
        <text class="dock-label">作业</text>
      </view>

      <view class="dock-spacer" />

      <view class="dock-item" :class="{ active: active === 'mine' }" @click="goMine">
        <view class="dock-icon">我</view>
        <text class="dock-label">我的</text>
      </view>
    </view>

    <view class="dock-ai" @click="goAssistant">
      <view class="dock-ai-core" :class="{ active: active === 'ai' }">
        <text class="dock-ai-text">AI</text>
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
  height: calc(136rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.dock-shell {
  pointer-events: auto;
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(12rpx + env(safe-area-inset-bottom));
  height: 102rpx;
  border-radius: 26rpx;
  padding: 0 36rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dock-item {
  width: 180rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: #69758f;
}

.dock-item.active {
  color: #2a58b7;
}

.dock-icon {
  width: 34rpx;
  height: 34rpx;
  border-radius: 10rpx;
  border: 2rpx solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1;
}

.dock-label {
  font-size: 26rpx;
  font-weight: 600;
}

.dock-spacer {
  width: 120rpx;
}

.dock-ai {
  pointer-events: auto;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  width: 124rpx;
  height: 124rpx;
  border-radius: 62rpx;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10rpx 24rpx rgba(37, 53, 89, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dock-ai-core {
  width: 104rpx;
  height: 104rpx;
  border-radius: 52rpx;
  background: linear-gradient(135deg, #ffb48a 0%, #ff6f67 52%, #ff8d7d 100%);
  box-shadow: inset 0 4rpx 16rpx rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dock-ai-core.active {
  transform: scale(1.04);
}

.dock-ai-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}
</style>
