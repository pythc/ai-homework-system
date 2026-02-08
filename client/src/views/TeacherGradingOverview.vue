<template>
  <TeacherLayout
    title="批改作业"
    subtitle="先选择课程，再进入作业"
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
      <div class="panel-title">
        选择课程
        <span class="badge">{{ courseList.length }} 门</span>
      </div>
      <div class="course-list">
        <div v-for="course in courseList" :key="course.courseId" class="course-card">
          <div class="course-main">
            <div class="course-title">{{ course.name }}</div>
          </div>
          <button class="task-action" @click="goCourse(course.courseId)">进入课程</button>
        </div>
        <div v-if="!courseList.length" class="task-empty">
          {{ gradingError || '暂无课程' }}
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

const courseList = computed(() => {
  const map = new Map<string, {
    courseId: string
    name: string
    total: number
    pending: number
    graded: number
    empty: number
  }>()
  gradingItems.value.forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        name: item.courseName ?? item.courseId,
        total: 0,
        pending: 0,
        graded: 0,
        empty: 0,
      })
    }
    const course = map.get(courseId)!
    course.total += 1
    const pendingCount = Number(item.pendingCount ?? 0)
    const submissionCount = Number(item.submissionCount ?? 0)
    if (submissionCount === 0) course.empty += 1
    else if (pendingCount > 0) course.pending += 1
    else course.graded += 1
  })
  return Array.from(map.values())
})

const goCourse = (courseId: string) => {
  router.push(`/teacher/grading/course/${courseId}`)
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
.course-list {
  display: grid;
  gap: 14px;
}

.course-card {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 18px;
  padding: 16px;
  display: grid;
  gap: 10px;
}

.course-title {
  font-weight: 700;
  font-size: 15px;
}

</style>
