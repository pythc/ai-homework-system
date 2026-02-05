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

    <section class="panel glass">
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
    </section>

    <section class="panel glass">
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
            <select v-model="selectedChapterId">
              <option value="">请选择章节</option>
              <option v-for="chapter in chapterOptions" :key="chapter.id" :value="chapter.id">
                {{ chapter.label }}
              </option>
            </select>
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
      <div class="qb-list" style="margin-top: 14px;">
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
              {{ item.title || '未命名' }}
            </span>
            <span
              v-if="item.isExpandable && getStemText(item)"
              class="qb-stem"
              v-mathjax
              v-html="renderStemHtml(item)"
            />
          </div>
          <div class="qb-item-meta">
            <!-- <span>{{ item.questionType }}</span>
            <span>{{ item.nodeType }}</span> -->
            <button
              class="qb-action"
              type="button"
              @click="viewDetail(item.id)"
            >
              查看详情
            </button>
          </div>
        </div>
        <div v-if="!filteredQuestions.length" class="empty-box">
          {{ questionError || '暂无题目' }}
        </div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">发布</div>
      <div class="form-actions">
        <button
          class="primary-btn"
          type="button"
          :disabled="submitLoading"
          @click="handlePublish"
        >
          {{ submitLoading ? '发布中...' : '发布作业' }}
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
const selectedChapterId = ref('')

const title = ref('')
const description = ref('')
const deadline = ref('')
const aiEnabled = ref(true)

const selectedQuestionIds = ref(new Set())

const questionError = ref('')
const submitError = ref('')
const submitSuccess = ref('')
const submitLoading = ref(false)

const STORAGE_KEY = 'teacher.assignment.publish.filters'

const hydrateFilters = async () => {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  const stored = raw ? JSON.parse(raw) : null
  const courseId = String(route.query.courseId ?? '') || stored?.courseId || ''
  const textbookId = String(route.query.textbookId ?? '') || stored?.textbookId || ''
  const chapterId = String(route.query.chapterId ?? '') || stored?.chapterId || ''
  if (!courseId) return
  selectedCourseId.value = courseId
  await handleCourseChange()
  selectedTextbookId.value = textbookId || ''
  selectedChapterId.value = chapterId || ''
}

const persistFilters = () => {
  const payload = {
    courseId: selectedCourseId.value,
    textbookId: selectedTextbookId.value,
    chapterId: selectedChapterId.value,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  router.replace({
    query: {
      ...route.query,
      courseId: payload.courseId || undefined,
      textbookId: payload.textbookId || undefined,
      chapterId: payload.chapterId || undefined,
    },
  })
}

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
  await hydrateFilters()
})

watch([selectedCourseId, selectedTextbookId, selectedChapterId], () => {
  persistFilters()
})

const fetchCourses = async () => {
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const handleCourseChange = async () => {
  selectedTextbookId.value = ''
  selectedChapterId.value = ''
  selectedQuestionIds.value = new Set()
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
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载题库失败'
  }
}

const handleTextbookChange = () => {
  selectedChapterId.value = ''
}

const chapterOptions = computed(() => {
  const items = chapters.value.filter((chapter) =>
    selectedTextbookId.value ? chapter.textbookId === selectedTextbookId.value : false,
  )
  if (!items.length) return []
  const byId = new Map(items.map((item) => [item.id, item]))
  const isParent = new Set(items.map((item) => item.parentId).filter(Boolean))
  return items
    .filter((item) => !isParent.has(item.id))
    .sort((a, b) => a.orderNo - b.orderNo)
    .map((item) => {
      const parent = item.parentId ? byId.get(item.parentId) : null
      const label = parent ? `${parent.title} / ${item.title}` : item.title
      return { id: item.id, label }
    })
})

const getQuestionLabel = (item) => {
  const title = item.title?.trim()
  if (title) return title
  if (typeof item.prompt === 'string') return item.prompt.slice(0, 24)
  if (item.prompt?.text) return String(item.prompt.text).slice(0, 24)
  return '未命名题目'
}

const filteredQuestions = computed(() => {
  if (!selectedTextbookId.value || !selectedChapterId.value) return []
  return questions.value
    .filter((item) => item.chapterId === selectedChapterId.value)
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
    for (const child of children) {
      const isExpandable = (byParent.get(child.id) ?? []).length > 0
      result.push({ ...child, depth, isExpandable })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return result
})

const visibleQuestions = computed(() => {
  const byId = new Map(flattenedQuestions.value.map((item) => [item.id, item]))
  return flattenedQuestions.value.filter((item) => {
    let parentId = item.parentId ?? ''
    while (parentId) {
      if (!expandedIds.value.has(parentId)) return false
      const parent = byId.get(parentId)
      if (!parent) break
      parentId = parent.parentId ?? ''
    }
    return true
  })
})

const toggleQuestion = (id) => {
  const item = questions.value.find((q) => q.id === id)
  if (item?.nodeType !== 'LEAF') return
  const next = new Set(selectedQuestionIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedQuestionIds.value = next
}

const selectAllVisible = () => {
  const next = new Set(selectedQuestionIds.value)
  for (const item of visibleQuestions.value) {
    if (item.nodeType === 'LEAF') {
      next.add(item.id)
    }
  }
  selectedQuestionIds.value = next
}

const clearSelection = () => {
  selectedQuestionIds.value = new Set()
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

const renderStemHtml = (item) => {
  const text = getStemText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const viewDetail = (questionId) => {
  router.push(`/teacher/question-bank/questions/${questionId}`)
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
      aiEnabled: aiEnabled.value,
      selectedQuestionIds: Array.from(selectedQuestionIds.value),
    })
    await publishAssignment(created.id)
    submitSuccess.value = '作业发布成功'
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '发布失败'
  } finally {
    submitLoading.value = false
  }
}
</script>
