<template>
  <StudentLayout
    title="成绩看板"
    subtitle="按课程查看成绩"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
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
            <div class="course-sub">成绩 {{ course.total }} 条</div>
          </div>
          <div class="course-meta">
            <span class="course-pill">已评分 {{ course.total }}</span>
          </div>
          <button class="task-action" @click="goCourse(course.courseId)">查看成绩</button>
        </div>
        <div v-if="!courseList.length" class="task-empty">
          {{ scoreError || '暂无成绩' }}
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { listMyScores, type ScoreSummary } from '../api/score'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const scoreItems = ref<ScoreSummary[]>([])
const scoreError = ref('')
const router = useRouter()

const courseList = computed(() => {
  const map = new Map<string, { courseId: string; name: string; total: number }>()
  scoreItems.value.forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        name: item.courseName ?? item.courseId,
        total: 0,
      })
    }
    map.get(courseId)!.total += 1
  })
  return Array.from(map.values())
})

const goCourse = (courseId: string) => {
  if (!courseId) return
  router.push(`/student/scores/course/${courseId}`)
}

onMounted(async () => {
  await refreshProfile()

  try {
    const response = await listMyScores()
    scoreItems.value = response?.items ?? []
  } catch (err) {
    scoreError.value = err instanceof Error ? err.message : '加载成绩失败'
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
