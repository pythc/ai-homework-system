<template>
  <div
    ref="wrapRef"
    v-show="visible"
    class="assistant-float-wrap"
    :class="{ dragging: isDragging }"
    :style="floatStyle"
    @contextmenu.stop.prevent="onBlockContextMenu"
  >
    <div class="assistant-tip" :class="{ show: showTip }">{{ currentTip }}</div>
    <div class="assistant-quick-actions" :class="{ open: actionsOpen }">
      <button
        v-for="(item, index) in quickActions"
        :key="item.key"
        class="assistant-quick-action"
        :style="{ transitionDelay: actionsOpen ? `${index * 70}ms` : '0ms' }"
        type="button"
        @click.stop="onActionClick(item.path)"
      >
        {{ item.label }}
      </button>
    </div>
    <div
      class="assistant-float"
      aria-label="打开 AI 快捷操作"
      role="button"
      @mousedown.stop.prevent="onMouseDown"
      @touchstart.stop.prevent="onTouchStart"
      @click.stop="onBallClick"
    >
      <video
        ref="videoRef"
        class="assistant-float-video"
        src="/assistant-wave.mp4"
        muted
        playsinline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        @contextmenu.stop.prevent="onBlockContextMenu"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const FLOAT_SIZE = 112
const EDGE_MARGIN = 22
const PLAY_INTERVAL_MS = 15_000
const TIP_DURATION_MS = 3_800
const TIP_MESSAGES = [
  '有困难就找我~',
  '做题没思路？我来帮你~',
  '要不要我帮你理清思路？',
  '学习卡住了，点我就行~',
  '遇到问题随时喊我~',
  '我挡住按钮？拖动我试试~',
]

interface QuickAction {
  key: string
  label: string
  path: string
}

const isHomePath = (path: string) => path === '/student' || path === '/teacher'
const visible = computed(() => isHomePath(route.path))
const targetAssistantPath = computed(() =>
  route.path.startsWith('/teacher') ? '/teacher/assistant' : '/student/assistant',
)
const quickActions = computed<QuickAction[]>(() => {
  if (route.path.startsWith('/teacher')) {
    return [
      { key: 'teacher-grading', label: '去批改作业', path: '/teacher/grading' },
      { key: 'teacher-publish', label: '去发布作业', path: '/teacher/assignments/publish' },
      { key: 'teacher-other', label: '其他......', path: targetAssistantPath.value },
    ]
  }
  return [
    { key: 'student-assignments', label: '查看我的作业', path: '/student/assignments' },
    { key: 'student-unsubmitted', label: '我有没有未提交', path: '/student/assignments' },
    { key: 'student-other', label: '其他......', path: targetAssistantPath.value },
  ]
})

const wrapRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const showTip = ref(false)
const currentTip = ref(TIP_MESSAGES[0])
const actionsOpen = ref(false)
let playTimer: number | null = null
let tipTimer: number | null = null
let waveRetryTimer: number | null = null
let lastPlayAt = 0

const position = reactive({
  x: 0,
  y: 0,
  ready: false,
})

const dragState = reactive({
  active: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  moved: false,
})

const suppressClick = ref(false)
const isDragging = computed(() => dragState.active)

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const maxX = () => Math.max(0, window.innerWidth - FLOAT_SIZE)
const maxY = () => Math.max(0, window.innerHeight - FLOAT_SIZE)

const setDefaultPosition = () => {
  position.x = clamp(window.innerWidth - FLOAT_SIZE - EDGE_MARGIN, 0, maxX())
  position.y = clamp(window.innerHeight - FLOAT_SIZE - EDGE_MARGIN, 0, maxY())
  position.ready = true
}

const keepInViewport = () => {
  if (!position.ready) {
    setDefaultPosition()
    return
  }
  position.x = clamp(position.x, 0, maxX())
  position.y = clamp(position.y, 0, maxY())
}

const floatStyle = computed(() => ({
  width: `${FLOAT_SIZE}px`,
  height: `${FLOAT_SIZE}px`,
  left: `${position.x}px`,
  top: `${position.y}px`,
}))

const beginDrag = (clientX: number, clientY: number) => {
  dragState.active = true
  dragState.startX = clientX
  dragState.startY = clientY
  dragState.originX = position.x
  dragState.originY = position.y
  dragState.moved = false
}

const updateDrag = (clientX: number, clientY: number) => {
  if (!dragState.active) return
  const deltaX = clientX - dragState.startX
  const deltaY = clientY - dragState.startY
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    dragState.moved = true
    closeActions()
  }
  position.x = clamp(dragState.originX + deltaX, 0, maxX())
  position.y = clamp(dragState.originY + deltaY, 0, maxY())
}

const endDrag = () => {
  if (!dragState.active) return
  const moved = dragState.moved
  dragState.active = false
  if (moved) {
    suppressClick.value = true
  }
}

const onMouseMove = (event: MouseEvent) => {
  event.preventDefault()
  updateDrag(event.clientX, event.clientY)
}

const onMouseUp = () => {
  endDrag()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const onMouseDown = (event: MouseEvent) => {
  beginDrag(event.clientX, event.clientY)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  event.preventDefault()
  updateDrag(touch.clientX, touch.clientY)
}

const onTouchEnd = () => {
  endDrag()
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
}

const onTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  beginDrag(touch.clientX, touch.clientY)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchEnd)
}

const closeActions = () => {
  actionsOpen.value = false
}

const onBallClick = () => {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  if (!visible.value) return
  actionsOpen.value = !actionsOpen.value
}

const onActionClick = async (path: string) => {
  closeActions()
  if (!path || route.path === path) return
  await router.push(path)
}

const onWindowPointerDown = (event: MouseEvent | TouchEvent) => {
  if (!actionsOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (wrapRef.value?.contains(target)) return
  closeActions()
}

const onBlockContextMenu = (event: MouseEvent) => {
  event.preventDefault()
}

const onResize = () => {
  keepInViewport()
}

const clearTipTimer = () => {
  if (tipTimer !== null) {
    window.clearTimeout(tipTimer)
    tipTimer = null
  }
}

const clearWaveRetryTimer = () => {
  if (waveRetryTimer !== null) {
    window.clearTimeout(waveRetryTimer)
    waveRetryTimer = null
  }
}

const pickRandomTip = () => {
  const index = Math.floor(Math.random() * TIP_MESSAGES.length)
  currentTip.value = TIP_MESSAGES[index] || TIP_MESSAGES[0]
}

const triggerTip = () => {
  pickRandomTip()
  showTip.value = true
  clearTipTimer()
  tipTimer = window.setTimeout(() => {
    showTip.value = false
    tipTimer = null
  }, TIP_DURATION_MS)
}

const playOnce = async (force = false) => {
  if (!visible.value) return
  const now = Date.now()
  if (!force && now - lastPlayAt < 800) return
  lastPlayAt = now
  const video = videoRef.value
  if (!video) return
  try {
    video.muted = true
    video.defaultMuted = true
    video.volume = 0
    video.currentTime = 0
    await video.play()
    triggerTip()
  } catch {
    // ignore autoplay/interruption errors
  }
}

const triggerWaveNow = async (retry = 0) => {
  if (!visible.value) return
  await nextTick()
  const video = videoRef.value
  if (video) {
    await playOnce(true)
    return
  }
  if (retry >= 8) return
  clearWaveRetryTimer()
  waveRetryTimer = window.setTimeout(() => {
    waveRetryTimer = null
    void triggerWaveNow(retry + 1)
  }, 120)
}

const stopPlaySchedule = () => {
  if (playTimer !== null) {
    window.clearInterval(playTimer)
    playTimer = null
  }
  clearWaveRetryTimer()
  clearTipTimer()
  showTip.value = false
  const video = videoRef.value
  if (video) {
    try {
      video.pause()
      video.currentTime = 0
    } catch {
      // ignore
    }
  }
}

const startPlaySchedule = () => {
  stopPlaySchedule()
  void triggerWaveNow()
  playTimer = window.setInterval(() => {
    void playOnce()
  }, PLAY_INTERVAL_MS)
}

onMounted(() => {
  setDefaultPosition()
  window.addEventListener('resize', onResize)
  window.addEventListener('mousedown', onWindowPointerDown)
  window.addEventListener('touchstart', onWindowPointerDown)
  const video = videoRef.value
  if (video) {
    video.muted = true
    video.defaultMuted = true
    video.volume = 0
  }
  if (visible.value) {
    void triggerWaveNow()
  }
})

watch(
  visible,
  (nextVisible) => {
    if (nextVisible) {
      startPlaySchedule()
      return
    }
    closeActions()
    stopPlaySchedule()
  },
  { immediate: true },
)

watch(
  () => route.path,
  (nextPath, prevPath) => {
    if (!isHomePath(nextPath)) {
      closeActions()
      return
    }
    if (!isHomePath(prevPath) || nextPath !== prevPath) {
      void triggerWaveNow()
    }
  },
)

onUnmounted(() => {
  closeActions()
  stopPlaySchedule()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousedown', onWindowPointerDown)
  window.removeEventListener('touchstart', onWindowPointerDown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
})
</script>

<style scoped>
.assistant-float-wrap {
  position: fixed;
  z-index: 120;
  touch-action: none;
  user-select: none;
}

.assistant-float {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  cursor: grab;
  box-shadow:
    0 18px 30px rgba(35, 59, 96, 0.28),
    0 4px 10px rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: box-shadow 0.18s ease;
}

.assistant-float-wrap.dragging {
  cursor: grabbing;
}

.assistant-float-wrap.dragging .assistant-float {
  cursor: grabbing;
  box-shadow:
    0 24px 38px rgba(35, 59, 96, 0.36),
    0 6px 14px rgba(255, 255, 255, 0.42);
}

.assistant-float-video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 12%;
  transform: scale(1.2);
  transform-origin: center top;
}

.assistant-float-video::-webkit-media-controls-picture-in-picture-button {
  display: none !important;
}

.assistant-quick-actions {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.assistant-quick-action {
  width: 188px;
  min-height: 44px;
  border: 1px solid rgba(181, 201, 236, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  color: #1f3158;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
  text-align: left;
  padding: 11px 14px;
  box-shadow: 0 10px 20px rgba(40, 68, 115, 0.16);
  opacity: 0;
  transform: translateX(12px) scaleX(0.82);
  transform-origin: right center;
  transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1);
  cursor: pointer;
}

.assistant-quick-action:hover {
  background: rgba(244, 249, 255, 0.98);
  border-color: rgba(118, 160, 228, 0.9);
}

.assistant-quick-action:active {
  transform: translateX(1px) scale(0.98);
}

.assistant-quick-actions.open {
  pointer-events: auto;
}

.assistant-quick-actions.open .assistant-quick-action {
  opacity: 1;
  transform: translateX(0) scaleX(1);
}

.assistant-tip {
  position: absolute;
  right: 2px;
  bottom: calc(100% + 10px);
  max-width: 180px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(204, 218, 245, 0.9);
  color: #2e4a7f;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  box-shadow: 0 8px 18px rgba(42, 75, 130, 0.18);
  opacity: 0;
  transform: translateY(6px) scale(0.96);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
}

.assistant-tip::after {
  content: '';
  position: absolute;
  right: 16px;
  top: 100%;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.96);
  border-right: 1px solid rgba(204, 218, 245, 0.9);
  border-bottom: 1px solid rgba(204, 218, 245, 0.9);
  transform: rotate(45deg) translateY(-50%);
}

.assistant-tip.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
