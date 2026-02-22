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
        <div class="title-actions">
          <button class="ghost-action" @click="exportGradebook">导出成绩</button>
          <button class="ghost-action" @click="goBack">返回课程</button>
        </div>
      </div>

      <div v-if="!columns.length" class="empty-box">
        {{ loadError || '暂无作业' }}
      </div>

      <div v-else class="gradebook-wrap">
        <table class="gradebook">
          <thead>
            <tr>
              <th class="sticky-col">学生</th>
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
                  {{ displayStudentName(student) }}
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
  submissionVersionId: string | null
  assignmentId: string
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
  return assignmentsWithQuestions.value.map((assignment) => ({
    key: assignment.id,
    assignmentId: assignment.id,
    label: assignment.title,
  }))
})

const formatScore = (cell?: GradeCell) => {
  if (!cell || cell.score === null || cell.score === undefined) return '-'
  return Number(cell.score).toFixed(1)
}

const cellClass = (cell?: GradeCell) => {
  if (!cell || cell.score === null || cell.score === undefined) return 'empty'
  return cell.source === 'FINAL' ? 'final' : 'ai'
}

const displayStudentName = (student: any) => {
  const name = student?.name
  if (typeof name === 'string') {
    const trimmed = name.trim()
    if (trimmed && trimmed !== '[object Object]') return trimmed
  }
  if (name && typeof name === 'object') {
    const richText = Array.isArray(name.richText)
      ? name.richText
          .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
          .join('')
          .trim()
      : ''
    if (richText) return richText
    if (typeof name.text === 'string' && name.text.trim()) return name.text.trim()
    if (typeof name.name === 'string' && name.name.trim()) return name.name.trim()
  }
  return student?.account || '学生'
}

const handleCellClick = (studentId: string, col: { assignmentId: string }) => {
  const key = col.assignmentId
  const cell = cellMap.value[studentId]?.[key]
  if (cell?.score === null || cell?.score === undefined) return
  if (!cell?.submissionVersionId) return
  router.push(
    `/teacher/grading/${col.assignmentId}/submission/${cell.submissionVersionId}`,
  )
}

const goBack = () => {
  router.push(`/teacher/courses/${courseId.value}`)
}

const exportGradebook = () => {
  const headers = ['序号', '姓名', '学号', ...columns.value.map((col) => col.label)]
  const lines = [headers.join(',')]

  students.value.forEach((student, index) => {
    const name = String(displayStudentName(student) ?? '').split(',').join(' ')
    const account = String(student?.account ?? '').split(',').join(' ')
    const scoreColumns = columns.value.map((col) => {
      const cell = cellMap.value[student.studentId]?.[col.key]
      if (!cell || cell.score === null || cell.score === undefined || Number.isNaN(cell.score)) {
        return '-'
      }
      return Number(cell.score).toFixed(1)
    })
    lines.push([String(index + 1), name, account, ...scoreColumns].join(','))
  })

  if (students.value.length === 0) {
    lines.push('1,暂无数据,暂无数据')
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${courseTitle.value || '课程'}-成绩矩阵.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const buildCellMap = (cells: any[]) => {
  type AggregateCell = {
    assignmentId: string
    scoreSum: number
    hasScore: boolean
    hasAi: boolean
    submissionVersionId: string | null
    fallbackSubmissionVersionId: string | null
  }

  const aggregateMap: Record<string, Record<string, AggregateCell>> = {}

  cells.forEach((cell: any) => {
    const studentId = cell.studentId
    const assignmentId = cell.assignmentId
    if (!studentId || !assignmentId) return

    if (!aggregateMap[studentId]) {
      aggregateMap[studentId] = {}
    }
    if (!aggregateMap[studentId][assignmentId]) {
      aggregateMap[studentId][assignmentId] = {
        assignmentId,
        scoreSum: 0,
        hasScore: false,
        hasAi: false,
        submissionVersionId: null,
        fallbackSubmissionVersionId: null,
      }
    }

    const aggregate = aggregateMap[studentId][assignmentId]
    if (!aggregate.fallbackSubmissionVersionId && cell.submissionVersionId) {
      aggregate.fallbackSubmissionVersionId = cell.submissionVersionId
    }

    const hasFinal = cell.finalScore !== null && cell.finalScore !== undefined
    const hasAi = cell.aiScore !== null && cell.aiScore !== undefined
    const resolvedScore = hasFinal
      ? Number(cell.finalScore)
      : hasAi
        ? Number(cell.aiScore)
        : null

    if (resolvedScore !== null && Number.isFinite(resolvedScore)) {
      aggregate.scoreSum += resolvedScore
      aggregate.hasScore = true
      if (!aggregate.submissionVersionId && cell.submissionVersionId) {
        aggregate.submissionVersionId = cell.submissionVersionId
      }
    }
    if (hasAi) {
      aggregate.hasAi = true
    }
  })

  const map: Record<string, Record<string, GradeCell | undefined>> = {}
  Object.entries(aggregateMap).forEach(([studentId, assignmentMap]) => {
    const studentMap: Record<string, GradeCell | undefined> = {}
    map[studentId] = studentMap
    Object.entries(assignmentMap).forEach(([assignmentId, aggregate]) => {
      studentMap[assignmentId] = {
        submissionVersionId:
          aggregate.submissionVersionId ?? aggregate.fallbackSubmissionVersionId ?? null,
        assignmentId,
        score: aggregate.hasScore ? aggregate.scoreSum : null,
        source: aggregate.hasScore ? (aggregate.hasAi ? 'AI' : 'FINAL') : null,
      }
    })
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

.title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
