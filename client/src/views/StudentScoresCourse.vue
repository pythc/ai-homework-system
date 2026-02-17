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
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const scoreItems = ref<ScoreSummary[]>([])
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
  scoreItems.value
    .filter((item) => item.courseId === courseId.value)
    .map((item) => ({
      scoreId: item.scoreId,
      assignmentId: item.assignmentId,
      title: item.assignmentTitle,
      totalScoreLabel:
        item.status === 'UNSUBMITTED' || item.totalScore === null
          ? '未提交'
          : item.totalScore,
      subLabel:
        item.status === 'UNSUBMITTED'
          ? '状态：未提交'
          : `评分日期 ${formatScoreDate(item.updatedAt)}`,
      canView: true,
    })),
)

const courseTitle = computed(() => {
  const course = scoreItems.value.find((item) => item.courseId === courseId.value)
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
  border: none;
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
}
</style>
