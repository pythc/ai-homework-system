<template>
  <TeacherLayout
    title="批改作业"
    subtitle="选择作业进入批改"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业批改"
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
      <div class="panel-title">作业列表</div>
      <div class="task-list">
        <div v-for="task in gradingList" :key="task.id" class="task-card">
          <div class="task-head">
            <div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-sub">{{ task.course }}</div>
            </div>
            <div class="task-deadline">{{ task.deadline }}</div>
          </div>
          <div class="task-progress">
            <div class="progress-meta">
              <span>{{ task.level }}</span>
            </div>
          </div>
          <button class="task-action" @click="goGrading(task.id)">开始批改</button>
        </div>
        <div v-if="!gradingList.length" class="task-empty">
          {{ gradingError || '暂无作业' }}
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listTeacherAssignments } from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const gradingItems = ref<any[]>([])
const gradingError = ref('')
const router = useRouter()

const formatDeadline = (deadline?: string | null) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  return `截止 ${date.toLocaleDateString('zh-CN')}`
}

const gradingList = computed(() =>
  gradingItems.value.map((item) => {
    const pendingCount = Number(item.pendingCount ?? 0)
    const graded = pendingCount === 0 && Number(item.submissionCount ?? 0) > 0
    return {
      id: item.id,
      title: item.title,
      course: item.courseName ?? item.courseId ?? '--',
      deadline: formatDeadline(item.deadline),
      level: graded
        ? `已批改 (${item.gradedCount ?? 0})`
        : pendingCount > 0
          ? `待批改 (${pendingCount})`
          : '暂无提交',
    }
  }),
)

const goGrading = (assignmentId: string) => {
  router.push(`/teacher/grading/${assignmentId}`)
}

onMounted(async () => {
  await refreshProfile()
  try {
    const response = await listTeacherAssignments()
    gradingItems.value = response?.items ?? []
  } catch (err) {
    gradingError.value = err instanceof Error ? err.message : '加载作业失败'
  }
})
</script>
