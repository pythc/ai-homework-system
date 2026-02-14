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
        <button
          class="step-item"
          :class="{ active: step === 2 }"
          :disabled="!canEnterStep2"
          @click="step = 2"
        >
          2. 题库筛选
        </button>
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
            <label>选择课程</label>
            <select v-model="selectedCourseId" @change="handleCourseChange">
              <option value="">请选择课程</option>
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
              v-if="item.nodeType === 'LEAF'"
              type="checkbox"
              :checked="selectedQuestionIds.has(item.id)"
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
      <div v-if="submitSuccess" class="form-success">{{ submitSuccess }}</div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { listCourses } from '../api/course'
import { getQuestionBankStructure, listQuestionBank } from '../api/questionBank'
import { createAssignment, publishAssignment } from '../api/assignment'

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
const totalScore = ref(100)

const selectedQuestionIds = ref(new Set())
const selectedQuestionOrder = ref([])
const isHydrating = ref(true)
const questionWeights = ref({})
const expandQuestionList = ref(false)
const step = ref(1)

const questionError = ref('')
const submitError = ref('')
const submitSuccess = ref('')
const submitLoading = ref(false)

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
    return
  }
  try {
    const response = await getQuestionBankStructure(selectedCourseId.value)
    textbooks.value = response.textbooks ?? []
    chapters.value = response.chapters ?? []
    questions.value = await listQuestionBank(selectedCourseId.value)
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
  for (const item of filteredQuestions.value) {
    const parentId = item.parentId ?? ''
    if (!byParent.has(parentId)) {
      byParent.set(parentId, [])
    }
    byParent.get(parentId).push(item)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
  }

  const result = []
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId) ?? []
    for (const [index, child] of children.entries()) {
      const isExpandable = (byParent.get(child.id) ?? []).length > 0
      const displayOrder = child.orderNo ?? index + 1
      result.push({ ...child, depth, isExpandable, displayOrder })
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
  if (item?.nodeType !== 'LEAF') return
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]
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

const questionById = computed(() => new Map(questions.value.map((item) => [item.id, item])))

const orderedSelectedQuestions = computed(() => {
  const map = questionById.value
  return selectedQuestionOrder.value
    .map((id) => map.get(id))
    .filter((item) => item && item.nodeType === 'LEAF')
})

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
  submitSuccess.value = ''

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
    const created = await createAssignment({
      courseId: selectedCourseId.value,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      deadline: deadline.value || undefined,
      totalScore: Number(totalScore.value) || 100,
      aiEnabled: aiEnabled.value,
      selectedQuestionIds: Array.from(selectedQuestionIds.value),
    })
    const assignmentId = created.id
    const weightsPayload = Array.from(selectedQuestionIds.value).map((id) => ({
      questionId: id,
      weight: Number(questionWeights.value[id] ?? 0),
    }))
    await publishAssignment(assignmentId, { questionWeights: weightsPayload })
    submitSuccess.value = '作业发布成功'
    sessionStorage.removeItem(FORM_KEY)
    selectedCourseId.value = ''
    selectedTextbookId.value = ''
    selectedChapterId.value = ''
    title.value = ''
    description.value = ''
    deadline.value = ''
    aiEnabled.value = true
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
  flex: 1;
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
  flex-wrap: wrap;
  gap: 10px;
}

.step-item {
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
</style>
