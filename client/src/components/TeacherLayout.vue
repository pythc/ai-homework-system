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
          to="/teacher/grading"
          class="nav-item"
          :class="{ active: isActive('/teacher/grading') }"
        >
          批改作业
        </RouterLink>
        <RouterLink
          to="/teacher/question-bank"
          class="nav-item"
          :class="{ active: isActive('/teacher/question-bank') }"
        >
          题库
        </RouterLink>
        <RouterLink
          to="/teacher/assignments/publish"
          class="nav-item"
          :class="{ active: isActive('/teacher/assignments/publish') }"
        >
          发布作业
        </RouterLink>
      </nav>
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
import { useRoute } from 'vue-router'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  profileName: { type: String, required: true },
  profileAccount: { type: String, required: true },
  brandSub: { type: String, default: '教学面板' },
})

const route = useRoute()
const isActive = (path, exact = false) => {
  if (exact) return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<style src="../styles/teacher-layout.css"></style>
