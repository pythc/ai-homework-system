<template>
  <TeacherLayout
    title="批改作业"
    :subtitle="courseTitle"
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
      <div class="panel-title panel-title-row">
        <div>
          作业列表
          <span class="badge">{{ gradingList.length }} 份</span>
        </div>
        <button class="ghost-action" @click="goBack">返回课程</button>
      </div>
      <div class="task-list">
        <div v-for="task in gradingList" :key="task.id" class="task-card">
          <div class="task-head">
            <div>
              <div class="task-title">{{ task.title }}</div>
              <div class="task-sub">{{ task.course }}</div>
            </div>
            <div class="task-deadline">{{ task.deadline }}</div>
          </div>
          <div class="task-foot">
            <div class="task-progress">
              <div class="progress-meta progress-meta-inline progress-summary">
                <span class="summary-item pending">待确认 {{ task.pendingCount }} 份</span>
                <span class="summary-divider">·</span>
                <span class="summary-item graded">已批改 {{ task.gradedCount }} 份</span>
                <span class="summary-divider">·</span>
                <span class="summary-item unsubmitted">未提交 {{ task.unsubmittedCount }} 份</span>
                <span class="summary-divider">·</span>
                <span class="summary-item ai-success">AI批改成功 {{ task.aiSuccessCount }} 份</span>
              </div>
              <div v-if="retryMessages[task.id]" class="task-hint">{{ retryMessages[task.id] }}</div>
            </div>
            <div class="task-actions">
              <button class="task-action ghost" type="button" @click="openConfig(task.id)">
                详情/修改
              </button>
              <button
                class="task-action ghost"
                type="button"
                :disabled="retryingIds.has(task.id) || task.aiFailedCount <= 0"
                @click="retryFailedAi(task.id)"
              >
                {{
                  retryingIds.has(task.id)
                    ? '重试中...'
                    : `重试AI批改失败任务（${task.aiFailedCount}）`
                }}
              </button>
              <button
                class="task-action ghost"
                type="button"
                :disabled="deletingIds.has(task.id)"
                @click="deleteTask(task.id, task.title)"
              >
                {{ deletingIds.has(task.id) ? '删除中...' : '删除作业' }}
              </button>
              <button class="task-action" @click="goSubmissions(task.id)">查看提交</button>
            </div>
          </div>
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
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { deleteAssignment, listTeacherAssignments } from '../api/assignment'
import { runAiGrading } from '../api/aiGrading'
import { listSubmissionsByAssignment } from '../api/teacherGrading'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const gradingItems = ref<any[]>([])
const gradingError = ref('')
const deletingIds = ref(new Set<string>())
const retryingIds = ref(new Set<string>())
const retryMessages = ref<Record<string, string>>({})
const router = useRouter()
const route = useRoute()
const courseId = computed(() => String(route.params.courseId ?? ''))

const formatDeadline = (deadline?: string | null) => {
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

const gradingList = computed(() =>
  gradingItems.value
    .filter((item) => item.courseId === courseId.value)
    .map((item) => {
      const gradedCount = Number(item.gradedStudentCount ?? item.gradedCount ?? 0)
      const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0
      return {
        id: item.id,
        title: item.title,
        course: item.courseName ?? item.courseId ?? '--',
        deadline: formatDeadline(item.deadline),
        createdAt,
        gradedCount,
        pendingCount: Number(item.pendingStudentCount ?? item.pendingCount ?? 0),
        unsubmittedCount: Number(item.unsubmittedCount ?? 0),
        aiSuccessCount: Number(item.aiSuccessCount ?? 0),
        aiFailedCount: Number(item.aiFailedCount ?? 0),
        submissionCount: Number(item.submissionCount ?? 0),
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt),
)

const courseTitle = computed(() => {
  const course = gradingItems.value.find((item) => item.courseId === courseId.value)
  return course?.courseName ? `课程：${course.courseName}` : '课程作业'
})

const refreshAssignments = async () => {
  const response = await listTeacherAssignments()
  gradingItems.value = response?.items ?? []
}

const goSubmissions = (assignmentId: string) => {
  router.push({
    path: `/teacher/grading/${assignmentId}`,
    query: { courseId: courseId.value },
  })
}

const goBack = () => {
  router.push('/teacher/grading')
}

const openConfig = (assignmentId: string) => {
  router.push({
    path: `/teacher/grading/${assignmentId}/config`,
    query: { courseId: courseId.value },
  })
}

const retryFailedAi = async (assignmentId: string) => {
  const next = new Set(retryingIds.value)
  next.add(assignmentId)
  retryingIds.value = next
  retryMessages.value[assignmentId] = ''
  try {
    const response = await listSubmissionsByAssignment(assignmentId)
    const failed = (response?.items ?? []).filter((item) => item.aiStatus === 'FAILED')
    if (!failed.length) {
      retryMessages.value[assignmentId] = '没有失败的 AI 批改任务'
      return
    }
    const results = await Promise.allSettled(
      failed.map((item) =>
        runAiGrading(item.submissionVersionId, { snapshotPolicy: 'LATEST_PUBLISHED' }),
      ),
    )
    const success = results.filter((item) => item.status === 'fulfilled').length
    const failedCount = results.length - success
    retryMessages.value[assignmentId] =
      failedCount > 0
        ? `已重试 ${success} 条，失败 ${failedCount} 条`
        : `已重试 ${success} 条失败任务`
    await refreshAssignments()
  } catch (err) {
    retryMessages.value[assignmentId] = err instanceof Error ? err.message : '重试失败'
  } finally {
    const updated = new Set(retryingIds.value)
    updated.delete(assignmentId)
    retryingIds.value = updated
  }
}

const deleteTask = async (assignmentId: string, title?: string) => {
  const name = title ? `“${title}”` : '该作业'
  if (!window.confirm(`确认删除${name}？删除后将清除该作业相关数据，且无法恢复。`)) {
    return
  }
  const next = new Set(deletingIds.value)
  next.add(assignmentId)
  deletingIds.value = next
  try {
    await deleteAssignment(assignmentId)
    gradingItems.value = gradingItems.value.filter((item) => item.id !== assignmentId)
  } catch (err) {
    gradingError.value = err instanceof Error ? err.message : '删除作业失败'
  } finally {
    const updated = new Set(deletingIds.value)
    updated.delete(assignmentId)
    deletingIds.value = updated
  }
}

onMounted(async () => {
  await refreshProfile()
  try {
    await refreshAssignments()
  } catch (err) {
    gradingError.value = err instanceof Error ? err.message : '加载作业失败'
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
}

.task-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-action.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.7);
  border: 1px solid rgba(173, 188, 216, 0.55);
  box-shadow: 0 4px 10px rgba(56, 76, 126, 0.08);
}

.task-card .task-progress {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-meta-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.progress-summary {
  font-size: 11px;
  font-weight: 700;
}

.summary-item {
  display: inline-flex;
  align-items: center;
}

.summary-item.pending {
  color: #de8a2b;
}

.summary-item.graded {
  color: #3b6fe1;
}

.summary-item.unsubmitted {
  color: #7f879b;
}

.summary-item.ai-success {
  color: #2f9a67;
}

.summary-divider {
  color: rgba(26, 29, 51, 0.35);
  font-weight: 600;
}

.task-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
}
</style>
