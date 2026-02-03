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
        <label
          v-for="question in filteredQuestions"
          :key="question.id"
          class="qb-item"
        >
          <div class="qb-item-title">
            <input
              type="checkbox"
              :checked="selectedQuestionIds.has(question.id)"
              @change="toggleQuestion(question.id)"
            />
            {{ question.label }}
          </div>
          <div class="qb-item-meta">
            <span>{{ question.questionType }}</span>
            <span>{{ question.nodeType }}</span>
          </div>
        </label>
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
import { computed, onMounted, ref } from 'vue'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { listCourses } from '../api/course'
import { getQuestionBankStructure, listQuestionBank } from '../api/questionBank'
import { createAssignment, publishAssignment } from '../api/assignment'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const courses = ref([])
const textbooks = ref([])
const chapters = ref([])
const questions = ref([])

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

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
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

const filteredQuestions = computed(() =>
  questions.value
    .filter((item) => item.nodeType === 'LEAF')
    .filter((item) => (selectedChapterId.value ? item.chapterId === selectedChapterId.value : true))
    .map((item) => ({
      ...item,
      label: getQuestionLabel(item),
    })),
)

const toggleQuestion = (id) => {
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
  for (const item of filteredQuestions.value) {
    next.add(item.id)
  }
  selectedQuestionIds.value = next
}

const clearSelection = () => {
  selectedQuestionIds.value = new Set()
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
