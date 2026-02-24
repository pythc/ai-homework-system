<template>
  <TeacherLayout
    title="作业批改"
    subtitle="查看 AI 结果并确认本题成绩"
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
          <span class="badge" v-if="selectedStudent">
            {{ selectedStudent.name || selectedStudent.account || '学生' }}
          </span>
        </div>
        <button class="ghost-action" @click="backToList">返回提交列表</button>
      </div>

      <div v-if="loadError" class="task-empty">{{ loadError }}</div>
      <div v-else-if="selectedStudentId" class="detail-body">
        <div class="question-tabs">
          <div class="question-tabs-header">
            <div class="question-tabs-title">作业题号</div>
            <div class="question-tabs-list">
              <button
                v-for="question in questions"
                :key="question.questionId"
                class="question-tab"
                :class="{ active: question.questionId === selectedQuestionId }"
                @click="selectQuestion(question.questionId)"
              >
                第 {{ question.questionIndex }} 题
              </button>
            </div>
          </div>
        </div>

        <div class="batch-toolbar">
          <div class="batch-meta">
            当前题目已勾选 <strong>{{ batchSelectedCount }}</strong> 人
          </div>
          <div class="batch-actions">
            <button class="task-action ghost" type="button" @click="selectAllForCurrentQuestion">
              全选可批改
            </button>
            <button
              class="task-action ghost"
              type="button"
              :disabled="batchSelectedCount === 0 || batchLoading"
              @click="clearBatchSelection"
            >
              清空
            </button>
            <button
              class="task-action ghost"
              type="button"
              :disabled="batchSelectedCount === 0 || batchLoading"
              @click="rerunBatchAi"
            >
              {{ batchLoading && batchMode === 'rerun' ? '批量重试中...' : '批量重新AI批改' }}
            </button>
            <button
              class="task-action"
              type="button"
              :disabled="batchSelectedCount === 0 || batchLoading"
              @click="adoptBatchAi"
            >
              {{ batchLoading && batchMode === 'adopt' ? '批量确认中...' : '批量采用AI并确认' }}
            </button>
          </div>
        </div>

        <div class="grading-layout">
          <aside class="student-panel">
            <div class="student-title">学生列表</div>
            <div class="student-meta">共 {{ studentsWithStatus.length }} 人</div>
            <div class="student-list">
              <details
                v-for="group in groupedStudents"
                :key="group.key"
                class="student-group"
                :open="openGroups[group.key]"
              >
                <summary class="student-group-title" @click.prevent="toggleGroup(group.key)">
                  <span class="student-group-start">
                    <span class="student-group-caret" :class="{ open: openGroups[group.key] }" />
                    <span class="student-group-label">{{ group.title }}</span>
                  </span>
                  <span class="student-group-count">({{ group.items.length }})</span>
                </summary>
                <div class="student-group-list">
                  <button
                    v-for="student in group.items"
                    :key="student.studentId"
                    class="student-item"
                    :class="{ active: student.studentId === selectedStudentId }"
                    @click="selectStudent(student.studentId)"
                  >
                    <div class="student-row">
                      <input
                        class="student-check"
                        type="checkbox"
                        :checked="batchSelectedStudentIds.has(student.studentId)"
                        :disabled="!hasSubmissionForCurrentQuestion(student.studentId)"
                        @click.stop
                        @change="toggleBatchStudent(student.studentId)"
                      />
                      <span class="student-name">{{ student.name || '学生' }}</span>
                      <span class="student-sub">{{ formatStudentAccount(student) }}</span>
                      <span class="student-tag" :class="student.statusTone">
                        {{ student.statusLabel }}
                      </span>
                    </div>
                  </button>
                </div>
              </details>
            </div>
          </aside>

          <div class="submission-panel">
            <div class="detail-section">
              <div class="detail-title">提交信息</div>
              <div class="detail-row">
                <div>学号：{{ formatStudentAccount(selectedSubmission?.student) }}</div>
                <div>提交时间：{{ formatTime(selectedSubmission?.submittedAt) }}</div>
                <div class="detail-status" :class="submissionStatusTone">
                  {{ submissionStatusLabel }}
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
                  v-html="renderMath(extractPromptText(currentQuestion?.prompt))"
                />
              </div>
              <div class="detail-block">
                <div class="detail-label">标准答案</div>
                <div
                  class="detail-text"
                  v-mathjax
                  v-html="renderMath(extractStandardAnswerText(currentQuestion?.standardAnswer))"
                />
              </div>
            </div>

            <div class="detail-section submission-content">
              <div class="detail-title">学生提交内容</div>
              <div
                v-if="selectedSubmission?.contentText"
                class="detail-text student-submission-text"
                v-mathjax
                v-html="renderAnswerHtml(selectedSubmission.contentText)"
              />
              <div v-else-if="!selectedSubmission" class="empty-box">该学生未提交此题</div>
              <div v-if="selectedSubmission?.fileUrls?.length" class="detail-media">
                <img
                  v-for="(img, index) in selectedSubmission.fileUrls"
                  :key="index"
                  :src="resolveFileUrl(img)"
                  alt="submission image"
                />
              </div>
            </div>
          </div>

          <div class="grading-panel">
            <div class="detail-section">
              <div v-if="highRiskReasons.length" class="risk-alert risk-alert-inline">
                <div class="risk-title">高风险提示（建议优先复核）</div>
                <ul class="risk-list">
                  <li v-for="(reason, idx) in highRiskReasons" :key="`risk-inline-${idx}`" class="risk-item">
                    <span class="risk-code">{{ reason.code }}</span>
                    <span class="risk-message">{{ reason.message || '存在高风险不确定项' }}</span>
                  </li>
                </ul>
              </div>

              <details class="ai-details" :open="!selectedSubmission?.isFinal">
                <summary class="ai-summary-header">
                  <span>AI 批改结果</span>
                  <span class="ai-summary-hint">点击展开查看详情</span>
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

                  <div v-if="structuredAiItems.length" class="ai-items">
                    <div
                      v-for="(item, idx) in structuredAiItems"
                      :key="`ai-item-${idx}`"
                      class="ai-item"
                    >
                      <div class="ai-item-head">
                        <span class="ai-item-key">{{ item.rubricItemKey || '-' }}</span>
                        <span class="ai-item-score">{{ item.score }} / {{ item.maxScore }}</span>
                      </div>
                      <div class="ai-item-meta">
                        <span :class="{ danger: item.deduction > 0 }">
                          扣分：{{ item.deduction.toFixed(2) }}
                        </span>
                        <span>不确定度：{{ Math.round((item.uncertaintyScore || 0) * 100) }}%</span>
                      </div>
                      <ul v-if="item.points.length" class="ai-point-list">
                        <li
                          v-for="(point, pointIdx) in item.points"
                          :key="`ai-point-${idx}-${pointIdx}`"
                          v-mathjax
                          v-html="renderMath(point)"
                        />
                      </ul>
                    </div>
                  </div>

                  <div
                    v-if="aiPanel.result?.result?.uncertaintyReasons?.length"
                    class="ai-uncertainty-list"
                  >
                    <div class="ai-uncertainty-title">不确定原因</div>
                    <ul>
                      <li
                        v-for="(reason, idx) in aiPanel.result?.result?.uncertaintyReasons"
                        :key="`reason-${idx}`"
                        class="risk-item"
                      >
                        <span class="risk-code">{{ reason.code || 'UNKNOWN' }}</span>
                        <span class="risk-message">{{ reason.message || '模型返回不确定原因' }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>

            <div class="detail-section">
              <div class="detail-title">教师复核与本题成绩</div>
              <div v-if="gradingItems.length === 0" class="empty-box">
                没有评分细则
              </div>
              <div v-else class="grading-form">
                <div class="grading-row">
                  <div class="grading-label">
                    本题总分（满分 {{ maxTotalScore }}）
                  </div>
                  <input
                    class="grading-input"
                    type="number"
                    :min="0"
                    :max="maxTotalScore"
                    v-model.number="totalScoreInput"
                    @blur="clampTotalScore"
                    :disabled="!canEditCurrent"
                  />
                </div>
                <div class="grading-total">本题得分：{{ totalScore }}</div>
                <textarea
                  v-if="commentEditorOpen || !finalComment"
                  ref="finalCommentInputRef"
                  class="grading-comment"
                  v-model="finalComment"
                  placeholder="本题评语（可选）"
                  :disabled="!canEditCurrent"
                  @blur="closeCommentEditor"
                />
                <div
                  v-else
                  class="grading-comment grading-comment-rendered detail-text"
                  :class="{ disabled: !canEditCurrent }"
                  v-mathjax
                  v-html="renderAnswerHtml(finalComment)"
                  @click="openCommentEditor"
                />

                <div class="grading-actions">
                  <template v-if="selectedSubmission && canEditCurrent">
                    <button class="task-action ghost" :disabled="saving" @click="submitGrading(true)">
                      采用AI评语
                    </button>
                  </template>
                  <template v-else-if="selectedSubmission && selectedSubmission.isFinal">
                    <button class="task-action ghost" type="button" @click="startEdit">
                      修改成绩
                    </button>
                  </template>
                  <div v-else class="graded-hint">该学生未提交，无法评分</div>
                  <div v-if="saveError" class="ai-error">{{ saveError }}</div>
                </div>

                <div class="publish-actions">
                  <div class="publish-button-row">
                    <button
                      class="task-action ghost"
                      type="button"
                      :disabled="rerunLoading || !selectedSubmission"
                      @click="rerunCurrentAi"
                    >
                      {{ rerunLoading ? '重试中...' : 'AI 重新批改' }}
                    </button>
                    <button
                      class="task-action"
                      type="button"
                      :disabled="saving || !selectedSubmission || !canEditCurrent || !hasCurrentChanges"
                      @click="confirmCurrentChanges"
                    >
                      {{ saving ? '确认中...' : '确认修改' }}
                    </button>
                  </div>
                  <div v-if="rerunError" class="ai-error">{{ rerunError }}</div>
                  <div v-if="saveError" class="ai-error">{{ saveError }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="task-empty">暂无学生</div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getAssignmentSnapshot } from '../api/assignment'
import { listMissingByAssignment, listSubmissionsByAssignment } from '../api/teacherGrading'
import { getAiJobStatus, getAiGradingResult, runAiGrading } from '../api/aiGrading'
import { getFinalGrading, submitFinalGrading } from '../api/grading'
import { publishAssignmentScores } from '../api/score'
import { API_BASE_URL } from '../api/http'
import type { AiGradingResult } from '../api/aiGrading'
import type { AssignmentSnapshotQuestion } from '../api/assignment'
import { showAppToast } from '../composables/useAppToast'

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
const routeStudentId = computed(() => String(route.query.studentId ?? ''))

const submissions = ref<any[]>([])
const missingStudents = ref<any[]>([])
const questions = ref<AssignmentSnapshotQuestion[]>([])
const loadError = ref('')
const questionMap = ref<Record<string, AssignmentSnapshotQuestion>>({})
const selectedQuestionId = ref('')
const selectedStudentId = ref('')
const batchSelectedStudentIds = ref(new Set<string>())
const batchLoading = ref(false)
const batchMode = ref<'rerun' | 'adopt' | null>(null)
const openGroups = ref<Record<string, boolean>>({
  graded: true,
  pending: true,
  objection: true,
  missing: false,
})

const students = computed(() => {
  const map = new Map<string, { studentId: string; name?: string | null; account?: string | null }>()
  missingStudents.value.forEach((item) => {
    const studentId = item.studentId
    if (!studentId) return
    map.set(studentId, {
      studentId,
      name: item.name,
      account: item.account,
    })
  })
  submissions.value.forEach((item) => {
    const studentId = item.student?.studentId
    if (!studentId) return
    if (!map.has(studentId)) {
      map.set(studentId, {
        studentId,
        name: item.student?.name,
        account: item.student?.account,
      })
    }
  })
  return Array.from(map.values()).sort((a, b) => {
    const aKey = (a.name || a.account || '').toString()
    const bKey = (b.name || b.account || '').toString()
    return aKey.localeCompare(bKey, 'zh-CN')
  })
})

const submissionByKey = computed(() => {
  const map = new Map<string, any>()
  submissions.value.forEach((item) => {
    const studentId = item.student?.studentId
    if (!studentId) return
    const key = `${studentId}::${item.questionId}`
    if (!map.has(key)) {
      map.set(key, item)
      return
    }
    const prev = map.get(key)
    const prevTime = new Date(prev?.submittedAt ?? 0).getTime()
    const nextTime = new Date(item?.submittedAt ?? 0).getTime()
    if (nextTime >= prevTime) {
      map.set(key, item)
    }
  })
  return map
})

const selectedSubmission = computed(() => {
  if (selectedStudentId.value && selectedQuestionId.value) {
    return (
      submissionByKey.value.get(`${selectedStudentId.value}::${selectedQuestionId.value}`) ||
      null
    )
  }
  return (
    submissions.value.find((item) => item.submissionVersionId === submissionVersionId.value) ||
    null
  )
})

const currentQuestion = computed(() => {
  if (!selectedQuestionId.value) return questions.value[0] || null
  return (
    questions.value.find(
      (q: AssignmentSnapshotQuestion) => q.questionId === selectedQuestionId.value,
    ) || null
  )
})

const selectedStudent = computed(() =>
  students.value.find((student) => student.studentId === selectedStudentId.value) || null,
)

const submissionStatusLabel = computed(() => {
  if (!selectedSubmission.value) return '未提交'
  const isFinal = Boolean(selectedSubmission.value.isFinal ?? selectedSubmission.value.status === 'FINAL')
  if (isFinal) return '已确认'
  if (selectedSubmission.value.aiIsUncertain) return '有异议'
  return '待确认'
})

const submissionStatusTone = computed(() => {
  if (!selectedSubmission.value) return 'missing'
  const isFinal = Boolean(selectedSubmission.value.isFinal ?? selectedSubmission.value.status === 'FINAL')
  if (isFinal) return 'graded'
  if (selectedSubmission.value.aiIsUncertain) return 'objection'
  return 'pending'
})

const studentsWithStatus = computed(() =>
  students.value.map((student) => {
    const allSubmissions = questions.value.map((question) =>
      submissionByKey.value.get(`${student.studentId}::${question.questionId}`),
    )
    const existing = allSubmissions.filter(Boolean)
    if (!existing.length) {
      return { ...student, statusLabel: '未提交', statusTone: 'missing' }
    }
    const allFinal =
      questions.value.length > 0 &&
      questions.value.every((question) => {
        const submission = submissionByKey.value.get(
          `${student.studentId}::${question.questionId}`,
        )
        return submission && Boolean(submission.isFinal ?? submission.status === 'FINAL')
      })
    if (allFinal) {
      return { ...student, statusLabel: '已确认', statusTone: 'graded' }
    }
    const hasObjection = existing.some(
      (submission) =>
        !Boolean(submission.isFinal ?? submission.status === 'FINAL') &&
        Boolean(submission.aiIsUncertain),
    )
    if (hasObjection) {
      return { ...student, statusLabel: '有异议', statusTone: 'objection' }
    }
    return {
      ...student,
      statusLabel: '待确认',
      statusTone: 'pending',
    }
  }),
)

const groupedStudents = computed(() => {
  const groups = [
    { key: 'graded', title: '已确认', items: [] as typeof studentsWithStatus.value },
    { key: 'pending', title: '待确认', items: [] as typeof studentsWithStatus.value },
    { key: 'objection', title: '有异议', items: [] as typeof studentsWithStatus.value },
    { key: 'missing', title: '未提交', items: [] as typeof studentsWithStatus.value },
  ]
  const map = new Map(groups.map((group) => [group.key, group]))
  studentsWithStatus.value.forEach((student) => {
    map.get(student.statusTone)?.items.push(student)
  })
  return groups
})

const batchSelectedCount = computed(() => batchSelectedStudentIds.value.size)

const getSubmissionByStudentAndQuestion = (studentId: string, questionId: string) =>
  submissionByKey.value.get(`${studentId}::${questionId}`) || null

const hasSubmissionForCurrentQuestion = (studentId: string) => {
  if (!selectedQuestionId.value) return false
  return Boolean(getSubmissionByStudentAndQuestion(studentId, selectedQuestionId.value))
}

const normalizeReasonPoints = (reason?: string) => {
  if (!reason) return []
  return reason
    .split(/\n|；|;|。/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const structuredAiItems = computed(() =>
  (aiPanel.value.result?.result?.items ?? []).map((item) => {
    const maxScore = Number(item.maxScore ?? 0)
    const score = Number(item.score ?? 0)
    return {
      rubricItemKey: item.rubricItemKey ?? '-',
      maxScore,
      score,
      deduction: Math.max(0, maxScore - score),
      uncertaintyScore: Number(item.uncertaintyScore ?? 0),
      points: normalizeReasonPoints(item.reason),
    }
  }),
)

const highRiskCodes = new Set([
  'UNREADABLE',
  'FORMAT_AMBIGUOUS',
  'NON_HANDWRITTEN',
  'MISSING_INFO',
])

const highRiskReasons = computed(
  () =>
    (aiPanel.value.result?.result?.uncertaintyReasons ?? []).filter((item) =>
      highRiskCodes.has(String(item.code ?? '').toUpperCase()),
    ) ?? [],
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
const commentEditorOpen = ref(true)
const finalCommentInputRef = ref<HTMLTextAreaElement | null>(null)
const totalScoreInput = ref(0)
const saving = ref(false)
const rerunLoading = ref(false)
const rerunError = ref('')
const saveError = ref('')
const editingOverride = ref(false)
const baselineScore = ref(0)
const baselineComment = ref('')

const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const extractPromptText = (
  prompt?: string | { text?: string; media?: Array<{ url: string; caption?: string }> },
) => {
  if (!prompt) return ''
  if (typeof prompt === 'string') return prompt
  return String(prompt.text ?? '')
}

const extractStandardAnswerText = (
  standardAnswer?: string | { text?: string } | Record<string, unknown>,
) => {
  if (!standardAnswer) return ''
  if (typeof standardAnswer === 'string') return standardAnswer
  if ('text' in standardAnswer) {
    return String((standardAnswer as { text?: unknown }).text ?? '')
  }
  return ''
}

const renderMath = (text?: string) => {
  if (!text) return '—'
  return text.replace(/\n/g, '<br />')
}

const renderAnswerHtml = (text?: string | null) => {
  if (!text) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return text
  return renderMath(text)
}

const syncCommentEditorMode = () => {
  commentEditorOpen.value = !finalComment.value
}

const openCommentEditor = async () => {
  if (!canEditCurrent.value) return
  commentEditorOpen.value = true
  await nextTick()
  finalCommentInputRef.value?.focus()
}

const closeCommentEditor = () => {
  if (finalComment.value) {
    commentEditorOpen.value = false
  }
}

const selectQuestion = (questionId: string) => {
  selectedQuestionId.value = questionId
  editingOverride.value = false
}

const selectStudent = (studentId: string) => {
  selectedStudentId.value = studentId
  editingOverride.value = false
}

const toggleBatchStudent = (studentId: string) => {
  if (!hasSubmissionForCurrentQuestion(studentId)) return
  const next = new Set(batchSelectedStudentIds.value)
  if (next.has(studentId)) {
    next.delete(studentId)
  } else {
    next.add(studentId)
  }
  batchSelectedStudentIds.value = next
}

const clearBatchSelection = () => {
  batchSelectedStudentIds.value = new Set()
}

const selectAllForCurrentQuestion = () => {
  const next = new Set<string>()
  studentsWithStatus.value.forEach((student) => {
    if (hasSubmissionForCurrentQuestion(student.studentId)) {
      next.add(student.studentId)
    }
  })
  batchSelectedStudentIds.value = next
}

const toggleGroup = (key: string) => {
  openGroups.value[key] = !openGroups.value[key]
}

const formatTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

const formatStudentAccount = (student?: { account?: string | null; studentId?: string }) => {
  const account = student?.account ?? ''
  if (/^\d+$/.test(account)) return account
  const fallback = student?.studentId ?? ''
  if (/^\d+$/.test(fallback)) return fallback
  return '-'
}

const totalScore = computed(() => Number(totalScoreInput.value) || 0)
const maxTotalScore = computed(() =>
  gradingItems.value.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0),
)

const hasCurrentChanges = computed(() => {
  const scoreChanged = Math.abs((Number(totalScoreInput.value) || 0) - (Number(baselineScore.value) || 0)) > 0.001
  const commentChanged = (finalComment.value || '') !== (baselineComment.value || '')
  return scoreChanged || commentChanged
})

const canEditCurrent = computed(() => {
  if (!selectedSubmission.value) return false
  if (!selectedSubmission.value.isFinal) return true
  return editingOverride.value
})

const clampTotalScore = () => {
  if (totalScoreInput.value < 0) totalScoreInput.value = 0
  if (totalScoreInput.value > maxTotalScore.value) {
    totalScoreInput.value = maxTotalScore.value
  }
}

const buildGradingItems = (
  question?: AssignmentSnapshotQuestion,
  ai?: AiGradingResult | null,
  options = { useAiReasons: false },
) => {
  const rubric = question?.rubric ?? []
  return rubric.map((rule) => {
    const aiItem = ai?.result?.items?.find((r) => r.rubricItemKey === rule.rubricItemKey)
    return {
      questionIndex: question?.questionIndex ?? 1,
      rubricItemKey: rule.rubricItemKey,
      maxScore: rule.maxScore,
      score: typeof aiItem?.score === 'number' ? aiItem.score : 0,
      reason: options.useAiReasons ? aiItem?.reason ?? '' : '',
    }
  })
}

const buildItemsFromTotal = (total: number) => {
  let remaining = Number.isFinite(total) ? Math.max(total, 0) : 0
  return gradingItems.value.map((item) => {
    const max = Number(item.maxScore) || 0
    const score = Math.max(0, Math.min(max, remaining))
    remaining -= score
    return {
      questionIndex: item.questionIndex,
      rubricItemKey: item.rubricItemKey,
      score,
      reason: '',
    }
  })
}

const loadFinalForSubmission = async (submissionId: string, questionId: string) => {
  const question = questionMap.value[questionId]
  if (!question) return
  try {
    const result = await getFinalGrading(submissionId)
    const items = result?.items ?? []
    const rubric = question.rubric ?? []
    gradingItems.value = rubric.map((rule) => {
      const matched = items.find((it) => it.rubricItemKey === rule.rubricItemKey)
      return {
        questionIndex: question.questionIndex,
        rubricItemKey: rule.rubricItemKey,
        maxScore: rule.maxScore,
        score: typeof matched?.score === 'number' ? matched.score : Number(matched?.score ?? 0),
        reason: matched?.reason ?? '',
      }
    })
    finalComment.value = result?.finalComment ?? ''
    syncCommentEditorMode()
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
    baselineScore.value = Number(totalScoreInput.value) || 0
    baselineComment.value = finalComment.value || ''
  } catch (err) {
    gradingItems.value = buildGradingItems(question, aiPanel.value.result)
    finalComment.value = ''
    syncCommentEditorMode()
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
    baselineScore.value = Number(totalScoreInput.value) || 0
    baselineComment.value = finalComment.value || ''
  }
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
    finalComment.value = ''
    syncCommentEditorMode()
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
    baselineScore.value = Number(totalScoreInput.value) || 0
    baselineComment.value = finalComment.value || ''
  } catch (err) {
    aiPanel.value = {
      statusLabel: '排队中',
      error: '',
      result: null,
    }
    gradingItems.value = buildGradingItems(questionMap.value[questionId], null)
    finalComment.value = ''
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
    baselineScore.value = Number(totalScoreInput.value) || 0
    baselineComment.value = finalComment.value || ''
    void pollAiResult(submissionId)
  }
}

const loadAiStatusOnly = async (submissionId: string) => {
  aiPanel.value = { statusLabel: '加载中', error: '', result: null }
  try {
    const result = await getAiGradingResult(submissionId)
    aiPanel.value = { statusLabel: '完成', error: '', result }
  } catch (err) {
    aiPanel.value = {
      statusLabel: '排队中',
      error: '',
      result: null,
    }
    void pollAiResult(submissionId)
  }
}

const rerunCurrentAi = async () => {
  const submission = selectedSubmission.value
  if (!submission?.submissionVersionId) return
  rerunLoading.value = true
  rerunError.value = ''
  try {
    await runAiGrading(submission.submissionVersionId, {
      snapshotPolicy: 'LATEST_PUBLISHED',
    })
    submission.aiStatus = 'PENDING'
    submission.aiIsUncertain = false
    aiPanel.value = { statusLabel: '排队中', error: '', result: null }
    await pollAiResult(submission.submissionVersionId)
    if (aiPanel.value.result) {
      submission.aiStatus = 'SUCCESS'
      submission.aiConfidence =
        typeof aiPanel.value.result.result?.confidence === 'number'
          ? aiPanel.value.result.result.confidence
          : null
      submission.aiIsUncertain = Boolean(aiPanel.value.result.result?.isUncertain)
      showAppToast('AI 重新批改完成', 'success')
    } else if (aiPanel.value.error) {
      submission.aiStatus = 'FAILED'
      showAppToast('AI 重新批改失败', 'error')
    }
  } catch (err) {
    rerunError.value = err instanceof Error ? err.message : '重新批改失败'
    showAppToast(rerunError.value || 'AI 重新批改失败', 'error')
  } finally {
    rerunLoading.value = false
  }
}

const collectBatchTargets = () => {
  if (!selectedQuestionId.value) return []
  const targets = Array.from(batchSelectedStudentIds.value)
    .map((studentId) => {
      const submission = getSubmissionByStudentAndQuestion(studentId, selectedQuestionId.value)
      if (!submission?.submissionVersionId) return null
      return { studentId, submission }
    })
    .filter(Boolean) as Array<{ studentId: string; submission: any }>
  return targets
}

const rerunBatchAi = async () => {
  if (batchLoading.value) return
  const targets = collectBatchTargets()
  if (!targets.length) {
    showAppToast('请先勾选可批改学生', 'error')
    return
  }
  batchLoading.value = true
  batchMode.value = 'rerun'
  try {
    const results = await Promise.allSettled(
      targets.map((target) =>
        runAiGrading(target.submission.submissionVersionId, {
          snapshotPolicy: 'LATEST_PUBLISHED',
        }),
      ),
    )
    let success = 0
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success += 1
        const target = targets[index]
        if (target) {
          target.submission.aiStatus = 'PENDING'
          target.submission.aiIsUncertain = false
        }
      }
    })
    const failed = results.length - success
    if (failed > 0) {
      showAppToast(`批量重试完成：成功 ${success}，失败 ${failed}`, 'error')
    } else {
      showAppToast(`批量重试完成：${success} 条`, 'success')
    }
    if (
      selectedSubmission.value &&
      batchSelectedStudentIds.value.has(selectedStudentId.value) &&
      selectedSubmission.value.submissionVersionId
    ) {
      await loadAiStatusOnly(selectedSubmission.value.submissionVersionId)
    }
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '批量重试失败', 'error')
  } finally {
    batchLoading.value = false
    batchMode.value = null
  }
}

const adoptBatchAi = async () => {
  if (batchLoading.value) return
  const targets = collectBatchTargets()
  if (!targets.length) {
    showAppToast('请先勾选可批改学生', 'error')
    return
  }
  batchLoading.value = true
  batchMode.value = 'adopt'
  let success = 0
  let failed = 0
  for (const target of targets) {
    try {
      const question = questionMap.value[target.submission.questionId]
      if (!question) {
        failed += 1
        continue
      }
      const aiResult = await getAiGradingResult(target.submission.submissionVersionId)
      const items = buildGradingItems(question, aiResult, { useAiReasons: true }).map((item) => ({
        questionIndex: item.questionIndex,
        rubricItemKey: item.rubricItemKey,
        score: Number(item.score) || 0,
        reason: item.reason ?? '',
      }))
      const totalScore = items.reduce((sum, item) => sum + (Number(item.score) || 0), 0)
      await submitFinalGrading(target.submission.submissionVersionId, {
        source: 'AI_ADOPTED',
        totalScore,
        finalComment: aiResult.result?.comment ?? undefined,
        items,
      })
      target.submission.isFinal = true
      target.submission.status = 'FINAL'
      target.submission.aiStatus = 'SUCCESS'
      target.submission.aiIsUncertain = Boolean(aiResult.result?.isUncertain)
      const publishState = await tryAutoPublishForStudent(String(target.submission?.student?.studentId ?? ''))
      if (publishState.published) {
        target.submission.scorePublished = true
      }
      success += 1
    } catch {
      failed += 1
    }
  }
  if (failed > 0) {
    showAppToast(`批量确认完成：成功 ${success}，失败 ${failed}`, 'error')
  } else {
    showAppToast(`批量确认完成：${success} 条`, 'success')
  }
  batchLoading.value = false
  batchMode.value = null
  clearBatchSelection()
  await loadData()
}

const tryAutoPublishForStudent = async (studentId: string) => {
  if (!assignmentId.value || !studentId) {
    return { published: false, pending: false }
  }
  try {
    await publishAssignmentScores(assignmentId.value, studentId)
    return { published: true, pending: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('题目未全部评分')) {
      return { published: false, pending: true }
    }
    return { published: false, pending: false }
  }
}

const submitGrading = async (forceAiAdopt: boolean) => {
  const submission = selectedSubmission.value
  if (!submission) return
  saveError.value = ''
  saving.value = true
  let published = false
  let pendingPublish = false
  try {
    if (forceAiAdopt) {
      if (!aiPanel.value.result) {
        throw new Error('AI 结果尚未生成')
      }
      gradingItems.value = buildGradingItems(
        questionMap.value[submission.questionId],
        aiPanel.value.result,
        { useAiReasons: true },
      )
      finalComment.value = aiPanel.value.result.result?.comment ?? ''
      commentEditorOpen.value = false
      totalScoreInput.value = gradingItems.value.reduce(
        (sum, item) => sum + (Number(item.score) || 0),
        0,
      )
      clampTotalScore()
    }
    const items = forceAiAdopt
      ? gradingItems.value.map((item) => ({
          questionIndex: item.questionIndex,
          rubricItemKey: item.rubricItemKey,
          score: Number(item.score) || 0,
          reason: item.reason ?? '',
        }))
      : buildItemsFromTotal(totalScore.value)

    await submitFinalGrading(submission.submissionVersionId, {
      source: forceAiAdopt ? 'AI_ADOPTED' : 'MANUAL',
      totalScore: totalScore.value,
      finalComment: finalComment.value || undefined,
      items,
    })
    submission.isFinal = true
    submission.status = 'FINAL'
    editingOverride.value = false
    baselineScore.value = Number(totalScoreInput.value) || 0
    baselineComment.value = finalComment.value || ''
    syncCommentEditorMode()
    const publishState = await tryAutoPublishForStudent(String(submission?.student?.studentId ?? ''))
    published = publishState.published
    pendingPublish = publishState.pending
    if (published) {
      submission.scorePublished = true
      showAppToast('已确认修改，学生端已可见分数', 'success')
    } else if (pendingPublish) {
      showAppToast('已确认修改，全部题目确认后将自动对学生可见', 'success')
    } else {
      showAppToast(forceAiAdopt ? '已采用AI评语并确认修改' : '已确认修改', 'success')
    }
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
    showAppToast(saveError.value || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const startEdit = () => {
  editingOverride.value = true
  commentEditorOpen.value = true
  void nextTick(() => finalCommentInputRef.value?.focus())
}

const confirmCurrentChanges = async () => {
  await submitGrading(false)
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

watch(
  () => selectedSubmission.value,
  async (submission) => {
    rerunError.value = ''
    if (submission) {
      if (submission.isFinal && !editingOverride.value) {
        await loadFinalForSubmission(submission.submissionVersionId, submission.questionId)
        await loadAiStatusOnly(submission.submissionVersionId)
      } else {
        await loadAiForSubmission(submission.submissionVersionId, submission.questionId)
      }
      editingOverride.value = false
      return
    }
    aiPanel.value = { statusLabel: '未加载', error: '', result: null }
    gradingItems.value = buildGradingItems(currentQuestion.value ?? undefined, null)
    finalComment.value = ''
    syncCommentEditorMode()
    totalScoreInput.value = 0
    baselineScore.value = 0
    baselineComment.value = ''
  },
  { immediate: true },
)

watch(
  () => selectedQuestionId.value,
  () => {
    clearBatchSelection()
  },
)

const loadData = async () => {
  if (!assignmentId.value) {
    loadError.value = '缺少作业 ID'
    return
  }
  saveError.value = ''
  try {
    const snapshot = await getAssignmentSnapshot(assignmentId.value)
    const map: Record<string, AssignmentSnapshotQuestion> = {}
    const sorted = [...(snapshot?.questions ?? [])].sort(
      (a, b) => a.questionIndex - b.questionIndex,
    )
    sorted.forEach((q: AssignmentSnapshotQuestion) => {
      map[q.questionId] = q
    })
    questions.value = sorted
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

  try {
    const response = await listMissingByAssignment(assignmentId.value)
    missingStudents.value = response?.items ?? []
  } catch (err) {
    missingStudents.value = []
  }

  clearBatchSelection()

  const routeMatch = submissions.value.find(
    (item) => item.submissionVersionId === submissionVersionId.value,
  )
  if (routeMatch) {
    selectedStudentId.value = routeMatch.student?.studentId ?? ''
  }
  if (routeStudentId.value) {
    const match = students.value.find((student) => student.studentId === routeStudentId.value)
    if (match) {
      selectedStudentId.value = match.studentId
    }
  }
  if (!selectedQuestionId.value) {
    const firstQuestion = questions.value[0]
    if (firstQuestion) {
      selectedQuestionId.value = firstQuestion.questionId
    }
  }
  if (!selectedStudentId.value) {
    const firstStudent = students.value[0]
    if (firstStudent) {
      selectedStudentId.value = firstStudent.studentId
    }
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

.question-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.question-tabs-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.question-tabs-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 600;
}

.question-tabs-current {
  font-size: 13px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.8);
}

.question-tabs-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.question-tab {
  border: none;
  background: rgba(255, 255, 255, 0.75);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.8);
  transition: all 0.2s ease;
}

.question-tab:hover {
  background: rgba(255, 255, 255, 0.95);
}

.question-tab.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.9), rgba(120, 200, 230, 0.9));
  color: #ffffff;
  box-shadow: 0 12px 20px rgba(60, 120, 210, 0.25);
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
}

.detail-body {
  display: grid;
  gap: 16px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
}

.batch-meta {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.72);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.grading-layout {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) minmax(0, 280px);
  gap: 16px;
  align-items: stretch;
}

.student-panel {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 16px;
  align-self: start;
  max-height: calc(100vh - 180px);
}

.student-title {
  font-weight: 600;
}

.student-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.student-list::-webkit-scrollbar {
  width: 6px;
}

.student-list::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 190, 0.45);
  border-radius: 999px;
}

.student-list::-webkit-scrollbar-track {
  background: transparent;
}

.student-group {
  display: grid;
  gap: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  padding: 8px;
}

.student-group-title {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.75);
  padding: 6px 4px;
  cursor: pointer;
  border-bottom: 1px solid rgba(120, 140, 190, 0.15);
  list-style: none;
  min-width: 0;
}

.student-group-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.student-group-start {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.student-group-caret {
  width: 6px;
  height: 6px;
  border-right: 1.8px solid rgba(26, 29, 51, 0.55);
  border-bottom: 1.8px solid rgba(26, 29, 51, 0.55);
  transform: rotate(-45deg);
  transform-origin: center;
  transition: transform 0.18s ease;
  flex-shrink: 0;
}

.student-group-caret.open {
  transform: rotate(45deg);
}

.student-group-count {
  flex-shrink: 0;
  font-weight: 500;
  color: rgba(26, 29, 51, 0.55);
}

.student-group-title::-webkit-details-marker {
  display: none;
}

.student-group-list {
  display: grid;
  gap: 8px;
}

.student-item {
  border: none;
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 12px;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.student-item:hover {
  background: rgba(255, 255, 255, 1);
}

.student-item.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.9), rgba(120, 200, 230, 0.9));
  color: #ffffff;
  box-shadow: 0 14px 20px rgba(60, 120, 210, 0.25);
}

.student-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.student-check {
  width: 14px;
  height: 14px;
  margin: 0;
}

.student-name {
  font-weight: 600;
}

.student-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.student-item.active .student-sub {
  color: rgba(255, 255, 255, 0.85);
}

.student-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.student-tag.pending {
  background: rgba(255, 196, 154, 0.32);
  color: #9a4a12;
}

.student-tag.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
}

.student-tag.objection {
  background: rgba(244, 67, 54, 0.18);
  color: #b42318;
}

.student-tag.missing {
  background: rgba(190, 200, 220, 0.35);
  color: rgba(26, 29, 51, 0.62);
}

.detail-status.pending {
  background: rgba(255, 196, 154, 0.35);
  color: #9a4a12;
}

.detail-status.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
}

.detail-status.objection {
  background: rgba(244, 67, 54, 0.18);
  color: #b42318;
}

.detail-status.missing {
  background: rgba(190, 200, 220, 0.35);
  color: rgba(26, 29, 51, 0.6);
}

.submission-panel,
.grading-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.detail-section {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  min-width: 0;
  overflow: visible;
}

.detail-section.submission-content {
  flex: 1;
}
.detail-title {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 18px;
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

.detail-block {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  overflow-x: auto;
  max-width: 100%;
}

.detail-label {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.6);
}

.detail-text {
  font-size: 15px;
  white-space: pre-wrap;
  max-width: 100%;
  word-break: break-word;
  overflow-x: auto;
}

.student-submission-text {
  font-size: 18px;
  line-height: 1.7;
}

:deep(.mjx-container) {
  max-width: 100%;
  overflow-x: auto;
  display: block;
}

:deep(.mjx-container > svg) {
  max-width: 100%;
  height: auto;
}

.detail-media {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detail-media img {
  width: 100%;
  max-width: 720px;
  height: auto;
  object-fit: contain;
  border-radius: 10px;
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 16px;
  cursor: pointer;
  font-weight: 600;
  list-style: none;
  align-items: center;
}

.ai-summary-header::-webkit-details-marker {
  display: none;
}

.ai-summary-hint {
  grid-column: 1;
  font-size: 12px;
  color: #3f7de0;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ai-summary-status {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.ai-error {
  font-size: 12px;
  color: #c84c4c;
}

.ai-summary {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.risk-alert {
  border-radius: 12px;
  border: 1px solid rgba(220, 90, 90, 0.36);
  background: rgba(255, 239, 239, 0.72);
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}

.risk-alert-inline {
  margin-bottom: 10px;
}

.risk-title {
  font-size: 12px;
  font-weight: 700;
  color: #aa2a2a;
}

.risk-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.86);
}

.risk-item {
  display: grid;
  gap: 4px;
  align-items: start;
}

.risk-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-width: 82px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(220, 90, 90, 0.15);
  color: #aa2a2a;
}

.risk-message {
  white-space: pre-wrap;
  word-break: break-word;
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
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(182, 198, 226, 0.28);
  font-size: 12px;
  display: grid;
  gap: 6px;
}

.ai-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-item-key {
  font-weight: 700;
  color: rgba(26, 29, 51, 0.86);
}

.ai-item-score {
  font-weight: 700;
  color: #3f7de0;
}

.ai-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: rgba(26, 29, 51, 0.68);
}

.ai-item-meta .danger {
  color: #b42318;
  font-weight: 700;
}

.ai-point-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
}

.ai-uncertainty-list {
  margin-top: 8px;
  border-top: 1px dashed rgba(180, 194, 220, 0.5);
  padding-top: 8px;
}

.ai-uncertainty-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.8);
  margin-bottom: 4px;
}

.ai-uncertainty-list ul {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.8);
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

.grading-comment-rendered {
  min-height: 70px;
  cursor: text;
  white-space: normal;
}

.grading-comment-rendered.disabled {
  cursor: default;
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

.publish-actions {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.publish-button-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.graded-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.task-action.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.8);
  border: 1px solid rgba(173, 188, 216, 0.55);
  box-shadow: 0 4px 10px rgba(56, 76, 126, 0.08);
}

@media (max-width: 1500px) {
  .grading-layout {
    grid-template-columns: 160px 1fr;
  }

  .grading-panel {
    grid-column: span 2;
  }
}

@media (max-width: 1200px) {
  .grading-layout {
    grid-template-columns: 160px 1fr;
  }

  .grading-panel {
    grid-column: span 2;
  }

  .student-panel {
    position: static;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .batch-toolbar {
    align-items: flex-start;
  }

  .grading-layout {
    grid-template-columns: 1fr;
  }

  .student-panel {
    max-height: none;
  }

  .student-list {
    max-height: 340px;
  }
}
</style>
