<template>
  <TeacherLayout
    title="课程成绩矩阵"
    :subtitle="courseTitle"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="课程中心"
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

    <section class="panel glass gradebook-panel">
      <div class="panel-title panel-title-row">
        <div>
          学生成绩
          <span class="badge">{{ students.length }} 人</span>
        </div>
        <button class="ghost-action" @click="goBack">返回课程</button>
      </div>

      <div v-if="!columns.length" class="empty-box">
        {{ loadError || '暂无作业或题目' }}
      </div>

      <div v-else class="gradebook-wrap">
        <table class="gradebook">
          <thead>
            <tr>
              <th class="sticky-col" rowspan="2">学生</th>
              <th
                v-for="assignment in assignmentsWithQuestions"
                :key="assignment.id"
                :colspan="assignment.questions.length"
              >
                {{ assignment.title }}
              </th>
            </tr>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                class="question-col"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.studentId">
              <td class="sticky-col">
                <div class="student-name">
                  {{ student.name || student.account || '学生' }}
                </div>
                <div class="student-sub">学号 {{ student.account || '-' }}</div>
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                class="score-cell"
                :class="cellClass(cellMap[student.studentId]?.[col.key])"
                @click="handleCellClick(student.studentId, col)"
              >
                <div class="score-value">
                  {{ formatScore(cellMap[student.studentId]?.[col.key]) }}
                </div>
                <div
                  v-if="cellMap[student.studentId]?.[col.key]?.source === 'AI'"
                  class="score-tag"
                >
                  AI
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { getCourseGradebook } from '../api/course'
import { useTeacherProfile } from '../composables/useTeacherProfile'

type GradeCell = {
  submissionVersionId: string
  assignmentId: string
  questionId: string
  score: number | null
  source: 'FINAL' | 'AI' | null
}

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const courseId = computed(() => String(route.params.courseId ?? ''))

const loadError = ref('')
const courseTitle = ref('课程成绩')
const students = ref<any[]>([])
const assignments = ref<any[]>([])
const cellMap = ref<Record<string, Record<string, GradeCell | undefined>>>({})

const assignmentsWithQuestions = computed(() =>
  assignments.value.filter((item) => item.questions && item.questions.length > 0),
)

const columns = computed(() => {
  const cols: Array<{ key: string; assignmentId: string; questionId: string; label: string }> = []
  assignmentsWithQuestions.value.forEach((assignment) => {
    assignment.questions.forEach((question: any) => {
      cols.push({
        key: `${assignment.id}:${question.questionId}`,
        assignmentId: assignment.id,
        questionId: question.questionId,
        label: `${assignment.order}.${question.questionIndex}`,
      })
    })
  })
  return cols
})

const formatScore = (cell?: GradeCell) => {
  if (!cell || cell.score === null || cell.score === undefined) return '-'
  return Number(cell.score).toFixed(1)
}

const cellClass = (cell?: GradeCell) => {
  if (!cell || cell.score === null || cell.score === undefined) return 'empty'
  return cell.source === 'FINAL' ? 'final' : 'ai'
}

const handleCellClick = (studentId: string, col: { key: string; assignmentId: string }) => {
  const cell = cellMap.value[studentId]?.[col.key]
  if (!cell?.submissionVersionId) return
  router.push(
    `/teacher/grading/${col.assignmentId}/submission/${cell.submissionVersionId}`,
  )
}

const goBack = () => {
  router.push(`/teacher/courses/${courseId.value}`)
}

const buildCellMap = (cells: any[]) => {
  const map: Record<string, Record<string, GradeCell | undefined>> = {}
  cells.forEach((cell: any) => {
    const score =
      cell.finalScore !== null && cell.finalScore !== undefined
        ? Number(cell.finalScore)
        : cell.aiScore !== null && cell.aiScore !== undefined
          ? Number(cell.aiScore)
          : null
    const source = cell.finalScore !== null && cell.finalScore !== undefined
      ? 'FINAL'
      : cell.aiScore !== null && cell.aiScore !== undefined
        ? 'AI'
        : null
    const key = `${cell.assignmentId}:${cell.questionId}`
    const studentId = cell.studentId
    if (!studentId) return
    if (!map[studentId]) {
      map[studentId] = {}
    }
    map[studentId][key] = {
      submissionVersionId: cell.submissionVersionId,
      assignmentId: cell.assignmentId,
      questionId: cell.questionId,
      score,
      source,
    }
  })
  return map
}

onMounted(async () => {
  await refreshProfile()
  if (!courseId.value) return
  try {
    const response = await getCourseGradebook(courseId.value)
    courseTitle.value = response.course?.name || '课程成绩'
    students.value = response.students ?? []
    assignments.value = response.assignments ?? []
    cellMap.value = buildCellMap(response.cells ?? [])
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载成绩失败'
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

.gradebook-wrap {
  overflow: scroll;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.6);
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  max-height: 65vh;
  min-width: 0;
  scrollbar-gutter: stable both-edges;
  padding-bottom: 6px;
}

.gradebook {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.gradebook th,
.gradebook td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(26, 29, 51, 0.08);
  text-align: center;
  font-size: 13px;
}

.gradebook th {
  background: rgba(255, 255, 255, 0.8);
  font-weight: 700;
  position: sticky;
  top: 0;
  z-index: 2;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: rgba(255, 255, 255, 0.95);
  z-index: 3;
  text-align: left;
  min-width: 160px;
}

.question-col {
  min-width: 90px;
}

.student-name {
  font-weight: 600;
}

.student-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.score-cell {
  cursor: pointer;
}

.score-cell.empty {
  color: rgba(26, 29, 51, 0.3);
  cursor: default;
}

.score-cell.ai {
  color: rgba(26, 29, 51, 0.7);
}

.score-cell.final {
  color: #1f3b8a;
  font-weight: 700;
}

.score-value {
  font-variant-numeric: tabular-nums;
}

.score-tag {
  font-size: 10px;
  margin-top: 4px;
  color: rgba(26, 29, 51, 0.5);
}

.gradebook-panel {
  min-width: 0;
  overflow: visible;
}
</style>
