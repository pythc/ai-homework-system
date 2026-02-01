<template>
  <StudentLayout
    title="成绩看板"
    subtitle="按作业维度展示最终成绩"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
  >
    <section class="panel glass">
      <div class="panel-title">
        作业成绩
        <span class="badge">{{ scoreList.length }} 条</span>
      </div>
      <div class="grade-list">
        <div v-for="score in scoreList" :key="score.scoreId" class="grade-item">
          <div class="grade-main">
            <div class="grade-head">
              <div class="grade-title">{{ score.title }}</div>
              <div class="grade-score-inline">{{ score.totalScore }}</div>
            </div>
            <div class="grade-sub">评分日期 {{ score.updatedAt }}</div>
          </div>
          <div class="grade-actions">
            <button class="grade-action" @click="viewDetail(score)">查看详情</button>
            <button class="grade-action ghost" @click="askAi(score)">询问AI</button>
          </div>
        </div>
        <div v-if="!scoreList.length" class="grade-empty">
          {{ scoreError || '暂无成绩' }}
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { listMyScores } from '../api/score'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const scoreItems = ref([])
const scoreError = ref('')
const router = useRouter()

const formatScoreDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN')
}

const scoreList = computed(() =>
  scoreItems.value.map((item) => ({
    scoreId: item.scoreId,
    title: item.assignmentTitle,
    totalScore: item.totalScore,
    updatedAt: formatScoreDate(item.updatedAt),
  })),
)

const viewDetail = (score) => {
  void score
  // TODO: 预留查看详情逻辑
}

const askAi = (score) => {
  void score
  router.push('/student/assistant')
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
