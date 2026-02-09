<template>
  <StudentLayout
    title="成绩详情"
    subtitle="最终成绩与评分明细"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
  >
    <section class="panel glass">
      <div class="panel-title">题目信息</div>
      <div v-if="questionText" class="detail-text" v-mathjax v-html="renderMath(questionText)" />
      <div v-else class="empty-box">暂无题目内容</div>
    </section>

    <section class="panel glass">
      <div class="panel-title">最终成绩</div>
      <div v-if="loading" class="grade-empty">加载中...</div>
      <div v-else-if="error" class="grade-empty">{{ error }}</div>
      <div v-else class="detail-body">
        <div class="detail-row">
          <div class="detail-label">总分</div>
          <div class="detail-value">{{ result?.totalScore ?? '-' }}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">来源</div>
          <div class="detail-value">{{ sourceLabel }}</div>
        </div>
        <div v-if="result?.finalComment" class="detail-block">
          <div class="detail-label">教师评语</div>
          <div class="detail-text" v-mathjax v-html="renderMath(result?.finalComment)" />
        </div>

        <div class="detail-block">
          <div class="detail-label">评分明细</div>
          <div v-if="!result?.items?.length" class="empty-box">暂无明细</div>
          <div v-else class="detail-items">
            <div v-for="(item, idx) in result.items" :key="idx" class="detail-item">
              <div class="detail-item-title">
                评分项 {{ item.rubricItemKey || '-' }}
              </div>
              <div class="detail-item-meta">
                得分 {{ item.score ?? '-' }}
              </div>
              <div v-if="item.reason" class="detail-text" v-mathjax v-html="renderMath(item.reason)" />
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
import { getFinalGrading } from '../api/grading'
import { getSubmissionVersion } from '../api/submission'
import { getAssignmentSnapshot } from '../api/assignment'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const result = ref<any | null>(null)
const questionText = ref('')

const submissionVersionId = computed(() => String(route.params.submissionVersionId ?? ''))

const sourceLabel = computed(() => {
  const source = result.value?.source
  if (source === 'AI_ADOPTED') return 'AI 批改'
  if (source === 'MANUAL') return '教师批改'
  if (source === 'MIXED') return '教师修订'
  return '—'
})

const renderMath = (text?: string | null) => {
  if (!text) return '—'
  return text.replace(/\n/g, '<br />')
}

onMounted(async () => {
  await refreshProfile()
  if (!submissionVersionId.value) {
    error.value = '缺少提交信息'
    loading.value = false
    return
  }
  try {
    result.value = await getFinalGrading(submissionVersionId.value)
    const submission = await getSubmissionVersion(submissionVersionId.value)
    const snapshot = await getAssignmentSnapshot(submission.assignmentId)
    const question = (snapshot?.questions ?? []).find(
      (item) => item.questionId === submission.questionId,
    )
    questionText.value = question?.prompt?.text ?? ''
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

.detail-text {
  white-space: pre-wrap;
  font-size: 13px;
}

.detail-items {
  display: grid;
  gap: 10px;
}

.detail-item {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: grid;
  gap: 6px;
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
</style>
