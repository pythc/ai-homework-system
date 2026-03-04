<template>
  <view class="fa-icon">
    <view v-if="iconType === 'image-polaroid'" class="shape-polaroid">
      <view class="shape-polaroid-dot" />
    </view>
    <view v-else-if="iconType === 'camera-alt'" class="shape-camera">
      <view class="shape-camera-lens" />
    </view>
    <text v-else class="shape-fallback">?</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: {
    type: [String, Array, Object],
    default: '',
  },
})

const iconType = computed(() => {
  if (Array.isArray(props.icon) && props.icon.length >= 2) {
    const name = String(props.icon[1] || '').trim()
    if (name === 'image' || name === 'image-polaroid') return 'image-polaroid'
    if (name === 'camera' || name === 'camera-alt') return 'camera-alt'
  }

  const key = String(props.icon || '').trim()
  if (key.includes('image-polaroid') || key.includes('fa-image') || key.includes(' image')) return 'image-polaroid'
  if (key.includes('camera-alt') || key.includes('fa-camera') || key.includes(' camera')) return 'camera-alt'
  return 'unknown'
})
</script>

<style scoped>
.fa-icon {
  width: 1em;
  height: 1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.shape-polaroid {
  width: 0.84em;
  height: 0.7em;
  border: 0.1em solid currentColor;
  border-radius: 0.12em;
  position: relative;
}

.shape-polaroid::after {
  content: '';
  position: absolute;
  left: 0.13em;
  right: 0.13em;
  bottom: 0.08em;
  height: 0.08em;
  background: currentColor;
  border-radius: 999em;
  opacity: 0.8;
}

.shape-polaroid-dot {
  position: absolute;
  right: 0.1em;
  top: 0.1em;
  width: 0.14em;
  height: 0.14em;
  border-radius: 50%;
  background: currentColor;
}

.shape-camera {
  width: 0.9em;
  height: 0.62em;
  border: 0.1em solid currentColor;
  border-radius: 0.12em;
  position: relative;
}

.shape-camera::before {
  content: '';
  position: absolute;
  left: 0.1em;
  top: -0.21em;
  width: 0.3em;
  height: 0.14em;
  border: 0.1em solid currentColor;
  border-bottom: 0;
  border-radius: 0.08em 0.08em 0 0;
}

.shape-camera-lens {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 0.3em;
  height: 0.3em;
  border: 0.09em solid currentColor;
  border-radius: 50%;
}

.shape-fallback {
  font-size: 0.8em;
  line-height: 1;
}
</style>
