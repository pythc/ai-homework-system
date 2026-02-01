<template>
  <StudentLayout
    title="作业库"
    subtitle="显示所有课程作业（含已完成/已归档）"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业管理中心"
  >
    <section class="panel glass">
      <div class="panel-title">
        全部作业
        <span class="badge">{{ assignmentList.length }} 份</span>
      </div>
      <div class="task-list">
        <div v-for="task in assignmentList" :key="task.id" class="task-card">
          <div class="task-head">
            <div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-sub">{{ task.course }}</div>
            </div>
            <div class="task-deadline">{{ task.deadline }}</div>
          </div>
          <div class="task-progress">
            <div class="progress-meta">
              <span>{{ task.statusLabel }}</span>
            </div>
          </div>
          <button
            v-if="task.canSubmit"
            class="task-action"
            @click="goSubmit(task.id)"
          >
            提交作业
          </button>
        </div>
        <div v-if="!assignmentList.length" class="task-empty">
          {{ assignmentError || '暂无作业' }}
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { listAllAssignments } from '../api/assignment'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const assignmentItems = ref([])
const assignmentError = ref('')
const router = useRouter()

const formatDeadline = (deadline) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  return `截止 ${date.toLocaleDateString('zh-CN')}`
}

const statusLabel = (status) => {
  if (status === 'OPEN') return '状态：进行中'
  if (status === 'CLOSED') return '状态：已截止'
  if (status === 'ARCHIVED') return '状态：已归档'
  return `状态：${status ?? '未知'}`
}

const isExpired = (deadline) => {
  if (!deadline) return false
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() < Date.now()
}

const assignmentList = computed(() =>
  assignmentItems.value.map((item) => ({
    id: item.id,
    title: item.title,
    course: item.courseName ?? item.courseId,
    deadline: formatDeadline(item.deadline),
    statusLabel: statusLabel(item.status),
    canSubmit:
      Boolean(item.submitted) === false &&
      item.status === 'OPEN' &&
      !isExpired(item.deadline),
  })),
)

const goSubmit = (assignmentId) => {
  router.push(`/student/assignments/${assignmentId}/submit`)
}

onMounted(async () => {
  await refreshProfile()

  try {
    const response = await listAllAssignments()
    assignmentItems.value = response?.items ?? []
  } catch (err) {
    assignmentError.value = err instanceof Error ? err.message : '加载作业失败'
  }
})
</script>
