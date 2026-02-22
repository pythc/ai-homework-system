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
      <div class="course-grid">
        <div
          v-for="course in courseList"
          :key="course.courseId"
          class="course-card"
          @click="goCourse(course.courseId)"
        >
          <div class="course-main">
            <div class="course-title">{{ course.name }}</div>
            <div class="course-sub">
              <span>作业 {{ course.total }} 份</span>
              <span class="sub-split">·</span>
              <span class="status-inline active">进行中 {{ course.open }}</span>
              <span class="sub-split">·</span>
              <span class="status-inline warning">已截止 {{ course.closed }}</span>
              <span class="sub-split">·</span>
              <span class="status-inline archived">已归档 {{ course.archived }}</span>
            </div>
          </div>
          <div class="course-enter">
            <span>进入作业</span>
            <span class="course-arrow">→</span>
          </div>
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
.course-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.course-card {
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(169, 187, 218, 0.34);
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(24, 34, 64, 0.12);
}

.course-main {
  min-width: 0;
  flex: 1;
}

.course-title {
  font-weight: 700;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sub-split {
  color: rgba(26, 29, 51, 0.4);
}

.status-inline {
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.status-inline.active {
  color: #3b6fe1;
  background: rgba(107, 146, 236, 0.15);
}

.status-inline.warning {
  color: #de8a2b;
  background: rgba(222, 138, 43, 0.15);
}

.status-inline.archived {
  color: rgba(26, 29, 51, 0.64);
  background: rgba(130, 138, 160, 0.12);
}

.course-enter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(145, 166, 204, 0.34);
  background: rgba(255, 255, 255, 0.66);
  color: rgba(26, 29, 51, 0.66);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.course-arrow {
  font-size: 13px;
  transition: transform 0.2s ease;
}

.course-card:hover .course-enter {
  color: #2953b5;
  border-color: rgba(89, 122, 198, 0.45);
}

.course-card:hover .course-arrow {
  transform: translateX(2px);
}
</style>
