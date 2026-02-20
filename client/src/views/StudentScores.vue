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
            <div class="course-sub">作业 {{ course.total }} 份</div>
          </div>
          <div class="course-foot">
            <div class="course-meta">
              <span class="course-pill">可见 {{ course.viewable }} 份</span>
            </div>
            <button class="task-action" @click="goCourse(course.courseId)">查看成绩</button>
          </div>
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
import { listAllAssignments, type AssignmentSummary } from '../api/assignment'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const scoreItems = ref<ScoreSummary[]>([])
const assignmentItems = ref<AssignmentSummary[]>([])
const scoreError = ref('')
const router = useRouter()

const courseList = computed(() => {
  const map = new Map<string, { courseId: string; name: string; total: number; viewable: number }>()
  const assignmentCourses = new Set<string>()
  assignmentItems.value.forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    assignmentCourses.add(courseId)
    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        name: item.courseName ?? courseId,
        total: 0,
        viewable: 0,
      })
    }
    const target = map.get(courseId)!
    target.total += 1
    if (item.allowViewScore !== false) {
      target.viewable += 1
    }
  })

  scoreItems.value.forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (assignmentCourses.has(courseId)) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        name: item.courseName ?? courseId,
        total: 0,
        viewable: 0,
      })
    }
    const target = map.get(courseId)!
    target.total += 1
    if (item.status === 'GRADED') {
      target.viewable += 1
    }
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
    const [scoreResponse, assignmentResponse] = await Promise.all([
      listMyScores(),
      listAllAssignments(),
    ])
    scoreItems.value = scoreResponse?.items ?? []
    assignmentItems.value = assignmentResponse?.items ?? []
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

.course-foot {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.course-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.7);
}
</style>
