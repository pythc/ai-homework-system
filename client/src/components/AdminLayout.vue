<template>
  <div class="admin-dashboard">
    <aside class="sidebar glass">
      <div class="brand">
        <div class="brand-icon">A</div>
        <div class="brand-text">
          <div class="brand-title">Admin</div>
          <div class="brand-sub">{{ brandSub }}</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          to="/admin"
          class="nav-item"
          :class="{ active: isActive('/admin') }"
        >
          个人主页
        </RouterLink>
        <RouterLink
          to="/admin/question-bank"
          class="nav-item"
          :class="{ active: isActive('/admin/question-bank') }"
        >
          上传题库
        </RouterLink>
        <RouterLink
          to="/admin/class-import"
          class="nav-item"
          :class="{ active: isActive('/admin/class-import') }"
        >
          班级导入
        </RouterLink>
        <RouterLink
          to="/admin/courses"
          class="nav-item"
          :class="{ active: isActive('/admin/courses') }"
        >
          课程管理
        </RouterLink>
        <RouterLink
          to="/admin/question-bank/courses"
          class="nav-item"
          :class="{ active: isActive('/admin/question-bank/courses') }"
        >
          查看题库
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" type="button" @click="handleLogout">登出</button>
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
import { useRoute, useRouter } from 'vue-router'
import { clearCurrentAuth } from '../auth/storage'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  profileName: { type: String, required: true },
  profileAccount: { type: String, required: true },
  brandSub: { type: String, default: '管理面板' },
})

const route = useRoute()
const router = useRouter()
const isActive = (path) => route.path === path

const handleLogout = () => {
  clearCurrentAuth()
  window.location.replace('/login')
}
</script>

<style src="../styles/admin-layout.css"></style>
