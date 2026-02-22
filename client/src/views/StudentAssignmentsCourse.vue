<template>
  <StudentLayout
    title="作业库"
    :subtitle="courseTitle"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业管理中心"
  >
    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>
          课程作业
          <span class="badge">{{ assignmentList.length }} 份</span>
        </div>
        <button class="ghost-action" @click="goBack">返回课程</button>
      </div>
      <div class="task-list">
        <div v-for="task in assignmentList" :key="task.id" class="task-card">
          <div class="task-head">
            <div>
              <div
                class="task-title"
                v-mathjax
                v-html="renderTextHtml(task.title)"
              />
              <div class="task-sub">{{ task.course }}</div>
            </div>
            <div class="task-deadline">{{ task.deadline }}</div>
          </div>
          <div class="task-foot">
            <div class="task-progress">
              <div class="progress-meta">
                <span>{{ task.statusLabel }}</span>
              </div>
            </div>
            <button
              v-if="task.showAction"
              class="task-action"
              :disabled="task.actionDisabled"
              @click="handleTaskAction(task)"
            >
              {{ task.actionLabel }}
            </button>
          </div>
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
import { useRoute, useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { listAllAssignments } from '../api/assignment'
import { listMyScores } from '../api/score'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const assignmentItems = ref([])
const assignmentError = ref('')
const scoreItems = ref([])
const router = useRouter()
const route = useRoute()

const courseId = computed(() => String(route.params.courseId ?? ''))

const formatDeadline = (deadline) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `截止 ${year}/${month}/${day} ${hour}:${minute}`
}

const renderTextHtml = (text) => {
  if (!text) return ''
  return String(text).replace(/\n/g, '<br />')
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

const finalAssignmentIds = computed(() => {
  const ids = new Set()
  scoreItems.value.forEach((item) => {
    if (item.assignmentId) {
      ids.add(item.assignmentId)
    }
  })
  return ids
})

const assignmentList = computed(() =>
  assignmentItems.value
    .filter((item) => item.courseId === courseId.value)
    .map((item) => {
      const isFinal = finalAssignmentIds.value.has(item.id)
      const submitted = item.submitted === true
      const expired = isExpired(item.deadline)
      const canViewAfterSubmit = item.visibleAfterSubmit !== false
      const canSubmitNow = !submitted && item.status === 'OPEN' && !expired
      const showAction = submitted || canSubmitNow
      const actionLabel = submitted ? '查看/修改作业' : '提交作业'
      const actionDisabled = submitted ? !canViewAfterSubmit : false
      let statusText = isFinal ? '状态：已批改' : submitted ? '状态：已提交' : statusLabel(item.status)
      if (submitted && !canViewAfterSubmit) {
        statusText = '状态：已提交（教师设置不可见）'
      } else if (!submitted && expired) {
        statusText = '状态：已截止'
      }
      return {
        id: item.id,
        title: item.title,
        course: item.courseName ?? item.courseId,
        deadline: formatDeadline(item.deadline),
        statusLabel: statusText,
        showAction,
        actionLabel,
        actionDisabled,
      }
    }),
)

const courseTitle = computed(() => {
  const course = assignmentItems.value.find((item) => item.courseId === courseId.value)
  return course?.courseName ? `课程：${course.courseName}` : '课程作业'
})

const goSubmit = (assignmentId) => {
  router.push(`/student/assignments/${assignmentId}/submit`)
}

const handleTaskAction = (task) => {
  if (task.actionDisabled) return
  goSubmit(task.id)
}

const goBack = () => {
  router.push('/student/assignments')
}

onMounted(async () => {
  await refreshProfile()

  try {
    const response = await listAllAssignments()
    assignmentItems.value = response?.items ?? []
  } catch (err) {
    assignmentError.value = err instanceof Error ? err.message : '加载作业失败'
  }

  try {
    const response = await listMyScores()
    scoreItems.value = response?.items ?? []
  } catch {
    scoreItems.value = []
  }
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
  border: 1px solid rgba(173, 188, 216, 0.55);
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(56, 76, 126, 0.08);
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.ghost-action:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(125, 155, 214, 0.58);
  color: rgba(26, 29, 51, 0.86);
}

.task-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-foot .task-progress {
  min-width: 0;
  flex: 1;
}

.task-foot .task-action {
  justify-self: auto;
  margin-left: auto;
}

.task-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
