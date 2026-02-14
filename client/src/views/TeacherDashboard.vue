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
      <div class="panel glass">
        <div class="panel-title panel-title-row">
          <div>我的课程</div>
          <button class="ghost-action" @click="goCourses">查看全部</button>
        </div>
        <div class="course-list">
          <button
            v-for="course in courseGroups"
            :key="course.courseId"
            class="course-chip"
            type="button"
            @click="goCourse(course.courseId)"
          >
            <span class="course-name">{{ course.courseName || '课程' }}</span>
            <span class="course-meta">{{ course.assignments.length }} 次作业</span>
          </button>
          <div v-if="!courseGroups.length" class="task-empty">
            {{ gradingError || '暂无课程' }}
          </div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div v-for="course in courseGroups" :key="course.courseId" class="panel glass">
        <div class="panel-title">
          {{ course.courseName || '课程' }}
          <span class="badge">{{ course.assignments.length }} 次作业</span>
        </div>
        <div class="task-list">
          <div v-for="task in course.assignments" :key="task.id" class="task-card">
            <div class="task-head">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-deadline">{{ task.deadline }}</div>
            </div>
            <div class="task-foot">
              <div class="task-metrics">
                <span class="metric-tag">待批改 {{ task.pendingCount }}</span>
                <span class="metric-tag">未提交 {{ task.unsubmittedCount }}</span>
              </div>
              <button class="task-action" @click="goGrading(task.id, task.courseId)">
                开始批改
              </button>
            </div>
          </div>
          <div v-if="!course.assignments.length" class="task-empty">
            {{ gradingError || '暂无作业' }}
          </div>
        </div>
      </div>
      <div v-if="!courseGroups.length" class="panel glass task-empty">
        {{ gradingError || '暂无课程' }}
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
    const submittedStudentCount = Number(
      item.submittedStudentCount ?? item.submissionCount ?? 0,
    )
    const pendingCount = Number(
      item.pendingStudentCount ??
        Math.min(Number(item.pendingCount ?? 0), submittedStudentCount),
    )
    const unsubmittedCount = Number(item.unsubmittedCount ?? 0)
    return {
      id: item.id,
      title: item.title,
      courseId: item.courseId,
      course: item.courseName ?? item.courseId ?? '--',
      courseName: item.courseName ?? '',
      deadline: formatDeadline(item.deadline),
      pendingCount,
      unsubmittedCount,
    }
  }),
)

const courseGroups = computed(() => {
  const map = new Map<
    string,
    { courseId: string; courseName: string; assignments: any[] }
  >()
  gradingList.value.forEach((item) => {
    if (!map.has(item.courseId)) {
      map.set(item.courseId, {
        courseId: item.courseId,
        courseName: item.courseName || item.course,
        assignments: [],
      })
    }
    if (item.pendingCount === 0 && item.unsubmittedCount === 0) {
      return
    }
    map.get(item.courseId)?.assignments.push(item)
  })
  return Array.from(map.values())
})

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

const goCourses = () => {
  router.push('/teacher/courses')
}

const goCourse = (courseId: string) => {
  router.push(`/teacher/courses/${courseId}`)
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
.task-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

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

.course-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.course-chip {
  border: none;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 160px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.course-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(24, 34, 64, 0.12);
}

.course-name {
  font-weight: 600;
}

.course-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.task-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.metric-tag {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
}
</style>
