<template>
  <div class="student-dashboard">
    <aside class="sidebar glass">
      <div class="brand">
        <div class="brand-icon">S</div>
        <div class="brand-text">
          <div class="brand-title">Student</div>
          <div class="brand-sub">{{ brandSub }}</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          to="/student"
          class="nav-item"
          :class="{ active: isActive('/student') }"
        >
          个人主页
        </RouterLink>
        <RouterLink
          to="/student/assignments"
          class="nav-item"
          :class="{ active: isActive('/student/assignments') }"
        >
          作业库
        </RouterLink>
        <RouterLink
          to="/student/scores"
          class="nav-item"
          :class="{ active: isActive('/student/scores') }"
        >
          成绩看板
        </RouterLink>
        <RouterLink
          to="/student/assistant"
          class="nav-item"
          :class="{ active: isActive('/student/assistant') }"
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
          <slot name="actions" />
        </div>
      </header>

      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAssistantUsage } from '../api/assistant'
import { clearAuth } from '../auth/storage'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  profileName: { type: String, required: true },
  profileAccount: { type: String, required: true },
  brandSub: { type: String, default: '学习面板' },
})

const route = useRoute()
const router = useRouter()
const isActive = (path) => route.path === path

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
  clearAuth()
  sessionStorage.clear()
  localStorage.clear()
  window.location.replace('/login')
}
</script>

<style src="../styles/student-layout.css"></style>
