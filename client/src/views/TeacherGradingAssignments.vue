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
              <div class="progress-meta">
                <span>{{ task.level }}</span>
              </div>
              <!-- debug removed -->
            </div>
            <div class="task-actions">
              <button class="task-action" @click="goSubmissions(task.id)">查看提交</button>
              <button
                class="task-action ghost"
                type="button"
                :disabled="deletingIds.has(task.id)"
                @click="deleteTask(task.id, task.title)"
              >
                {{ deletingIds.has(task.id) ? '删除中...' : '删除作业' }}
              </button>
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
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const gradingItems = ref<any[]>([])
const gradingError = ref('')
const deletingIds = ref(new Set<string>())
const router = useRouter()
const route = useRoute()
const courseId = computed(() => String(route.params.courseId ?? ''))

const formatDeadline = (deadline?: string | null) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  return `截止 ${date.toLocaleDateString('zh-CN')}`
}

const gradingList = computed(() =>
  gradingItems.value
    .filter((item) => item.courseId === courseId.value)
    .map((item) => {
      const submittedStudentCount = Number(
        item.submittedStudentCount ?? item.submissionCount ?? 0,
      )
      const pendingCount = Number(
        item.pendingStudentCount ??
          Math.min(Number(item.pendingCount ?? 0), submittedStudentCount),
      )
      const gradedCount = Number(
        item.gradedStudentCount ?? item.gradedCount ?? 0,
      )
      const hasSubmissions = Number(
        submittedStudentCount,
      ) > 0
      const graded = pendingCount === 0 && hasSubmissions
      return {
        id: item.id,
        title: item.title,
        course: item.courseName ?? item.courseId ?? '--',
        deadline: formatDeadline(item.deadline),
        level: graded
          ? `已批改 ${gradedCount}`
          : pendingCount > 0
            ? `待批改 ${pendingCount}`
            : '暂无提交',
      }
    }),
)

const courseTitle = computed(() => {
  const course = gradingItems.value.find((item) => item.courseId === courseId.value)
  return course?.courseName ? `课程：${course.courseName}` : '课程作业'
})

const goSubmissions = (assignmentId: string) => {
  router.push({
    path: `/teacher/grading/${assignmentId}`,
    query: { courseId: courseId.value },
  })
}

const goBack = () => {
  router.push('/teacher/grading')
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
    const response = await listTeacherAssignments()
    gradingItems.value = response?.items ?? []
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
  border: none;
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
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
}

.task-action.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.7);
}

.task-card .task-progress {
  margin-bottom: 0;
}

</style>
