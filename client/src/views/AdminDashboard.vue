<template>
  <AdminLayout
    title="个人主页"
    subtitle="管理员工作台概览"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="管理面板"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">账号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="overview">
      <div class="stat-card glass">
        <div class="stat-label">当前角色</div>
        <div class="stat-value">{{ roleLabel }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">今日状态</div>
        <div class="stat-value">准备就绪</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">题库管理</div>
        <div class="stat-value">已开启</div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">
        今日提醒
        <span class="badge">3 条</span>
      </div>
      <div class="hint-list">
        <div class="hint-item">请按课程维护题库目录结构。</div>
        <div class="hint-item">导入后可在“查看题库”中核对题目与答案。</div>
        <div class="hint-item">如需权限调整，请联系系统管理员。</div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'

const { storedUser, profileName, profileAccount, refreshProfile } =
  useAdminProfile()

const roleLabel = computed(() => {
  const role = storedUser.value?.role
  if (role === 'ADMIN') return '系统管理员'
  if (role === 'TEACHER') return '教师管理员'
  return role ?? '未知'
})

onMounted(async () => {
  await refreshProfile()
})
</script>
