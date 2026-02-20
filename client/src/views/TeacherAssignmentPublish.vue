<template>
  <TeacherLayout
    title="发布作业"
    subtitle="从题库选择题目并发布"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
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

    <section class="panel glass step-panel">
      <div class="panel-title">发布流程</div>
      <div class="stepper">
        <button class="step-item" :class="{ active: step === 1 }" @click="step = 1">
          1. 作业信息
        </button>
        <span class="step-arrow" aria-hidden="true">→</span>
        <button
          class="step-item"
          :class="{ active: step === 2 }"
          :disabled="!canEnterStep2"
          @click="step = 2"
        >
          2. 题库筛选
        </button>
        <span class="step-arrow" aria-hidden="true">→</span>
        <button
          class="step-item"
          :class="{ active: step === 3 }"
          :disabled="!canEnterStep3"
          @click="step = 3"
        >
          3. 权重与发布
        </button>
      </div>
    </section>

    <section v-if="step === 1" class="panel glass">
      <div class="panel-title">作业信息</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-field">
            <label>选择课程/班级</label>
            <select v-model="selectedCourseId" @change="handleCourseChange">
              <option value="">请选择课程/班级</option>
              <option v-for="course in courses" :key="course.id" :value="course.id">
                {{ course.name }}（{{ course.semester }}）
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>作业标题</label>
            <input v-model="title" type="text" placeholder="例如：第 3 章作业" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>截止时间</label>
            <input v-model="deadline" type="datetime-local" />
          </div>
          <div class="form-field">
            <label>作业总分</label>
            <input v-model.number="totalScore" type="number" min="1" step="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>AI 辅助批改</label>
            <div class="checkbox-row">
              <input id="ai-enabled" v-model="aiEnabled" type="checkbox" />
              <label for="ai-enabled">启用 AI 批改</label>
            </div>
          </div>
          <div class="form-field">
            <label>低置信度阈值</label>
            <div class="threshold-input-row">
              <input
                v-model.number="aiConfidenceThreshold"
                type="number"
                min="0"
                max="1"
                step="0.05"
                :disabled="!aiEnabled"
              />
              <span class="helper-text">低于阈值将自动标记为“有异议”</span>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>学生端可见性</label>
            <div class="checkbox-stack">
              <label class="checkbox-item">
                <input v-model="visibleAfterSubmit" type="checkbox" />
                学生提交后作业仍可见
              </label>
              <label class="checkbox-item">
                <input v-model="allowViewAnswer" type="checkbox" />
                允许学生查看标准答案
              </label>
              <label class="checkbox-item">
                <input v-model="allowViewScore" type="checkbox" />
                教师批改后允许学生查看分数
              </label>
              <label class="checkbox-item">
                <input v-model="handwritingRecognition" type="checkbox" />
                启用手写识别批改模式
              </label>
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>作业说明</label>
          <textarea v-model="description" placeholder="可选：填写作业要求或说明" />
        </div>
      </div>
      <div class="step-actions">
        <button class="primary-btn" type="button" :disabled="!canEnterStep2" @click="step = 2">
          下一步
        </button>
      </div>
    </section>

    <section v-if="step === 2" class="panel glass">
      <div class="panel-title">
        题库筛选
        <span class="badge">{{ selectedQuestionIds.size }} 题已选择</span>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-field">
            <label>课本</label>
            <select v-model="selectedTextbookId" @change="handleTextbookChange">
              <option value="">请选择课本</option>
              <option v-for="book in textbooks" :key="book.id" :value="book.id">
                {{ book.title }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>章节</label>
            <div class="form-row">
              <div class="form-field">
                <select v-model="selectedParentChapterId" @change="handleParentChapterChange">
                  <option value="">请选择大章节</option>
                  <option
                    v-for="chapter in parentChapterOptions"
                    :key="chapter.id"
                    :value="chapter.id"
                  >
                    {{ chapter.title }}
                  </option>
                </select>
              </div>
              <div class="form-field">
                <select v-model="selectedChapterId">
                  <option value="">请选择小章节</option>
                  <option v-for="chapter in childChapterOptions" :key="chapter.id" :value="chapter.id">
                    {{ chapter.title }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="question-select-actions">
          <button class="primary-btn" type="button" @click="selectAllVisible">
            全选当前章节
          </button>
          <button class="primary-btn" type="button" @click="clearSelection">
            清空选择
          </button>
          <div class="question-select-count">
            当前可选 {{ filteredQuestions.length }} 题
          </div>
        </div>
      </div>
      <div class="qb-list" :class="{ 'qb-list-scroll': !expandQuestionList }" style="margin-top: 14px;">
        <div
          v-for="item in visibleQuestions"
          :key="item.id"
          class="qb-item qb-question"
          :class="{ 'is-child': item.depth > 0, active: selectedQuestionIds.has(item.id) }"
        >
          <div class="qb-item-title">
            <input
              v-if="item.nodeType === 'LEAF' || item.nodeType === 'GROUP'"
              type="checkbox"
              :checked="item.nodeType === 'GROUP' ? isGroupChecked(item.id) : selectedQuestionIds.has(item.id)"
              @change="toggleQuestion(item.id)"
            />
            <span v-if="item.depth" class="qb-indent" />
            <span
              v-if="item.isExpandable"
              class="qb-expand"
              @click.stop="toggleExpand(item.id)"
            >
              {{ expandedIds.has(item.id) ? '▾' : '▸' }}
            </span>
            <span
              class="qb-title-text"
              @click="item.isExpandable ? toggleExpand(item.id) : viewDetail(item.id)"
            >
              {{ getItemTitle(item) }}
            </span>
            <span
              v-if="item.isExpandable && getStemText(item)"
              class="qb-stem"
              v-mathjax
              v-html="renderStemHtml(item)"
            />
            <span
              v-if="item.nodeType === 'LEAF' && getQuestionPreview(item)"
              class="qb-preview-inline"
              v-mathjax
              v-html="getQuestionPreview(item)"
            />
            <button
              class="qb-action qb-detail-btn"
              type="button"
              @click.stop="viewDetail(item.id)"
            >
              详情
            </button>
          </div>
        </div>
        <div v-if="!filteredQuestions.length" class="empty-box">
          {{ questionError || '暂无题目' }}
        </div>
      </div>
      <div v-if="filteredQuestions.length > 12" class="qb-footer">
        <button class="qb-toggle" type="button" @click="expandQuestionList = !expandQuestionList">
          {{ expandQuestionList ? '收起列表' : '展开全部' }}
        </button>
        <div class="helper-text">可滚动浏览更多题目</div>
      </div>
      <div class="step-actions">
        <button class="primary-btn ghost" type="button" @click="step = 1">
          上一步
        </button>
        <button class="primary-btn" type="button" :disabled="!canEnterStep3" @click="step = 3">
          下一步
        </button>
      </div>
    </section>

    <section v-if="step === 3" class="panel glass">
      <div class="panel-title">
        题目权重
        <span class="badge">合计 {{ weightSum.toFixed(2) }}%</span>
      </div>
      <div v-if="!orderedSelectedQuestions.length" class="empty-box">请先选择题目</div>
      <div v-else class="weight-list">
        <div
          v-for="(question, index) in orderedSelectedQuestions"
          :key="question.id"
          class="weight-row"
        >
          <div class="weight-title">
            <div class="weight-index">第 {{ index + 1 }} 题</div>
            <div v-if="getParentPromptText(question)" class="weight-parent" v-mathjax>
              <div v-html="getParentPromptText(question)" />
            </div>
            <div class="weight-label" v-mathjax v-html="getWeightLabel(question)" />
          </div>
          <input
            v-model.number="questionWeights[question.id]"
            type="number"
            min="0"
            max="100"
            step="0.1"
            class="weight-input"
          />
          <span class="weight-suffix">%</span>
        </div>
        <div class="weight-actions">
          <button class="primary-btn" type="button" @click="autoBalanceWeights">
            平均分配
          </button>
          <span class="helper-text">权重合计需为 100%</span>
        </div>
      </div>
    </section>

    <section v-if="step === 3" class="panel glass">
      <div class="panel-title">发布</div>
      <div class="ai-estimate-card" :class="{ disabled: !aiEnabled }">
        <div class="estimate-header">
          <div class="estimate-title">AI 批改开销预估</div>
          <span class="estimate-hint">仅为发布前估算，实际以提交与重试为准</span>
        </div>
        <div v-if="!aiEnabled" class="estimate-disabled-text">
          当前未启用 AI 批改，不会产生 AI 批改成本。
        </div>
        <template v-else>
          <div class="estimate-grid">
            <div class="estimate-item">
              <div class="estimate-label">预计批改任务</div>
              <div class="estimate-value">{{ formatNumber(estimatedAiRuns) }}</div>
              <div class="estimate-sub">学生数 × 题目数</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计输入 Token</div>
              <div class="estimate-value">{{ formatNumber(estimatedInputTokens) }}</div>
              <div class="estimate-sub">含题目、标准答案、评分细则、图片识别内容</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计输出 Token</div>
              <div class="estimate-value">{{ formatNumber(estimatedOutputTokens) }}</div>
              <div class="estimate-sub">含分项评分、总评、置信度与存疑原因</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计批改时长</div>
              <div class="estimate-value">约 {{ estimatedMinutes }} 分钟</div>
              <div class="estimate-sub">按单任务 {{ estimatedSecondsPerRun }} 秒估算</div>
            </div>
          </div>
          <div class="estimate-foot">
            阈值 {{ aiConfidenceThreshold.toFixed(2) }} ·
            {{ handwritingRecognition ? '手写识别模式' : '标准识别模式' }} ·
            当前课程已有 {{ courseAssignmentCount }} 份作业
          </div>
        </template>
      </div>
      <div class="form-actions">
        <button
          class="primary-btn"
          type="button"
          :disabled="submitLoading || !canPublish"
          @click="handlePublish"
        >
          {{ submitLoading ? '发布中...' : '发布作业' }}
        </button>
        <button class="primary-btn ghost" type="button" @click="step = 2">
          上一步
        </button>
        <span class="helper-text">发布后学生可在作业库看到</span>
      </div>
      <div v-if="submitError" class="form-error">{{ submitError }}</div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getCourseSummary, listCourses } from '../api/course'
import { getQuestionBankStructure, listQuestionBank } from '../api/questionBank'
import { createAssignment, listTeacherAssignments, publishAssignment } from '../api/assignment'
import { showAppToast } from '../composables/useAppToast'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()
const route = useRoute()
const courses = ref([])
const textbooks = ref([])
const chapters = ref([])
const questions = ref([])
const expandedIds = ref(new Set())

const selectedCourseId = ref('')
const selectedTextbookId = ref('')
const selectedParentChapterId = ref('')
const selectedChapterId = ref('')

const title = ref('')
const description = ref('')
const deadline = ref('')
const aiEnabled = ref(true)
const aiConfidenceThreshold = ref(0.75)
const visibleAfterSubmit = ref(true)
const allowViewAnswer = ref(false)
const allowViewScore = ref(true)
const handwritingRecognition = ref(false)
const totalScore = ref(100)
const courseStudentCount = ref(0)
const courseAssignmentCount = ref(0)

const selectedQuestionIds = ref(new Set())
const selectedQuestionOrder = ref([])
const isHydrating = ref(true)
const questionWeights = ref({})
const expandQuestionList = ref(false)
const step = ref(1)

const questionError = ref('')
const submitError = ref('')
const submitLoading = ref(false)

const normalizeConfidenceThreshold = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.75
  if (num < 0) return 0
  if (num > 1) return 1
  return Number(num.toFixed(3))
}

const selectedQuestionCount = computed(() =>
  selectedQuestionOrder.value.filter((id) => selectedQuestionIds.value.has(id)).length,
)

const estimatedAiRuns = computed(() =>
  aiEnabled.value ? courseStudentCount.value * selectedQuestionCount.value : 0,
)

const estimatedSecondsPerRun = computed(() =>
  handwritingRecognition.value ? 2.2 : 1.6,
)

const estimatedInputPerRun = computed(() => {
  const base = handwritingRecognition.value ? 1400 : 1100
  const questionFactor = Math.max(selectedQuestionCount.value, 1) * 120
  return base + questionFactor
})

const estimatedOutputPerRun = computed(() => 220 + Math.max(selectedQuestionCount.value, 1) * 25)

const estimatedInputTokens = computed(() => Math.round(estimatedAiRuns.value * estimatedInputPerRun.value))
const estimatedOutputTokens = computed(() =>
  Math.round(estimatedAiRuns.value * estimatedOutputPerRun.value),
)
const estimatedMinutes = computed(() =>
  estimatedAiRuns.value <= 0
    ? 0
    : Math.max(1, Math.round((estimatedAiRuns.value * estimatedSecondsPerRun.value) / 60)),
)

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('zh-CN')

const STORAGE_KEY = 'teacher.assignment.publish.filters'
const FORM_KEY = 'teacher.assignment.publish.form'

const hydrateFilters = async () => {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  const stored = raw ? JSON.parse(raw) : null
  const courseId = String(route.query.courseId ?? '') || stored?.courseId || ''
  const textbookId = String(route.query.textbookId ?? '') || stored?.textbookId || ''
  const parentChapterId =
    String(route.query.parentChapterId ?? '') || stored?.parentChapterId || ''
  const chapterId = String(route.query.chapterId ?? '') || stored?.chapterId || ''
  if (!courseId) return
  selectedCourseId.value = courseId
  await handleCourseChange({ keepSelection: true })
  selectedTextbookId.value = textbookId || ''
  selectedParentChapterId.value = parentChapterId || ''
  selectedChapterId.value = chapterId || ''
}

const persistFilters = () => {
  const payload = {
    courseId: selectedCourseId.value,
    textbookId: selectedTextbookId.value,
    parentChapterId: selectedParentChapterId.value,
    chapterId: selectedChapterId.value,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  router.replace({
    query: {
      ...route.query,
      courseId: payload.courseId || undefined,
      textbookId: payload.textbookId || undefined,
      parentChapterId: payload.parentChapterId || undefined,
      chapterId: payload.chapterId || undefined,
    },
  })
}

const hydrateForm = async () => {
  const raw = sessionStorage.getItem(FORM_KEY)
  if (!raw) return
  try {
    const payload = JSON.parse(raw)
    if (payload?.selectedCourseId) {
      selectedCourseId.value = payload.selectedCourseId
      await handleCourseChange({ keepSelection: true })
    }
    selectedTextbookId.value = payload?.selectedTextbookId ?? selectedTextbookId.value
    selectedParentChapterId.value =
      payload?.selectedParentChapterId ?? selectedParentChapterId.value
    selectedChapterId.value = payload?.selectedChapterId ?? selectedChapterId.value
    if (selectedChapterId.value && !selectedParentChapterId.value) {
      const match = chapters.value.find((item) => item.id === selectedChapterId.value)
      if (match?.parentId) {
        selectedParentChapterId.value = match.parentId
      }
    }
    title.value = payload?.title ?? title.value
    description.value = payload?.description ?? description.value
    deadline.value = payload?.deadline ?? deadline.value
    aiEnabled.value =
      typeof payload?.aiEnabled === 'boolean' ? payload.aiEnabled : aiEnabled.value
    visibleAfterSubmit.value =
      typeof payload?.visibleAfterSubmit === 'boolean'
        ? payload.visibleAfterSubmit
        : visibleAfterSubmit.value
    allowViewAnswer.value =
      typeof payload?.allowViewAnswer === 'boolean'
        ? payload.allowViewAnswer
        : allowViewAnswer.value
    allowViewScore.value =
      typeof payload?.allowViewScore === 'boolean'
        ? payload.allowViewScore
        : allowViewScore.value
    handwritingRecognition.value =
      typeof payload?.handwritingRecognition === 'boolean'
        ? payload.handwritingRecognition
        : handwritingRecognition.value
    aiConfidenceThreshold.value =
      typeof payload?.aiConfidenceThreshold === 'number'
        ? normalizeConfidenceThreshold(payload.aiConfidenceThreshold)
        : aiConfidenceThreshold.value
    totalScore.value =
      typeof payload?.totalScore === 'number' ? payload.totalScore : totalScore.value
    step.value = payload?.step ?? step.value

    const ids = Array.isArray(payload?.selectedQuestionIds)
      ? payload.selectedQuestionIds
      : []
    const order = Array.isArray(payload?.selectedQuestionOrder)
      ? payload.selectedQuestionOrder
      : []
    selectedQuestionIds.value = new Set(ids)
    selectedQuestionOrder.value = order.length ? order : ids
    questionWeights.value = payload?.questionWeights ?? {}
    expandQuestionList.value = payload?.expandQuestionList ?? false

    const stepFromQuery = Number(route.query.step ?? 0)
    if ([1, 2, 3].includes(stepFromQuery)) {
      step.value = stepFromQuery
    }
  } catch {
    // ignore
  }
}

const persistForm = () => {
  const payload = {
    selectedCourseId: selectedCourseId.value,
    selectedTextbookId: selectedTextbookId.value,
    selectedParentChapterId: selectedParentChapterId.value,
    selectedChapterId: selectedChapterId.value,
    title: title.value,
    description: description.value,
    deadline: deadline.value,
    aiEnabled: aiEnabled.value,
    visibleAfterSubmit: visibleAfterSubmit.value,
    allowViewAnswer: allowViewAnswer.value,
    allowViewScore: allowViewScore.value,
    handwritingRecognition: handwritingRecognition.value,
    aiConfidenceThreshold: aiConfidenceThreshold.value,
    totalScore: totalScore.value,
    step: step.value,
    selectedQuestionIds: Array.from(selectedQuestionIds.value),
    selectedQuestionOrder: selectedQuestionOrder.value,
    questionWeights: questionWeights.value,
    expandQuestionList: expandQuestionList.value,
  }
  sessionStorage.setItem(FORM_KEY, JSON.stringify(payload))
}

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
  isHydrating.value = true
  await hydrateFilters()
  await hydrateForm()
  isHydrating.value = false
})

watch([selectedCourseId, selectedTextbookId, selectedParentChapterId, selectedChapterId], () => {
  if (isHydrating.value) return
  persistFilters()
})

watch(selectedQuestionIds, () => {
  syncWeights()
})

watch(
  [
    selectedCourseId,
    selectedTextbookId,
    selectedParentChapterId,
    selectedChapterId,
    title,
    description,
    deadline,
    aiEnabled,
    visibleAfterSubmit,
    allowViewAnswer,
    allowViewScore,
    handwritingRecognition,
    aiConfidenceThreshold,
    totalScore,
    step,
    selectedQuestionIds,
    questionWeights,
    expandQuestionList,
  ],
  () => {
    if (isHydrating.value) return
    persistForm()
  },
  { deep: true },
)

const fetchCourses = async () => {
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const loadCourseSummary = async (courseId) => {
  if (!courseId) {
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
    return
  }
  try {
    const summary = await getCourseSummary(courseId)
    courseStudentCount.value = Number(summary?.studentCount ?? 0)
    courseAssignmentCount.value = Number(summary?.assignmentCount ?? 0)
  } catch {
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
  }
}

const handleCourseChange = async (options = { keepSelection: false }) => {
  selectedTextbookId.value = ''
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
  if (!options.keepSelection) {
    selectedQuestionIds.value = new Set()
    selectedQuestionOrder.value = []
    questionWeights.value = {}
  }
  questionError.value = ''
  if (!selectedCourseId.value) {
    textbooks.value = []
    chapters.value = []
    questions.value = []
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
    return
  }
  try {
    const [response] = await Promise.all([
      getQuestionBankStructure(),
      loadCourseSummary(selectedCourseId.value),
    ])
    textbooks.value = response.textbooks ?? []
    chapters.value = response.chapters ?? []
    questions.value = await listQuestionBank()
    if (selectedChapterId.value && !selectedParentChapterId.value) {
      const match = chapters.value.find((item) => item.id === selectedChapterId.value)
      if (match?.parentId) {
        selectedParentChapterId.value = match.parentId
      }
    }
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载题库失败'
  }
}

const handleTextbookChange = () => {
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
}

const parentChapterOptions = computed(() => {
  if (!selectedTextbookId.value) return []
  const items = chapters.value.filter(
    (chapter) => chapter.textbookId === selectedTextbookId.value,
  )
  if (!items.length) return []
  const parentIds = new Set(items.map((item) => item.parentId).filter(Boolean))
  return items
    .filter((item) => parentIds.has(item.id) || !item.parentId)
    .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const childChapterOptions = computed(() => {
  if (!selectedParentChapterId.value) return []
  return chapters.value
    .filter((chapter) => chapter.parentId === selectedParentChapterId.value)
    .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const handleParentChapterChange = () => {
  selectedChapterId.value = ''
}

const chapterIdsByTextbook = computed(() => {
  if (!selectedTextbookId.value) return new Set()
  return new Set(
    chapters.value
      .filter((chapter) => chapter.textbookId === selectedTextbookId.value)
      .map((chapter) => chapter.id),
  )
})

const getQuestionLabel = (item) => {
  const title = item.title?.trim()
  if (title) return title
  if (typeof item.prompt === 'string') return item.prompt.slice(0, 24)
  if (item.prompt?.text) return String(item.prompt.text).slice(0, 24)
  return '未命名题目'
}

const filteredQuestions = computed(() => {
  if (!selectedChapterId.value) return []
  return questions.value
    .filter((item) => {
      return item.chapterId === selectedChapterId.value
    })
    .map((item) => ({
      ...item,
      label: getQuestionLabel(item),
    }))
})

const flattenedQuestions = computed(() => {
  const byParent = new Map()
  filteredQuestions.value.forEach((item, idx) => {
    const parentId = item.parentId ?? ''
    if (!byParent.has(parentId)) {
      byParent.set(parentId, [])
    }
    byParent.get(parentId).push({ ...item, __index: idx })
  })
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const aIndex = parseQuestionIndex(a)
      const bIndex = parseQuestionIndex(b)
      if (aIndex !== null || bIndex !== null) {
        if (aIndex === null) return 1
        if (bIndex === null) return -1
        return aIndex - bIndex
      }
      const aHas = a.orderNo !== null && a.orderNo !== undefined
      const bHas = b.orderNo !== null && b.orderNo !== undefined
      if (aHas !== bHas) return aHas ? -1 : 1
      if (aHas && bHas) return Number(a.orderNo) - Number(b.orderNo)
      return a.__index - b.__index
    })
  }

  const result = []
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId) ?? []
    for (const [index, child] of children.entries()) {
      const isExpandable = (byParent.get(child.id) ?? []).length > 0
      const displayOrder = child.orderNo ?? index + 1
      const { __index, ...rest } = child
      result.push({ ...rest, depth, isExpandable, displayOrder })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return result
})

const visibleQuestions = computed(() => {
  const byId = new Map(flattenedQuestions.value.map((item) => [item.id, item]))
  const list = flattenedQuestions.value.filter((item) => {
    let parentId = item.parentId ?? ''
    while (parentId) {
      if (!expandedIds.value.has(parentId)) return false
      const parent = byId.get(parentId)
      if (!parent) break
      parentId = parent.parentId ?? ''
    }
    return true
  })
  if (expandQuestionList.value) return list
  return list.slice(0, 12)
})


const toggleQuestion = (id) => {
  const item = questions.value.find((q) => q.id === id)
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]
  if (!item) return

  if (item.nodeType === 'GROUP') {
    const leafIds = getDescendantLeafIdsInOrder(item.id)
    if (!leafIds.length) return
    const allSelected = leafIds.every((leafId) => next.has(leafId))
    if (allSelected) {
      leafIds.forEach((leafId) => next.delete(leafId))
      const removeSet = new Set(leafIds)
      const filtered = order.filter((leafId) => !removeSet.has(leafId))
      selectedQuestionIds.value = next
      selectedQuestionOrder.value = filtered
      return
    }
    const orderSet = new Set(order)
    leafIds.forEach((leafId) => next.add(leafId))
    leafIds.forEach((leafId) => {
      if (!orderSet.has(leafId)) {
        order.push(leafId)
        orderSet.add(leafId)
      }
    })
    selectedQuestionIds.value = next
    selectedQuestionOrder.value = order
    return
  }

  if (next.has(id)) {
    next.delete(id)
    const index = order.indexOf(id)
    if (index >= 0) order.splice(index, 1)
  } else {
    next.add(id)
    order.push(id)
  }
  selectedQuestionIds.value = next
  selectedQuestionOrder.value = order
}

const selectAllVisible = () => {
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]
  for (const item of visibleQuestions.value) {
    if (item.nodeType === 'LEAF') {
      next.add(item.id)
      if (!order.includes(item.id)) {
        order.push(item.id)
      }
    }
  }
  selectedQuestionIds.value = next
  selectedQuestionOrder.value = order
}

const clearSelection = () => {
  selectedQuestionIds.value = new Set()
  selectedQuestionOrder.value = []
}

const toggleExpand = (questionId) => {
  const next = new Set(expandedIds.value)
  if (next.has(questionId)) {
    next.delete(questionId)
  } else {
    next.add(questionId)
  }
  expandedIds.value = next
}

const getStemText = (item) => {
  if (!item?.stem) return ''
  if (typeof item.stem === 'string') return item.stem
  return item.stem.text ?? ''
}

const getQuestionPreviewText = (item) => {
  if (!item) return ''
  const stem = getStemText(item)
  if (stem) return stem
  if (typeof item.prompt === 'string') return item.prompt
  if (item.prompt?.text) return item.prompt.text
  if (item.description) return item.description
  return ''
}

const getQuestionPreview = (item) => {
  const text = getQuestionPreviewText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const renderStemHtml = (item) => {
  const text = getStemText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const getItemTitle = (item) => {
  if (item?.title) return item.title
  if (item?.depth > 0) return `（${item.displayOrder ?? 1}）`
  return '未命名'
}

const parseQuestionIndex = (item) => {
  const title = item?.title ?? ''
  const label = item?.label ?? ''
  const text = `${title} ${label}`
  const match = text.match(/第\s*(\d+)\s*题/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const questionById = computed(() => new Map(questions.value.map((item) => [item.id, item])))
const filteredQuestionById = computed(
  () => new Map(filteredQuestions.value.map((item) => [item.id, item])),
)

const orderedSelectedQuestions = computed(() => {
  const map = questionById.value
  return selectedQuestionOrder.value
    .map((id) => map.get(id))
    .filter((item) => item && item.nodeType === 'LEAF')
})

const isDescendantOf = (itemId, ancestorId) => {
  let current = filteredQuestionById.value.get(itemId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = filteredQuestionById.value.get(current.parentId)
  }
  return false
}

const getDescendantLeafIdsInOrder = (groupId) =>
  flattenedQuestions.value
    .filter((item) => item.nodeType === 'LEAF' && isDescendantOf(item.id, groupId))
    .map((item) => item.id)

const isGroupChecked = (groupId) => {
  const ids = getDescendantLeafIdsInOrder(groupId)
  if (!ids.length) return false
  return ids.every((id) => selectedQuestionIds.value.has(id))
}

const weightSum = computed(() =>
  Object.values(questionWeights.value).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  ),
)

const canEnterStep2 = computed(() => {
  if (!selectedCourseId.value) return false
  if (!title.value.trim()) return false
  return true
})

const canEnterStep3 = computed(() => {
  if (selectedQuestionIds.value.size > 0) return true
  if (selectedQuestionOrder.value.length > 0) return true
  return questions.value.some((item) => selectedQuestionIds.value.has(item.id))
})

const canPublish = computed(() => {
  if (!selectedQuestionIds.value.size) return false
  if (!Number.isFinite(Number(totalScore.value)) || Number(totalScore.value) <= 0) return false
  if (
    !Number.isFinite(Number(aiConfidenceThreshold.value)) ||
    Number(aiConfidenceThreshold.value) < 0 ||
    Number(aiConfidenceThreshold.value) > 1
  )
    return false
  return Math.abs(weightSum.value - 100) <= 0.01
})

const syncWeights = () => {
  const ids = Array.from(selectedQuestionIds.value)
  const next = { ...questionWeights.value }
  let changed = false

  for (const id of ids) {
    if (next[id] === undefined) {
      next[id] = 0
      changed = true
    }
  }
  for (const id of Object.keys(next)) {
    if (!selectedQuestionIds.value.has(id)) {
      delete next[id]
      changed = true
    }
  }
  const hasAny = ids.length > 0
  const sum = Object.values(next).reduce((acc, val) => acc + (Number(val) || 0), 0)
  if (hasAny && sum === 0) {
    const equal = Number((100 / ids.length).toFixed(2))
    ids.forEach((id, index) => {
      next[id] =
        index === ids.length - 1
          ? Number((100 - equal * (ids.length - 1)).toFixed(2))
          : equal
    })
    changed = true
  }

  if (changed) {
    questionWeights.value = next
  }

  const order = selectedQuestionOrder.value.filter((id) =>
    selectedQuestionIds.value.has(id),
  )
  if (order.length !== selectedQuestionOrder.value.length) {
    selectedQuestionOrder.value = order
  }
}

const autoBalanceWeights = () => {
  const ids = [...selectedQuestionOrder.value].filter((id) =>
    selectedQuestionIds.value.has(id),
  )
  if (!ids.length) return
  const equal = Number((100 / ids.length).toFixed(2))
  const next = {}
  ids.forEach((id, index) => {
    next[id] =
      index === ids.length - 1
        ? Number((100 - equal * (ids.length - 1)).toFixed(2))
        : equal
  })
  questionWeights.value = next
}

const getParentPromptText = (question) => {
  if (!question?.parentId) return ''
  const map = questionById.value
  let current = map.get(question.parentId)
  while (current) {
    const text =
      (typeof current.stem === 'string' ? current.stem : current.stem?.text) ||
      (typeof current.prompt === 'string' ? current.prompt : current.prompt?.text) ||
      current.description ||
      ''
    if (text) return text.replace(/\n/g, '<br />')
    current = current.parentId ? map.get(current.parentId) : null
  }
  return ''
}

const getWeightLabel = (question) => {
  const text = getQuestionPreviewText(question)
  if (!text) return getQuestionLabel(question)
  return text.replace(/\n/g, '<br />')
}

const viewDetail = (questionId) => {
  router.push({
    path: `/teacher/question-bank/questions/${questionId}`,
    query: {
      from: 'publish',
      step: String(step.value),
      courseId: selectedCourseId.value || undefined,
      textbookId: selectedTextbookId.value || undefined,
      parentChapterId: selectedParentChapterId.value || undefined,
      chapterId: selectedChapterId.value || undefined,
    },
  })
}

const handlePublish = async () => {
  submitError.value = ''

  if (!selectedCourseId.value) {
    submitError.value = '请先选择课程'
    return
  }
  if (!title.value.trim()) {
    submitError.value = '请填写作业标题'
    return
  }
  if (!selectedQuestionIds.value.size) {
    submitError.value = '请至少选择一道题目'
    return
  }

  if (submitLoading.value) return
  submitLoading.value = true
  try {
    const normalizedTitle = title.value.trim().toLowerCase()
    const teacherAssignments = await listTeacherAssignments()
    const duplicateExists = (teacherAssignments.items ?? []).some((item) => {
      const itemCourseId = String(item.courseId ?? '')
      const itemTitle = String(item.title ?? '').trim().toLowerCase()
      return itemCourseId === selectedCourseId.value && itemTitle === normalizedTitle
    })
    if (duplicateExists) {
      submitError.value = '同一课程下作业标题已存在，请更换后再发布'
      return
    }

    const created = await createAssignment({
      courseId: selectedCourseId.value,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      deadline: deadline.value || undefined,
      totalScore: Number(totalScore.value) || 100,
      aiEnabled: aiEnabled.value,
      visibleAfterSubmit: visibleAfterSubmit.value,
      allowViewAnswer: allowViewAnswer.value,
      allowViewScore: allowViewScore.value,
      handwritingRecognition: handwritingRecognition.value,
      aiConfidenceThreshold: normalizeConfidenceThreshold(aiConfidenceThreshold.value),
      selectedQuestionIds: Array.from(selectedQuestionIds.value),
    })
    const assignmentId = created.id
    const weightsPayload = Array.from(selectedQuestionIds.value).map((id) => ({
      questionId: id,
      weight: Number(questionWeights.value[id] ?? 0),
    }))
    await publishAssignment(assignmentId, { questionWeights: weightsPayload })
    showAppToast('作业发布成功', 'success')
    sessionStorage.removeItem(FORM_KEY)
    selectedCourseId.value = ''
    selectedTextbookId.value = ''
    selectedChapterId.value = ''
    title.value = ''
    description.value = ''
    deadline.value = ''
    aiEnabled.value = true
    visibleAfterSubmit.value = true
    allowViewAnswer.value = false
    allowViewScore.value = true
    handwritingRecognition.value = false
    aiConfidenceThreshold.value = 0.75
    totalScore.value = 100
    selectedQuestionIds.value = new Set()
    selectedQuestionOrder.value = []
    questionWeights.value = {}
    expandQuestionList.value = false
    step.value = 1
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '发布失败'
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped>
.weight-list {
  display: grid;
  gap: 10px;
}

.weight-row {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
}

.weight-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.85);
}

.weight-index {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.weight-label {
  font-weight: 600;
  line-height: 1.4;
}

.weight-parent {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.65);
  margin-top: 2px;
}

.weight-input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 6px 8px;
}

.weight-suffix {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.weight-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.qb-list-scroll {
  max-height: 520px;
  overflow: auto;
  padding-right: 6px;
}

.qb-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.qb-preview {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.65);
  line-height: 1.5;
  padding-left: 22px;
}

.qb-preview-inline {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  line-height: 1.5;
  flex: 0 0 auto;
  display: inline-block;
}

.qb-item-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.qb-item-title input[type='checkbox'] {
  align-self: center;
}

.qb-title-text {
  white-space: nowrap;
  line-height: 1.6;
}

.qb-stem {
  line-height: 1.6;
}

.qb-detail-btn {
  margin-left: auto;
  white-space: nowrap;
}

.qb-toggle {
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: 600;
}

.step-panel {
  padding-bottom: 16px;
}

.stepper {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.step-item {
  flex: 0 0 auto;
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.7);
}

.step-item.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #ffffff;
}

.step-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-arrow {
  flex: 0 0 auto;
  color: rgba(26, 29, 51, 0.45);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.primary-btn.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.8);
  box-shadow: none;
}

.checkbox-stack {
  display: grid;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(26, 29, 51, 0.88);
}

.threshold-input-row {
  display: grid;
  gap: 6px;
}

.threshold-input-row input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 7px 10px;
  width: 180px;
}

.threshold-input-row input:disabled {
  opacity: 0.6;
}

.ai-estimate-card {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(170, 192, 230, 0.35);
  background: rgba(247, 252, 255, 0.72);
}

.ai-estimate-card.disabled {
  background: rgba(250, 252, 255, 0.55);
}

.estimate-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.estimate-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.estimate-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.estimate-disabled-text {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.72);
}

.estimate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.estimate-item {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(202, 216, 238, 0.34);
  padding: 10px 12px;
  display: grid;
  gap: 4px;
}

.estimate-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.estimate-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.estimate-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.54);
}

.estimate-foot {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 900px) {
  .estimate-grid {
    grid-template-columns: 1fr;
  }
}
</style>
