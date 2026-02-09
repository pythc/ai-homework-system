<template>
  <TeacherLayout
    title="作业批改"
    subtitle="查看 AI 结果并确认最终成绩"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业批改"
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

    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>
          学生提交详情
          <span class="badge" v-if="selectedSubmission">
            {{ selectedSubmission.student.name || selectedSubmission.student.account || '学生' }}
          </span>
        </div>
        <button class="ghost-action" @click="backToList">返回提交列表</button>
      </div>

      <div v-if="loadError" class="task-empty">{{ loadError }}</div>
      <div v-else-if="!selectedSubmission" class="task-empty">提交不存在</div>

      <div v-else class="detail-body">
        <div class="detail-section">
          <div class="detail-title">提交信息</div>
          <div class="detail-row">
            <div>学号：{{ selectedSubmission.student.account || '-' }}</div>
            <div>提交时间：{{ formatTime(selectedSubmission.submittedAt) }}</div>
            <div class="detail-status" :class="selectedSubmission.isFinal ? 'graded' : 'pending'">
              {{ selectedSubmission.isFinal ? '已批改' : '未批改' }}
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-title">题目与标准答案</div>
          <div class="detail-block">
            <div class="detail-label">题目</div>
            <div
              class="detail-text"
              v-mathjax
              v-html="renderMath(questionMap[selectedSubmission.questionId]?.prompt?.text)"
            />
          </div>
          <div class="detail-block">
            <div class="detail-label">标准答案</div>
            <div
              class="detail-text"
              v-mathjax
              v-html="renderMath(questionMap[selectedSubmission.questionId]?.standardAnswer?.text)"
            />
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-title">学生提交内容</div>
          <div class="detail-text">{{ selectedSubmission.contentText || '未填写文字答案' }}</div>
          <div v-if="selectedSubmission.fileUrls.length" class="detail-media">
            <img
              v-for="(img, index) in selectedSubmission.fileUrls"
              :key="index"
              :src="resolveFileUrl(img)"
              alt="submission image"
            />
          </div>
        </div>

        <div class="detail-section">
          <details class="ai-details" :open="!selectedSubmission.isFinal">
            <summary class="ai-summary-header">
              <span>AI 批改结果</span>
              <span class="ai-summary-status">状态：{{ aiPanel.statusLabel }}</span>
            </summary>
            <div class="ai-status">状态：{{ aiPanel.statusLabel }}</div>
            <div v-if="aiPanel.error" class="ai-error">{{ aiPanel.error }}</div>
            <div v-if="aiPanel.result" class="ai-result">
              <div class="ai-summary">
                <div class="ai-row">
                  <span class="ai-label">总评：</span>
                  <span
                    class="ai-text"
                    v-mathjax
                    v-html="renderMath(aiPanel.result?.result?.comment)"
                  />
                </div>
                <div>总分：{{ aiPanel.result?.result?.totalScore ?? '-' }}</div>
                <div>置信度：{{ aiPanel.result?.result?.confidence ?? '-' }}</div>
                <div>是否存疑：{{ aiPanel.result?.result?.isUncertain ? '是' : '否' }}</div>
              </div>
              <div v-if="aiPanel.result?.result?.items?.length" class="ai-items">
                <div v-for="(item, idx) in aiPanel.result?.result?.items" :key="idx" class="ai-item">
                  <div>评分项：{{ item.rubricItemKey || '-' }}</div>
                  <div>得分：{{ item.score ?? '-' }} / {{ item.maxScore ?? '-' }}</div>
                  <div class="ai-row">
                    <span class="ai-label">理由：</span>
                    <span
                      class="ai-text"
                      v-mathjax
                      v-html="renderMath(item.reason)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div class="detail-section">
          <div class="detail-title">教师复核与最终成绩</div>
          <div v-if="gradingItems.length === 0" class="empty-box">
            没有评分细则
          </div>
          <div v-else class="grading-form">
            <div v-for="(item, idx) in gradingItems" :key="item.rubricItemKey" class="grading-row">
              <div class="grading-label">
                {{ item.rubricItemKey }}（满分 {{ item.maxScore }}）
              </div>
              <input
                class="grading-input"
                type="number"
                :min="0"
                :max="item.maxScore"
                v-model.number="gradingItems[idx].score"
                @blur="clampScore(idx)"
                :disabled="selectedSubmission.isFinal"
              />
              <textarea
                class="grading-textarea"
                v-model="gradingItems[idx].reason"
                placeholder="评分理由（可选）"
                :disabled="selectedSubmission.isFinal"
              />
            </div>
            <div class="grading-total">总分：{{ totalScore }}</div>
            <textarea
              class="grading-comment"
              v-model="finalComment"
              placeholder="最终评语（可选）"
              :disabled="selectedSubmission.isFinal"
            />
            <div class="grading-actions">
              <template v-if="!selectedSubmission.isFinal">
                <button class="task-action" :disabled="saving" @click="submitGrading(false)">
                  {{ saving ? '提交中...' : '确认最终成绩' }}
                </button>
                <button class="task-action ghost" :disabled="saving" @click="submitGrading(true)">
                  直接采用 AI
                </button>
              </template>
              <div v-else class="graded-hint">已确认最终成绩</div>
              <div v-if="saveError" class="ai-error">{{ saveError }}</div>
              <div v-if="saveSuccess" class="ai-success">已保存最终成绩</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getAssignmentSnapshot } from '../api/assignment'
import { listSubmissionsByAssignment } from '../api/teacherGrading'
import { getAiJobStatus, getAiGradingResult } from '../api/aiGrading'
import { submitFinalGrading } from '../api/grading'
import { API_BASE_URL } from '../api/http'
import type { AiGradingResult } from '../api/aiGrading'
import type { AssignmentSnapshotQuestion } from '../api/assignment'

type GradingRow = {
  questionIndex: number
  rubricItemKey: string
  maxScore: number
  score: number
  reason?: string
}

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const submissionVersionId = computed(() => String(route.params.submissionVersionId ?? ''))
const courseId = computed(() => String(route.query.courseId ?? ''))

const submissions = ref<any[]>([])
const loadError = ref('')
const questionMap = ref<Record<string, AssignmentSnapshotQuestion>>({})

const selectedSubmission = computed(() =>
  submissions.value.find((item) => item.submissionVersionId === submissionVersionId.value),
)

const aiPanel = ref<{
  statusLabel: string
  error: string
  result: AiGradingResult | null
}>({
  statusLabel: '未加载',
  error: '',
  result: null,
})

const gradingItems = ref<GradingRow[]>([])
const finalComment = ref('')
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const renderMath = (text?: string) => {
  if (!text) return '—'
  return text.replace(/\n/g, '<br />')
}

const formatTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

const totalScore = computed(() =>
  gradingItems.value.reduce((sum, item) => sum + (Number(item.score) || 0), 0),
)

const clampScore = (index: number) => {
  const item = gradingItems.value[index]
  if (!item) return
  if (item.score < 0) item.score = 0
  if (item.score > item.maxScore) item.score = item.maxScore
}

const buildGradingItems = (question?: AssignmentSnapshotQuestion, ai?: AiGradingResult | null) => {
  const rubric = question?.rubric ?? []
  return rubric.map((rule) => {
    const aiItem = ai?.result?.items?.find((r) => r.rubricItemKey === rule.rubricItemKey)
    return {
      questionIndex: question?.questionIndex ?? 1,
      rubricItemKey: rule.rubricItemKey,
      maxScore: rule.maxScore,
      score: typeof aiItem?.score === 'number' ? aiItem.score : 0,
      reason: aiItem?.reason ?? '',
    }
  })
}

const pollAiResult = async (submissionId: string) => {
  const maxAttempts = 30
  const delayMs = 2000
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const job = await getAiJobStatus(submissionId)
      if (job.status === 'FAILED') {
        aiPanel.value = {
          statusLabel: '失败',
          error: job.error ?? 'AI 批改失败',
          result: null,
        }
        return
      }
      if (job.status === 'SUCCEEDED') {
        const result = await getAiGradingResult(submissionId)
        aiPanel.value = {
          statusLabel: '完成',
          error: '',
          result,
        }
        return
      }
      aiPanel.value = {
        ...aiPanel.value,
        statusLabel: job.status === 'RUNNING' ? '批改中' : '排队中',
      }
    } catch (err) {
      aiPanel.value = {
        statusLabel: '失败',
        error: err instanceof Error ? err.message : 'AI 批改失败',
        result: null,
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  aiPanel.value = {
    statusLabel: '超时',
    error: 'AI 批改超时，请稍后重试',
    result: null,
  }
}

const loadAiForSubmission = async (submissionId: string, questionId: string) => {
  aiPanel.value = { statusLabel: '加载中', error: '', result: null }
  try {
    const result = await getAiGradingResult(submissionId)
    aiPanel.value = { statusLabel: '完成', error: '', result }
    gradingItems.value = buildGradingItems(questionMap.value[questionId], result)
    finalComment.value = result.result?.comment ?? ''
  } catch (err) {
    aiPanel.value = {
      statusLabel: '排队中',
      error: '',
      result: null,
    }
    gradingItems.value = buildGradingItems(questionMap.value[questionId], null)
    finalComment.value = ''
    void pollAiResult(submissionId)
  }
}

const submitGrading = async (forceAiAdopt: boolean) => {
  const submission = selectedSubmission.value
  if (!submission) return
  saveError.value = ''
  saveSuccess.value = false
  saving.value = true
  try {
    if (forceAiAdopt) {
      if (!aiPanel.value.result) {
        throw new Error('AI 结果尚未生成')
      }
      gradingItems.value = buildGradingItems(
        questionMap.value[submission.questionId],
        aiPanel.value.result,
      )
      finalComment.value = aiPanel.value.result.result?.comment ?? ''
    }
    const items = gradingItems.value.map((item) => ({
      questionIndex: item.questionIndex,
      rubricItemKey: item.rubricItemKey,
      score: Number(item.score) || 0,
      reason: item.reason ?? '',
    }))
    const aiItems = aiPanel.value.result?.result?.items ?? []
    const aiComment = aiPanel.value.result?.result?.comment ?? ''
    const isSameAsAi =
      aiItems.length === items.length &&
      items.every((item) => {
        const ai = aiItems.find((it) => it.rubricItemKey === item.rubricItemKey)
        if (!ai) return false
        const aiScore = typeof ai.score === 'number' ? ai.score : Number(ai.score)
        const aiReason = (ai.reason ?? '').trim()
        return (
          Number(item.score) === Number(aiScore) &&
          (item.reason ?? '').trim() === aiReason
        )
      }) &&
      (finalComment.value || '') === (aiComment || '')

    await submitFinalGrading(submission.submissionVersionId, {
      source: aiPanel.value.result
        ? (forceAiAdopt || isSameAsAi ? 'AI_ADOPTED' : 'MIXED')
        : 'MANUAL',
      totalScore: totalScore.value,
      finalComment: finalComment.value || undefined,
      items,
    })
    saveSuccess.value = true
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const backToList = () => {
  if (assignmentId.value) {
    router.push({
      path: `/teacher/grading/${assignmentId.value}`,
      query: courseId.value ? { courseId: courseId.value } : undefined,
    })
  } else {
    router.push('/teacher/grading')
  }
}

const loadData = async () => {
  if (!assignmentId.value) {
    loadError.value = '缺少作业 ID'
    return
  }
  saveSuccess.value = false
  saveError.value = ''
  try {
    const snapshot = await getAssignmentSnapshot(assignmentId.value)
    const map: Record<string, AssignmentSnapshotQuestion> = {}
    ;(snapshot?.questions ?? []).forEach((q) => {
      map[q.questionId] = q
    })
    questionMap.value = map
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载作业快照失败'
  }

  try {
    const response = await listSubmissionsByAssignment(assignmentId.value)
    submissions.value = response?.items ?? []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载提交失败'
  }

  if (selectedSubmission.value) {
    void loadAiForSubmission(
      selectedSubmission.value.submissionVersionId,
      selectedSubmission.value.questionId,
    )
  }
}

onMounted(async () => {
  await refreshProfile()
  await loadData()
})

watch([assignmentId, submissionVersionId], async () => {
  await loadData()
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

.detail-body {
  display: grid;
  gap: 16px;
}

.detail-section {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.detail-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.detail-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
}

.detail-status {
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 600;
}

.detail-status.pending {
  background: rgba(255, 196, 154, 0.35);
  color: #9a4a12;
}

.detail-status.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
}

.detail-block {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.detail-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.detail-text {
  font-size: 13px;
  white-space: pre-wrap;
}

.detail-media {
  display: grid;
  gap: 8px;
}

.detail-media img {
  max-width: 100%;
  border-radius: 8px;
  background: #ffffff;
}

.ai-status {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.ai-details {
  display: grid;
  gap: 10px;
}

.ai-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  font-weight: 600;
  list-style: none;
}

.ai-summary-header::-webkit-details-marker {
  display: none;
}

.ai-summary-status {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 500;
}

.ai-error {
  font-size: 12px;
  color: #c84c4c;
}

.ai-success {
  font-size: 12px;
  color: #2e9d70;
}

.ai-summary {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.ai-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: start;
}

.ai-label {
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
}

.ai-text {
  white-space: pre-wrap;
}

.ai-items {
  display: grid;
  gap: 8px;
}

.ai-item {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: grid;
  gap: 4px;
}

.grading-form {
  display: grid;
  gap: 12px;
}

.grading-row {
  display: grid;
  gap: 8px;
}

.grading-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
}

.grading-input {
  width: 120px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
}

.grading-input:disabled,
.grading-textarea:disabled,
.grading-comment:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.grading-textarea {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.85);
  min-height: 60px;
  padding: 8px 10px;
  resize: vertical;
}

.grading-comment {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.85);
  min-height: 70px;
  padding: 8px 10px;
  resize: vertical;
}

.grading-total {
  font-weight: 600;
}

.grading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.graded-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.task-action.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.8);
  box-shadow: none;
}
</style>
