<template>
  <StudentLayout
    title="成绩详情"
    subtitle="最终成绩与评分明细"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
  >
    <section class="panel glass">
      <div class="panel-title">作业信息</div>
      <div class="detail-row">
        <div class="detail-label">作业</div>
        <div class="detail-value">{{ result?.assignmentTitle || '—' }}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">课程</div>
        <div class="detail-value">{{ result?.courseName || result?.courseId || '—' }}</div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">最终成绩</div>
      <div v-if="loading" class="grade-empty">加载中...</div>
      <div v-else-if="error" class="grade-empty">{{ error }}</div>
      <div v-else class="detail-body">
        <div class="detail-row">
          <div class="detail-label">总分</div>
          <div class="detail-value">{{ result?.weightedScore ?? '-' }} / {{ result?.totalScore ?? '-' }}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">题目明细</div>
          <div v-if="!result?.questions?.length" class="empty-box">暂无明细</div>
          <div v-else class="detail-layout">
            <aside class="question-sidebar">
              <div class="sidebar-title">题号</div>
              <button
                v-for="(question, index) in sortedQuestions"
                :key="question.questionId || index"
                class="sidebar-item"
                :class="{ active: index === currentIndex }"
                @click="goQuestion(index)"
              >
                {{ question.questionIndex }}
              </button>
            </aside>

            <div class="detail-panel">
              <div v-if="currentQuestion" class="detail-item">
                <div class="detail-item-title">
                  第 {{ currentQuestion.questionIndex }} 题（权重 {{ currentQuestion.weight }}%）
                </div>
                <div class="detail-item-meta">
                  得分 {{ currentQuestion.score ?? '-' }} / {{ currentQuestion.maxScore ?? '-' }}
                </div>
                <div
                  v-if="currentQuestion.promptText"
                  class="detail-text"
                  v-mathjax
                  v-html="renderMath(currentQuestion.promptText)"
                />
                <div
                  v-if="currentQuestion.standardAnswerText"
                  class="detail-answer"
                >
                  <div class="detail-sub-title">参考答案</div>
                  <div class="detail-text" v-mathjax v-html="renderMath(currentQuestion.standardAnswerText)" />
                </div>

                <div class="detail-submission">
                  <div class="detail-sub-title">我的提交</div>
                  <div v-if="submittedMap[currentQuestion.questionId]?.contentText" class="detail-text">
                    {{ submittedMap[currentQuestion.questionId]?.contentText }}
                  </div>
                  <div
                    v-if="submittedMap[currentQuestion.questionId]?.fileUrls?.length"
                    class="detail-media"
                  >
                    <img
                      v-for="(img, index) in submittedMap[currentQuestion.questionId]?.fileUrls ?? []"
                      :key="index"
                      :src="resolveFileUrl(img)"
                      alt="submission image"
                    />
                  </div>
                </div>

                <div v-if="showAiDetail && currentQuestion.items?.length" class="detail-sub">
                  <div v-for="(sub, subIdx) in currentQuestion.items" :key="subIdx" class="detail-sub-item">
                    <div>评分项 {{ sub.rubricItemKey || '-' }}</div>
                    <div>得分 {{ sub.score ?? '-' }}</div>
                    <div v-if="sub.reason" class="detail-text" v-mathjax v-html="renderMath(sub.reason)" />
                  </div>
                </div>
                <div v-if="currentQuestion.finalComment" class="detail-text" v-mathjax v-html="renderMath(currentQuestion.finalComment)" />
              </div>

              <div v-if="sortedQuestions.length > 1" class="question-nav">
                <button class="nav-btn" :disabled="currentIndex === 0" @click="prevQuestion">
                  上一题
                </button>
                <div class="nav-info">
                  {{ currentIndex + 1 }} / {{ sortedQuestions.length }}
                </div>
                <button
                  class="nav-btn"
                  :disabled="currentIndex === sortedQuestions.length - 1"
                  @click="nextQuestion"
                >
                  下一题
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { useStudentProfile } from '../composables/useStudentProfile'
import { getAssignmentScoreDetail } from '../api/score'
import { listLatestSubmissions } from '../api/submission'
import { API_BASE_URL } from '../api/http'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const result = ref<any | null>(null)
const currentIndex = ref(0)
const submittedMap = ref<Record<string, { contentText?: string; fileUrls?: string[] }>>({})

type ScoreDetailQuestion = {
  questionId: string
  questionIndex: number
  promptText?: string | null
  standardAnswerText?: string | null
  weight: number
  maxScore: number
  score: number | null
  source?: 'AI_ADOPTED' | 'AI' | 'MANUAL' | null | string
  items?: Array<{ rubricItemKey?: string; score?: number; reason?: string }>
  finalComment?: string | null
}

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const sortedQuestions = computed(() => {
  const questions = (result.value?.questions ?? []) as ScoreDetailQuestion[]
  return [...questions].sort((a, b) => a.questionIndex - b.questionIndex)
})
const currentQuestion = computed(() => {
  if (!sortedQuestions.value.length) return null
  return sortedQuestions.value[
    Math.max(0, Math.min(currentIndex.value, sortedQuestions.value.length - 1))
  ]
})
const showAiDetail = computed(() => currentQuestion.value?.source === 'AI_ADOPTED')
const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const renderMath = (text?: string | null) => {
  if (!text) return '—'
  return text.replace(/\n/g, '<br />')
}

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const goQuestion = (index: number) => {
  currentIndex.value = index
}

const prevQuestion = () => {
  if (currentIndex.value > 0) currentIndex.value -= 1
}

const nextQuestion = () => {
  const total = sortedQuestions.value.length
  if (currentIndex.value < total - 1) currentIndex.value += 1
}

onMounted(async () => {
  await refreshProfile()
  if (!assignmentId.value) {
    error.value = '缺少提交信息'
    loading.value = false
    return
  }
  try {
    result.value = await getAssignmentScoreDetail(assignmentId.value)
    currentIndex.value = 0
    const latest = await listLatestSubmissions(assignmentId.value)
    const map: Record<string, { contentText?: string; fileUrls?: string[] }> = {}
    latest?.items?.forEach((item) => {
      if (!item?.questionId) return
      const key = String(item.questionId)
      map[key] = {
        contentText: item.contentText,
        fileUrls: item.fileUrls,
      }
    })
    submittedMap.value = map
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-body {
  display: grid;
  gap: 16px;
}

.detail-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
}

.detail-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.detail-value {
  font-weight: 600;
}

.detail-block {
  display: grid;
  gap: 8px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
  align-items: start;
}

.question-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.sidebar-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.sidebar-item {
  border: none;
  background: rgba(255, 255, 255, 0.7);
  color: #1a1d33;
  font-weight: 600;
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.95);
}

.sidebar-item.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.9), rgba(120, 200, 230, 0.9));
  color: #ffffff;
  box-shadow: 0 14px 20px rgba(60, 120, 210, 0.25);
}

.detail-panel {
  display: grid;
  gap: 12px;
}

.detail-text {
  white-space: pre-wrap;
  font-size: 13px;
}

.detail-sub {
  display: grid;
  gap: 8px;
}

.detail-answer {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(90, 140, 255, 0.08);
}

.detail-sub-item {
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.detail-item {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: grid;
  gap: 6px;
}

.detail-submission {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
}

.detail-sub-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 600;
}

.detail-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.detail-media img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(120, 140, 190, 0.2);
}

.detail-item-title {
  font-weight: 600;
}

.detail-item-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.empty-box {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  color: rgba(26, 29, 51, 0.6);
}

.question-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
}

.nav-btn {
  border: none;
  background: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-info {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .question-sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
