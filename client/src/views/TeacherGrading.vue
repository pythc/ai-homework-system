<template>
  <TeacherLayout
    title="作业批改"
    subtitle="查看 AI 结果并保存本题成绩，完成后发布成绩"
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
                  <span>{{ group.title }}</span>
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
                      <span class="student-name">{{ student.name || '学生' }}</span>
                      <span class="student-sub">{{ formatStudentAccount(student) }}</span>
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
                v-html="renderMath(currentQuestion?.prompt?.text)"
              />
            </div>
            <div class="detail-block">
              <div class="detail-label">标准答案</div>
              <div
                class="detail-text"
                v-mathjax
                  v-html="renderMath(currentQuestion?.standardAnswer?.text)"
                />
              </div>
            </div>

            <div class="detail-section submission-content">
              <div class="detail-title">学生提交内容</div>
              <div
                v-if="selectedSubmission?.contentText"
                class="detail-text student-submission-text"
              >
                {{ selectedSubmission.contentText }}
              </div>
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
                  <div v-if="aiPanel.result?.result?.items?.length" class="ai-items">
                    <div v-for="(item, idx) in aiPanel.result?.result?.items" :key="idx" class="ai-item">
                      <div>评分项：{{ item.rubricItemKey || '-' }}</div>
                      <div>得分：{{ item.score ?? '-' }} / {{ item.maxScore ?? '-' }}</div>
                      <div class="ai-row">
                        <span class="ai-label">理由：</span>
                        <span class="ai-text" v-mathjax v-html="renderMath(item.reason)" />
                      </div>
                    </div>
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
                  class="grading-comment"
                  v-model="finalComment"
                  placeholder="本题评语（可选）"
                  :disabled="!canEditCurrent"
                />
              <div class="grading-actions">
                  <template v-if="selectedSubmission && canEditCurrent">
                    <button class="task-action" :disabled="saving" @click="submitGrading(false)">
                      {{ saving ? '提交中...' : '确认本题成绩' }}
                    </button>
                    <button class="task-action ghost" :disabled="saving" @click="submitGrading(true)">
                      直接采用 AI
                    </button>
                  </template>
                  <template v-else-if="selectedSubmission && selectedSubmission.isFinal">
                    <div class="graded-hint">已确认本题成绩</div>
                    <button class="task-action ghost" type="button" @click="startEdit">
                      修改成绩
                    </button>
                  </template>
                <div v-else class="graded-hint">该学生未提交，无法评分</div>
                <div v-if="saveError" class="ai-error">{{ saveError }}</div>
                <div v-if="saveSuccess" class="ai-success">已保存本题成绩</div>
              </div>
              <div class="publish-actions">
                <button
                  class="task-action"
                  type="button"
                  :disabled="publishLoading || !allFinalForStudent || publishLocked"
                  @click="publishScores"
                >
                  {{ publishLoading ? '发布中...' : '发布成绩' }}
                </button>
                <div v-if="publishError" class="ai-error">{{ publishError }}</div>
                <div v-if="publishSuccess" class="ai-success">已发布成绩</div>
                <div v-if="!allFinalForStudent" class="graded-hint">
                  需先确认该学生全部题目成绩
                </div>
              </div>
            </div>
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
import { getFinalGrading, submitFinalGrading } from '../api/grading'
import { publishAssignmentScores } from '../api/score'
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
const routeStudentId = computed(() => String(route.query.studentId ?? ''))

const submissions = ref<any[]>([])
const questions = ref<AssignmentSnapshotQuestion[]>([])
const loadError = ref('')
const questionMap = ref<Record<string, AssignmentSnapshotQuestion>>({})
const selectedQuestionId = ref('')
const selectedStudentId = ref('')
const openGroups = ref<Record<string, boolean>>({
  graded: true,
  pending: true,
  missing: false,
})

const students = computed(() => {
  const map = new Map<string, { studentId: string; name?: string | null; account?: string | null }>()
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
  return questions.value.find((q) => q.questionId === selectedQuestionId.value) || null
})

const submissionStatusLabel = computed(() => {
  if (!selectedSubmission.value) return '未提交'
  const isFinal = Boolean(selectedSubmission.value.isFinal ?? selectedSubmission.value.status === 'FINAL')
  return isFinal ? '已批改' : '未批改'
})

const submissionStatusTone = computed(() => {
  if (!selectedSubmission.value) return 'missing'
  const isFinal = Boolean(selectedSubmission.value.isFinal ?? selectedSubmission.value.status === 'FINAL')
  return isFinal ? 'graded' : 'pending'
})

const studentsWithStatus = computed(() =>
  students.value.map((student) => {
    const key = `${student.studentId}::${selectedQuestionId.value}`
    const submission = submissionByKey.value.get(key)
    if (!submission) {
      return { ...student, statusLabel: '未提交', statusTone: 'missing' }
    }
    const isFinal = Boolean(submission.isFinal ?? submission.status === 'FINAL')
    return {
      ...student,
      statusLabel: isFinal ? '已批改' : '未批改',
      statusTone: isFinal ? 'graded' : 'pending',
    }
  }),
)

const groupedStudents = computed(() => {
  const groups = [
    { key: 'graded', title: '已批改', items: [] as typeof studentsWithStatus.value },
    { key: 'pending', title: '未批改', items: [] as typeof studentsWithStatus.value },
    { key: 'missing', title: '未提交', items: [] as typeof studentsWithStatus.value },
  ]
  const map = new Map(groups.map((group) => [group.key, group]))
  studentsWithStatus.value.forEach((student) => {
    map.get(student.statusTone)?.items.push(student)
  })
  return groups
})

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
const totalScoreInput = ref(0)
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const editingOverride = ref(false)
const publishLoading = ref(false)
const publishError = ref('')
const publishSuccess = ref(false)
const publishOverrideByStudent = ref<Record<string, { published: boolean; dirty: boolean }>>({})

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

const selectQuestion = (questionId: string) => {
  selectedQuestionId.value = questionId
  editingOverride.value = false
  saveSuccess.value = false
}

const selectStudent = (studentId: string) => {
  selectedStudentId.value = studentId
  editingOverride.value = false
  saveSuccess.value = false
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

const allFinalForStudent = computed(() => {
  if (!selectedStudentId.value) return false
  if (!questions.value.length) return false
  return questions.value.every((question) => {
    const key = `${selectedStudentId.value}::${question.questionId}`
    const submission = submissionByKey.value.get(key)
    return submission && Boolean(submission.isFinal ?? submission.status === 'FINAL')
  })
})

const basePublishedForStudent = (studentId: string) => {
  if (!studentId) return false
  if (!questions.value.length) return false
  return questions.value.every((question) => {
    const key = `${studentId}::${question.questionId}`
    const submission = submissionByKey.value.get(key)
    return submission && submission.scorePublished === true
  })
}

const publishStateForStudent = computed(() => {
  const studentId = selectedStudentId.value
  if (!studentId) return { published: false, dirty: false }
  const override = publishOverrideByStudent.value[studentId]
  if (override) return override
  return { published: basePublishedForStudent(studentId), dirty: false }
})

const publishLocked = computed(
  () => publishStateForStudent.value.published && !publishStateForStudent.value.dirty,
)

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
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
  } catch (err) {
    gradingItems.value = buildGradingItems(question, aiPanel.value.result)
    finalComment.value = ''
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
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
    totalScoreInput.value = gradingItems.value.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0,
    )
    clampTotalScore()
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
        { useAiReasons: true },
      )
      finalComment.value = aiPanel.value.result.result?.comment ?? ''
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
    saveSuccess.value = true
    submission.isFinal = true
    submission.status = 'FINAL'
    if (selectedStudentId.value) {
      const prev = publishOverrideByStudent.value[selectedStudentId.value]
      publishOverrideByStudent.value[selectedStudentId.value] = {
        published: prev?.published ?? basePublishedForStudent(selectedStudentId.value),
        dirty: true,
      }
    }
    editingOverride.value = false
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const startEdit = () => {
  editingOverride.value = true
}

const publishScores = async () => {
  if (!assignmentId.value || !selectedStudentId.value) return
  if (!allFinalForStudent.value) {
    publishError.value = '题目未全部确认'
    return
  }
  if (publishLocked.value) {
    publishError.value = '成绩已发布'
    return
  }
  publishLoading.value = true
  publishError.value = ''
  publishSuccess.value = false
  try {
    await publishAssignmentScores(assignmentId.value, selectedStudentId.value)
    publishSuccess.value = true
    const studentId = selectedStudentId.value
    submissions.value.forEach((item) => {
      if (item.student?.studentId === studentId) {
        item.scorePublished = true
      }
    })
    publishOverrideByStudent.value[studentId] = { published: true, dirty: false }
  } catch (err) {
    publishError.value = err instanceof Error ? err.message : '发布失败'
  } finally {
    publishLoading.value = false
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

watch(
  () => selectedSubmission.value,
  async (submission) => {
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
  },
  { immediate: true },
)

watch(
  () => selectedQuestionId.value,
  () => {
    saveSuccess.value = false
  },
)

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
    const sorted = [...(snapshot?.questions ?? [])].sort(
      (a, b) => a.questionIndex - b.questionIndex,
    )
    sorted.forEach((q) => {
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
  display: grid;
  gap: 10px;
  position: sticky;
  top: 16px;
  align-self: start;
}

.student-title {
  font-weight: 600;
}

.student-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.student-list {
  display: grid;
  gap: 8px;
  max-height: none;
  overflow: visible;
}

.student-group {
  display: grid;
  gap: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  padding: 8px;
}

.student-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.75);
  padding: 6px 4px;
  cursor: pointer;
  border-bottom: 1px solid rgba(120, 140, 190, 0.15);
  list-style: none;
}

.student-group-title::before {
  content: '▾';
  font-size: 12px;
  margin-right: 6px;
  color: rgba(26, 29, 51, 0.55);
  transition: transform 0.2s ease;
}

.student-group[open] .student-group-title::before {
  transform: rotate(180deg);
}

.student-group-count {
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

.detail-status.pending {
  background: rgba(255, 196, 154, 0.35);
  color: #9a4a12;
}

.detail-status.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
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
  color: rgba(26, 29, 51, 0.55);
  font-weight: 500;
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

.publish-actions {
  margin-top: 12px;
  display: grid;
  gap: 8px;
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
  }
}

@media (max-width: 900px) {
  .grading-layout {
    grid-template-columns: 1fr;
  }

  .student-list {
    max-height: none;
  }
}
</style>
