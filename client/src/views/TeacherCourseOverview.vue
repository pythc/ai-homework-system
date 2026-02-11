<template>
  <TeacherLayout
    title="课程概况"
    :subtitle="courseTitle"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="课程中心"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">工号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>课程信息</div>
        <button class="ghost-action" @click="goBack">返回课程</button>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">课程名称</div>
          <div class="summary-value">{{ summary.course?.name || '--' }}</div>
          <div class="summary-sub">{{ summary.course?.semester || '' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">学生人数</div>
          <div class="summary-value">{{ summary.studentCount }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">作业次数</div>
          <div class="summary-value">{{ summary.assignmentCount }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">课程状态</div>
          <div class="summary-value">{{ statusLabel }}</div>
        </div>
      </div>

      <div class="summary-actions">
        <button class="primary-btn" type="button" @click="goGradebook">
          查看成绩矩阵
        </button>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { getCourseSummary } from '../api/course'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const courseId = computed(() => String(route.params.courseId ?? ''))
const summary = ref<any>({ course: null, studentCount: 0, assignmentCount: 0 })

const courseTitle = computed(() => summary.value.course?.name || '课程概况')
const statusLabel = computed(() =>
  summary.value.course?.status === 'ACTIVE' ? '开放中' : '已归档',
)

const goBack = () => {
  router.push('/teacher/courses')
}

const goGradebook = () => {
  router.push(`/teacher/courses/${courseId.value}/gradebook`)
}

onMounted(async () => {
  await refreshProfile()
  if (!courseId.value) return
  summary.value = await getCourseSummary(courseId.value)
})
</script>

<style scoped>
.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ghost-action {
  border: none;
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
}

.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.summary-card {
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}

.summary-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}

.summary-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
}

.summary-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
