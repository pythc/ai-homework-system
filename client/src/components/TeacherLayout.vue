<template>
  <div class="teacher-dashboard">
    <aside class="sidebar glass">
      <div class="brand">
        <div class="brand-icon">T</div>
        <div class="brand-text">
          <div class="brand-title">Teacher</div>
          <div class="brand-sub">{{ brandSub }}</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          to="/teacher"
          class="nav-item"
          :class="{ active: isActive('/teacher', true) }"
        >
          个人主页
        </RouterLink>
        <RouterLink
          to="/teacher/courses"
          class="nav-item"
          :class="{ active: isActive('/teacher/courses') }"
        >
          我的课程
        </RouterLink>
        <RouterLink
          to="/teacher/assignments/publish"
          class="nav-item"
          :class="{ active: isActive('/teacher/assignments/publish') }"
        >
          作业发布
        </RouterLink>
        <RouterLink
          to="/teacher/grading"
          class="nav-item"
          :class="{ active: isActive('/teacher/grading') }"
        >
          批改作业
        </RouterLink>
        <RouterLink
          to="/teacher/class-import"
          class="nav-item"
          :class="{ active: isActive('/teacher/class-import') }"
        >
          班级导入
        </RouterLink>
        <RouterLink
          to="/teacher/question-bank"
          class="nav-item"
          :class="{ active: isActive('/teacher/question-bank') }"
        >
          题库
        </RouterLink>
        <RouterLink
          to="/teacher/assistant"
          class="nav-item"
          :class="{ active: isActive('/teacher/assistant') }"
        >
          AI 助手
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" type="button" @click="handleLogout">登出</button>
        <div v-if="usage.limitTokens" class="token-usage">
          <div class="token-usage-title">本周模型用量</div>
          <div class="token-usage-bar">
            <div
              class="token-usage-progress"
              :style="{ width: `${usagePercent}%` }"
            />
          </div>
          <div class="token-usage-text">
            {{ usage.usedTokens }} / {{ usage.limitTokens }}
          </div>
        </div>
      </div>
    </aside>

    <main class="content">
      <header class="topbar glass">
        <div>
          <div class="welcome">{{ title }}</div>
          <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
        </div>
        <div class="top-actions">
          <slot name="actions">
            <div class="topbar-profile">
              <div class="topbar-avatar">{{ (profileName || 'T')[0] }}</div>
              <div>
                <div class="topbar-name">{{ profileName }}</div>
                <div class="topbar-id">工号 {{ profileAccount }}</div>
              </div>
            </div>
          </slot>
        </div>
      </header>

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchAssistantUsage } from '../api/assistant'
import { clearCurrentAuth } from '../auth/storage'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  profileName: { type: String, required: true },
  profileAccount: { type: String, required: true },
  brandSub: { type: String, default: '教学面板' },
})

defineSlots<{
  default?: () => any
  actions?: () => any
}>()

const route = useRoute()
const isActive = (path: string, exact = false) => {
  if (exact) return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}

const usage = ref({
  usedTokens: 0,
  limitTokens: 0,
  allowed: true,
})

const fetchUsage = async () => {
  try {
    const data = await fetchAssistantUsage()
    usage.value = data
  } catch (err) {
    // ignore
  }
}

const usagePercent = computed(() => {
  if (!usage.value.limitTokens) return 0
  return Math.min(100, Math.round((usage.value.usedTokens / usage.value.limitTokens) * 100))
})

const handleUsageRefresh = () => {
  fetchUsage()
}

onMounted(async () => {
  await fetchUsage()
  window.addEventListener('assistant-usage-refresh', handleUsageRefresh)
})

onBeforeUnmount(() => {
  window.removeEventListener('assistant-usage-refresh', handleUsageRefresh)
})

const handleLogout = () => {
  clearCurrentAuth()
  window.location.replace('/login')
}
</script>

<style src="../styles/teacher-layout.css"></style>
