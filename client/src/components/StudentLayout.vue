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

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  profileName: { type: String, required: true },
  profileAccount: { type: String, required: true },
  brandSub: { type: String, default: '学习面板' },
})

const route = useRoute()
const isActive = (path) => route.path === path

</script>

<style src="../styles/student-layout.css"></style>
