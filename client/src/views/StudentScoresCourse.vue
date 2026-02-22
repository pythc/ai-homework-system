<template>
  <StudentLayout
    title="成绩看板"
    :subtitle="courseTitle"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
  >
    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>
          课程成绩
          <span class="badge">{{ scoreList.length }} 条</span>
        </div>
        <button class="ghost-action" @click="goBack">返回课程</button>
      </div>
      <div class="grade-list">
        <div v-for="score in scoreList" :key="score.scoreId" class="grade-item">
          <div class="grade-main">
            <div class="grade-head">
              <div class="grade-title">{{ score.title }}</div>
              <div class="grade-score-inline">{{ score.totalScoreLabel }}</div>
            </div>
            <div class="grade-sub">
              {{ score.subLabel }}
            </div>
          </div>
          <div class="grade-actions">
            <button
              class="grade-action"
              :disabled="!score.canView"
              @click="viewDetail(score)"
            >
              查看详情
            </button>
          </div>
        </div>
        <div v-if="!scoreList.length" class="grade-empty">
          {{ scoreError || '暂无成绩' }}
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { listMyScores, type ScoreSummary } from '../api/score'
import { listAllAssignments, type AssignmentSummary } from '../api/assignment'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const scoreItems = ref<ScoreSummary[]>([])
const assignmentItems = ref<AssignmentSummary[]>([])
const scoreError = ref('')
const router = useRouter()
const route = useRoute()

const courseId = computed(() => String(route.params.courseId ?? ''))

const formatScoreDate = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN')
}

const scoreList = computed(() =>
  (() => {
    const scoreMap = new Map(
      scoreItems.value
        .filter((item) => item.courseId === courseId.value)
        .map((item) => [item.assignmentId, item]),
    )
    const items = assignmentItems.value
      .filter((item) => item.courseId === courseId.value)
      .map((assignment) => {
        const score = scoreMap.get(assignment.id)
        if (!assignment.allowViewScore) {
          return {
            scoreId: score?.scoreId ?? `hidden:${assignment.id}`,
            assignmentId: assignment.id,
            title: assignment.title,
            totalScoreLabel: '不可见',
            subLabel: '状态：教师已设置成绩不可见',
            canView: false,
          }
        }
        if (score?.status === 'GRADED' && score.totalScore !== null) {
          return {
            scoreId: score.scoreId,
            assignmentId: assignment.id,
            title: assignment.title,
            totalScoreLabel: String(score.totalScore),
            subLabel: `评分日期 ${formatScoreDate(score.updatedAt)}`,
            canView: true,
          }
        }
        if (assignment.submitted) {
          return {
            scoreId: score?.scoreId ?? `pending:${assignment.id}`,
            assignmentId: assignment.id,
            title: assignment.title,
            totalScoreLabel: '待公布',
            subLabel: '状态：已提交，待教师发布',
            canView: false,
          }
        }
        return {
          scoreId: score?.scoreId ?? `unsubmitted:${assignment.id}`,
          assignmentId: assignment.id,
          title: assignment.title,
          totalScoreLabel: '未提交',
          subLabel: '状态：未提交',
          canView: false,
        }
      })

    const exists = new Set(items.map((item) => item.assignmentId))
    scoreItems.value
      .filter((item) => item.courseId === courseId.value && !exists.has(item.assignmentId))
      .forEach((item) => {
        items.push({
          scoreId: item.scoreId,
          assignmentId: item.assignmentId,
          title: item.assignmentTitle,
          totalScoreLabel:
            item.status === 'UNSUBMITTED' || item.totalScore === null
              ? '未提交'
              : String(item.totalScore),
          subLabel:
            item.status === 'UNSUBMITTED'
              ? '状态：未提交'
              : `评分日期 ${formatScoreDate(item.updatedAt)}`,
          canView: item.status === 'GRADED',
        })
      })
    return items
  })(),
)

const courseTitle = computed(() => {
  const course =
    assignmentItems.value.find((item) => item.courseId === courseId.value) ||
    scoreItems.value.find((item) => item.courseId === courseId.value)
  return course?.courseName ? `课程：${course.courseName}` : '课程成绩'
})

const viewDetail = (score: { assignmentId: string }) => {
  router.push(`/student/scores/${score.assignmentId}`)
}

const goBack = () => {
  router.push('/student/scores')
}

onMounted(async () => {
  await refreshProfile()

  try {
    const response = await listMyScores()
    scoreItems.value = response?.items ?? []
    const assignmentResponse = await listAllAssignments()
    assignmentItems.value = assignmentResponse?.items ?? []
  } catch (err) {
    scoreError.value = err instanceof Error ? err.message : '加载成绩失败'
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
  border: 1px solid rgba(173, 188, 216, 0.55);
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(56, 76, 126, 0.08);
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.ghost-action:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(125, 155, 214, 0.58);
  color: rgba(26, 29, 51, 0.86);
}

:deep(.grade-action:disabled) {
  opacity: 0.52;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
