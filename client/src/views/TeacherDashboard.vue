<template>
  <TeacherLayout
    title="个人主页"
    subtitle="批改进度一目了然"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
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

    <section class="overview">
      <div class="stat-card glass stat-card-wide" @click="goGradingOverview">
        <div class="stat-main">
          <div class="stat-label">待批改作业</div>
          <div class="stat-value">{{ ungradedTasks.length }}</div>
          <div class="stat-meta">全部作业 {{ gradingTotal }}</div>
        </div>
        <div class="stat-side">
          <div class="stat-side-item">
            <div class="stat-side-label">已批改</div>
            <div class="stat-side-value">{{ gradedTasks.length }}</div>
          </div>
          <div class="stat-side-item">
            <div class="stat-side-label">未批改</div>
            <div class="stat-side-value">{{ ungradedTasks.length }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel glass">
        <div class="panel-title">
          未批改作业
          <span class="badge">{{ ungradedTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in ungradedTasks" :key="task.id" class="task-card">
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
            <button class="task-action" @click="goGrading(task.id, task.courseId)">开始批改</button>
          </div>
          <div v-if="!ungradedTasks.length" class="task-empty">
            {{ gradingError || '暂无未批改作业' }}
          </div>
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-title">
          已批改作业
          <span class="badge">{{ gradedTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in gradedTasks" :key="task.id" class="task-card">
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
          </div>
          <div v-if="!gradedTasks.length" class="task-empty">
            {{ gradingError || '暂无已批改作业' }}
          </div>
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

const formatDeadline = (deadline: string | null | undefined) => {
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
      courseId: item.courseId,
      course: item.courseName ?? item.courseId ?? '--',
      deadline: formatDeadline(item.deadline),
      graded,
      pendingCount,
      submissionCount: Number(item.submissionCount ?? 0),
      level: graded
        ? `已批改 (${item.gradedCount ?? 0})`
        : pendingCount > 0
          ? `待批改 (${pendingCount})`
          : '暂无提交',
    }
  }),
)

const ungradedTasks = computed(() =>
  gradingList.value.filter(
    (task) => task.pendingCount > 0 || task.submissionCount === 0,
  ),
)
const gradedTasks = computed(() =>
  gradingList.value.filter((task) => task.pendingCount === 0 && task.submissionCount > 0),
)
const gradingTotal = computed(() => gradingList.value.length)

const goGrading = (assignmentId: string, courseId?: string) => {
  router.push({
    path: `/teacher/grading/${assignmentId}`,
    query: courseId ? { courseId } : undefined,
  })
}

const goGradingOverview = () => {
  router.push('/teacher/grading')
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
</style>
