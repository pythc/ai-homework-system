<template>
  <StudentLayout
    title="作业库"
    subtitle="按课程查看作业"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业管理中心"
  >
    <section class="panel glass">
      <div class="panel-title">
        选择课程
        <span class="badge">{{ courseList.length }} 门</span>
      </div>
      <div class="course-list">
        <div v-for="course in courseList" :key="course.courseId" class="course-card">
          <div class="course-main">
            <div class="course-title">{{ course.name }}</div>
            <div class="course-sub">作业 {{ course.total }} 份</div>
          </div>
          <div class="course-meta">
            <span class="course-pill">进行中 {{ course.open }}</span>
            <span class="course-pill">已截止 {{ course.closed }}</span>
            <span class="course-pill">已归档 {{ course.archived }}</span>
          </div>
          <button class="task-action" @click="goCourse(course.courseId)">进入课程</button>
        </div>
        <div v-if="!courseList.length" class="task-empty">
          {{ assignmentError || '暂无课程' }}
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

const courseList = computed(() => {
  const map = new Map()
  assignmentItems.value.forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        name: item.courseName ?? item.courseId,
        total: 0,
        open: 0,
        closed: 0,
        archived: 0,
      })
    }
    const course = map.get(courseId)
    course.total += 1
    if (item.status === 'OPEN') course.open += 1
    else if (item.status === 'CLOSED') course.closed += 1
    else if (item.status === 'ARCHIVED') course.archived += 1
  })
  return Array.from(map.values())
})

const goCourse = (courseId) => {
  if (!courseId) return
  router.push(`/student/assignments/course/${courseId}`)
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

.course-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
}

.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.course-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.7);
}
</style>
