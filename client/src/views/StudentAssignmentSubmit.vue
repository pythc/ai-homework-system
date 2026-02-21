<template>
  <StudentLayout
    title="提交作业"
    subtitle="支持富文本与图片提交"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业提交"
  >
    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>作业提交</div>
        <button class="ghost-action" type="button" @click="goBack">返回作业库</button>
      </div>
      <div v-if="loading" class="task-empty">加载题目中...</div>
      <div v-else class="submit-layout">
        <aside class="question-sidebar">
          <div class="sidebar-title">题号</div>
          <button
            v-for="(question, index) in questions"
            :key="question.questionId"
            class="sidebar-item"
            :class="{
              active: index === currentIndex,
              done: Boolean(submittedMap[question.questionId]),
            }"
            @click="goQuestion(index)"
          >
            {{ question.questionIndex }}
          </button>
        </aside>

        <div class="submit-list">
          <div v-if="currentQuestion" class="submit-card">
            <div
              v-if="currentQuestion.parentPromptText"
              class="submit-prompt parent-prompt"
              v-mathjax
              v-html="renderTextHtml(currentQuestion.parentPromptText)"
            />
            <div
              class="submit-prompt"
              v-mathjax
              v-html="renderTextHtml(currentQuestion.promptText)"
            />
            <div v-if="currentQuestion.promptMedia.length" class="submit-media">
              <img
                v-for="(img, index) in currentQuestion.promptMedia"
                :key="index"
                :src="img.url"
                :alt="img.caption || 'image'"
              />
            </div>

            <div v-if="isObjectiveQuestion(currentQuestion)" class="objective-shell">
              <template v-if="objectiveTypeOf(currentQuestion) === 'SINGLE_CHOICE'">
                <div class="objective-hint">请选择 1 个选项</div>
                <div class="objective-option-list">
                  <label
                    v-for="option in getQuestionOptions(currentQuestion)"
                    :key="`single-${currentQuestion.questionId}-${option.id}`"
                    class="objective-option"
                  >
                    <input
                      type="radio"
                      :name="`single-${currentQuestion.questionId}`"
                      :disabled="isFinalized"
                      :checked="getSingleChoiceValue(currentQuestion.questionId) === option.id"
                      @change="setSingleChoiceValue(currentQuestion.questionId, option.id)"
                    />
                    <span class="objective-option-id">{{ option.id }}</span>
                    <span class="objective-option-text">{{ option.text || option.id }}</span>
                  </label>
                </div>
              </template>

              <template v-else-if="objectiveTypeOf(currentQuestion) === 'MULTI_CHOICE'">
                <div class="objective-hint">可多选</div>
                <div class="objective-option-list">
                  <label
                    v-for="option in getQuestionOptions(currentQuestion)"
                    :key="`multi-${currentQuestion.questionId}-${option.id}`"
                    class="objective-option"
                  >
                    <input
                      type="checkbox"
                      :disabled="isFinalized"
                      :checked="getMultiChoiceValues(currentQuestion.questionId).includes(option.id)"
                      @change="toggleMultiChoiceValue(currentQuestion.questionId, option.id)"
                    />
                    <span class="objective-option-id">{{ option.id }}</span>
                    <span class="objective-option-text">{{ option.text || option.id }}</span>
                  </label>
                </div>
              </template>

              <template v-else-if="objectiveTypeOf(currentQuestion) === 'JUDGE'">
                <div class="objective-hint">请选择正确或错误</div>
                <div class="objective-option-list">
                  <label
                    v-for="option in getQuestionOptions(currentQuestion)"
                    :key="`judge-${currentQuestion.questionId}-${option.id}`"
                    class="objective-option"
                  >
                    <input
                      type="radio"
                      :name="`judge-${currentQuestion.questionId}`"
                      :disabled="isFinalized"
                      :checked="getJudgeValue(currentQuestion.questionId) === option.value"
                      @change="setJudgeValue(currentQuestion.questionId, option.value)"
                    />
                    <span class="objective-option-id">{{ option.id }}</span>
                    <span class="objective-option-text">{{ option.text }}</span>
                  </label>
                </div>
              </template>

              <template v-else-if="objectiveTypeOf(currentQuestion) === 'FILL_BLANK'">
                <div class="objective-hint">请填写每个空位</div>
                <div class="blank-answer-list">
                  <label
                    v-for="(blank, index) in getFillBlankValues(currentQuestion)"
                    :key="`blank-${currentQuestion.questionId}-${index}`"
                    class="blank-answer-item"
                  >
                    <span class="blank-answer-label">第 {{ index + 1 }} 空</span>
                    <input
                      type="text"
                      :disabled="isFinalized"
                      :value="blank"
                      @input="handleFillBlankInput(currentQuestion.questionId, index, $event)"
                    />
                  </label>
                </div>
              </template>
            </div>

            <div v-else>
              <div class="editor-shell">
                <div class="editor-toolbar">
                  <button class="tool-btn" :disabled="isFinalized" type="button" title="撤销" @click="runCommand('undo')">
                    <Undo2 class="tool-icon" />
                  </button>
                  <button class="tool-btn" :disabled="isFinalized" type="button" title="重做" @click="runCommand('redo')">
                    <Redo2 class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('heading', { level: 2 }) }"
                    :disabled="isFinalized"
                    type="button"
                    title="标题"
                    @click="runCommand('heading')"
                  >
                    <Heading2 class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('bulletList') }"
                    :disabled="isFinalized"
                    type="button"
                    title="无序列表"
                    @click="runCommand('bulletList')"
                  >
                    <List class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('orderedList') }"
                    :disabled="isFinalized"
                    type="button"
                    title="有序列表"
                    @click="runCommand('orderedList')"
                  >
                    <ListOrdered class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('codeBlock') }"
                    :disabled="isFinalized"
                    type="button"
                    title="代码块"
                    @click="runCommand('codeBlock')"
                  >
                    <Code2 class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('bold') }"
                    :disabled="isFinalized"
                    type="button"
                    title="加粗"
                    @click="runCommand('bold')"
                  >
                    <Bold class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('italic') }"
                    :disabled="isFinalized"
                    type="button"
                    title="斜体"
                    @click="runCommand('italic')"
                  >
                    <Italic class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('underline') }"
                    :disabled="isFinalized"
                    type="button"
                    title="下划线"
                    @click="runCommand('underline')"
                  >
                    <Underline class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('strike') }"
                    :disabled="isFinalized"
                    type="button"
                    title="删除线"
                    @click="runCommand('strike')"
                  >
                    <Strikethrough class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('superscript') }"
                    :disabled="isFinalized"
                    type="button"
                    title="上标"
                    @click="runCommand('superscript')"
                  >
                    <SuperscriptIcon class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('subscript') }"
                    :disabled="isFinalized"
                    type="button"
                    title="下标"
                    @click="runCommand('subscript')"
                  >
                    <SubscriptIcon class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('paragraph', { textAlign: 'left' }) }"
                    :disabled="isFinalized"
                    type="button"
                    title="左对齐"
                    @click="runCommand('alignLeft')"
                  >
                    <AlignLeft class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('paragraph', { textAlign: 'center' }) }"
                    :disabled="isFinalized"
                    type="button"
                    title="居中对齐"
                    @click="runCommand('alignCenter')"
                  >
                    <AlignCenter class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('paragraph', { textAlign: 'right' }) }"
                    :disabled="isFinalized"
                    type="button"
                    title="右对齐"
                    @click="runCommand('alignRight')"
                  >
                    <AlignRight class="tool-icon" />
                  </button>
                  <button
                    class="tool-btn"
                    :class="{ active: isEditorActive('paragraph', { textAlign: 'justify' }) }"
                    :disabled="isFinalized"
                    type="button"
                    title="两端对齐"
                    @click="runCommand('alignJustify')"
                  >
                    <AlignJustify class="tool-icon" />
                  </button>
                  <span class="tool-divider" />
                  <button class="tool-btn" :disabled="isFinalized" type="button" title="添加图片" @click="triggerToolbarImageUpload">
                    <ImagePlus class="tool-icon" />
                  </button>
                </div>
                <div
                  class="editor-content-wrap"
                  @paste="onEditorPaste"
                  @dragenter="onEditorDragEnter"
                  @dragover="onEditorDragOver"
                  @dragleave="onEditorDragLeave"
                  @drop="onEditorDrop"
                >
                  <EditorContent class="editor-content" :class="{ 'drag-active': dragActive }" :editor="editor" />
                </div>
                <input
                  ref="toolbarFileInputRef"
                  type="file"
                  accept="image/*"
                  multiple
                  :disabled="isFinalized"
                  class="hidden-input"
                  @change="onToolbarFileChange"
                />
              </div>
              <div v-if="getFileCount(currentQuestion.questionId) > 0" class="submit-files">
                已选择 {{ getFileCount(currentQuestion.questionId) }} 张图片
              </div>
              <div
                v-if="getSelectedPreviews(currentQuestion.questionId).length"
                class="submit-preview selected-preview"
              >
                <div class="preview-title">本次已选图片</div>
                <div class="preview-media">
                  <div
                    v-for="(item, index) in getSelectedPreviews(currentQuestion.questionId)"
                    :key="item"
                    class="preview-item"
                  >
                    <img :src="item" alt="selected image" />
                    <button
                      class="preview-remove"
                      type="button"
                      aria-label="删除图片"
                      :disabled="isFinalized"
                      @click="removeSelectedFile(currentQuestion.questionId, index)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="submittedMap[currentQuestion.questionId]" class="submit-preview">
              <div class="preview-title">已提交内容</div>
              <template v-if="isObjectiveQuestion(currentQuestion)">
                <div class="preview-text">
                  {{ formatSubmittedObjective(currentQuestion, submittedMap[currentQuestion.questionId]) }}
                </div>
              </template>
              <template v-else>
                <div
                  v-if="submittedMap[currentQuestion.questionId]?.contentText"
                  class="preview-text rich-text-preview"
                  v-html="renderAnswerHtml(submittedMap[currentQuestion.questionId]?.contentText || '')"
                />
                <div v-else class="preview-empty">未填写文字答案</div>
                <div
                  v-if="submittedMap[currentQuestion.questionId]?.fileUrls?.length"
                  class="preview-media"
                >
                  <img
                    v-for="(img, index) in submittedMap[currentQuestion.questionId]?.fileUrls ?? []"
                    :key="index"
                    :src="resolveFileUrl(img)"
                    alt="submission image"
                  />
                </div>
              </template>
            </div>
          </div>
          <div v-if="questions.length > 1" class="question-nav">
            <button class="nav-btn" :disabled="currentIndex === 0" @click="prevQuestion">
              上一题
            </button>
            <div class="nav-info">{{ currentIndex + 1 }} / {{ questions.length }}</div>
            <button
              class="nav-btn"
              :disabled="currentIndex === questions.length - 1"
              @click="nextQuestion"
            >
              下一题
            </button>
          </div>
          <div class="submit-actions">
            <button
              class="task-action"
              :class="{ 'is-locked': isFinalized }"
              :disabled="submitting || isFinalized"
              @click="submit"
            >
              {{ isFinalized ? '已评分不可再提交' : submitting ? '提交中...' : '提交作业' }}
            </button>
            <div v-if="error" class="submit-error">{{ error }}</div>
            <div v-if="isFinalized" class="submit-lock">老师已确认最终成绩，无法再次提交。</div>
          </div>
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  Undo2,
} from 'lucide-vue-next'
import StudentLayout from '../components/StudentLayout.vue'
import type { AssignmentSnapshotQuestion, QuestionType } from '../api/assignment'
import { getAssignmentSnapshot } from '../api/assignment'
import { listLatestSubmissions, uploadSubmission } from '../api/submission'
import { API_BASE_URL } from '../api/http'
import { showAppToast } from '../composables/useAppToast'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const syncingFromQuestion = ref(false)
const toolbarFileInputRef = ref<HTMLInputElement | null>(null)
const dragDepth = ref(0)
const dragActive = ref(false)

type ObjectiveQuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'FILL_BLANK' | 'JUDGE'
type ObjectiveAnswerPayload = Record<string, unknown>
type QuestionOption = { id: string; text: string; value?: boolean }

type SubmitQuestion = {
  questionId: string
  questionIndex: number
  promptText: string
  parentPromptText?: string
  promptMedia: Array<{ url: string; caption?: string }>
  questionType: QuestionType
  questionSchema: Record<string, unknown> | null
  standardAnswer: Record<string, unknown> | null
}

type SubmittedItem = {
  submissionVersionId: string
  contentText: string
  fileUrls: string[]
  answerPayload?: Record<string, unknown> | null
  answerFormat?: string | null
}

const questions = ref<SubmitQuestion[]>([])
const currentIndex = ref(0)
const answers = ref<Record<string, string>>({})
const objectiveAnswers = ref<Record<string, ObjectiveAnswerPayload>>({})
const filesByQuestion = ref<Record<string, File[]>>({})
const previewUrls = ref<Record<string, string[]>>({})
const submittedMap = ref<Record<string, SubmittedItem>>({})
const isFinalized = ref(false)

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')
const currentQuestion = computed(() => questions.value[currentIndex.value] ?? null)

const goBack = () => {
  router.push('/student/assignments')
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [2] } }),
    UnderlineExtension,
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
  ],
  content: '',
  editable: true,
  onUpdate: ({ editor: editorInstance }) => {
    if (syncingFromQuestion.value) return
    const questionId = currentQuestion.value?.questionId
    if (!questionId) return
    answers.value[questionId] = editorInstance.isEmpty ? '' : editorInstance.getHTML()
  },
})

const normalizePrompt = (prompt: unknown) => {
  if (!prompt) return { text: '', media: [] as Array<{ url: string; caption?: string }> }
  if (typeof prompt === 'string') return { text: prompt, media: [] as Array<{ url: string; caption?: string }> }
  if (typeof prompt === 'object') {
    const text = String((prompt as { text?: string }).text ?? '')
    const media = Array.isArray((prompt as { media?: unknown[] }).media)
      ? ((prompt as { media?: Array<{ url: string; caption?: string }> }).media ?? [])
      : []
    return { text, media }
  }
  return { text: '', media: [] as Array<{ url: string; caption?: string }> }
}

const renderTextHtml = (text: string) => {
  if (!text) return '题目内容加载失败'
  return text.replace(/\n/g, '<br />')
}

const renderAnswerHtml = (text: string) => {
  if (!text) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return text
  return text.replace(/\n/g, '<br />')
}

const stripHtml = (text: string) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const objectiveTypes = new Set<ObjectiveQuestionType>([
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'FILL_BLANK',
  'JUDGE',
])

const questionTypeList: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'FILL_BLANK',
  'JUDGE',
  'SHORT_ANSWER',
  'ESSAY',
  'CALCULATION',
  'PROOF',
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeQuestionType = (value: unknown): QuestionType => {
  const type = String(value ?? '')
    .trim()
    .toUpperCase()
  if (questionTypeList.includes(type as QuestionType)) {
    return type as QuestionType
  }
  return 'SHORT_ANSWER'
}

const normalizeStructuredValue = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) return value
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    return { text }
  }
  return null
}

const objectiveTypeOf = (question: SubmitQuestion | null | undefined): ObjectiveQuestionType | null => {
  const type = normalizeQuestionType(question?.questionType)
  return objectiveTypes.has(type as ObjectiveQuestionType) ? (type as ObjectiveQuestionType) : null
}

const isObjectiveQuestion = (question: SubmitQuestion | null | undefined) =>
  Boolean(objectiveTypeOf(question))

const parseBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (['true', 't', 'yes', 'y', '1', '对', '正确'].includes(normalized)) return true
  if (['false', 'f', 'no', 'n', '0', '错', '错误'].includes(normalized)) return false
  return null
}

const splitAnswerTokens = (value: string) =>
  value
    .split(/[\n,，;；、]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const getQuestionOptions = (question: SubmitQuestion): QuestionOption[] => {
  const schema = isRecord(question.questionSchema) ? question.questionSchema : {}
  const raw = Array.isArray(schema.options) ? schema.options : []
  const mapped = raw
    .map((item, index) => {
      if (!isRecord(item)) return null
      const id = String(item.id ?? index + 1).trim()
      if (!id) return null
      const text = String(item.text ?? id).trim() || id
      const parsedBool = parseBooleanValue(item.value)
      return {
        id,
        text,
        ...(parsedBool === null ? {} : { value: parsedBool }),
      }
    })
    .filter((item): item is QuestionOption => Boolean(item))

  if (mapped.length > 0) return mapped
  if (objectiveTypeOf(question) === 'JUDGE') {
    return [
      { id: 'A', text: '正确', value: true },
      { id: 'B', text: '错误', value: false },
    ]
  }
  return []
}

const getBlankCount = (question: SubmitQuestion) => {
  const schema = isRecord(question.questionSchema) ? question.questionSchema : {}
  const countFromSchema = Number(schema.blankCount ?? 0)
  const standard = isRecord(question.standardAnswer) ? question.standardAnswer : {}
  const standardBlanks = Array.isArray(standard.blanks) ? standard.blanks.length : 0
  const candidate = Math.max(Number.isFinite(countFromSchema) ? Math.floor(countFromSchema) : 0, standardBlanks, 1)
  return Math.min(Math.max(candidate, 1), 20)
}

const clonePayload = (questionId: string) => ({ ...(objectiveAnswers.value[questionId] ?? {}) })

const setObjectivePayload = (questionId: string, payload: ObjectiveAnswerPayload) => {
  objectiveAnswers.value = {
    ...objectiveAnswers.value,
    [questionId]: payload,
  }
}

const getSingleChoiceValue = (questionId: string) => {
  const payload = objectiveAnswers.value[questionId] ?? {}
  if (typeof payload.selectedOptionId === 'string' && payload.selectedOptionId.trim()) {
    return payload.selectedOptionId.trim()
  }
  if (Array.isArray(payload.selectedOptionIds)) {
    const first = payload.selectedOptionIds
      .map((item) => String(item).trim())
      .find((item) => item.length > 0)
    return first ?? ''
  }
  if (typeof payload.value === 'string' && payload.value.trim()) {
    return payload.value.trim()
  }
  return ''
}

const setSingleChoiceValue = (questionId: string, optionId: string) => {
  const id = optionId.trim()
  const payload = clonePayload(questionId)
  setObjectivePayload(questionId, {
    ...payload,
    selectedOptionId: id,
    selectedOptionIds: [id],
  })
}

const getMultiChoiceValues = (questionId: string) => {
  const payload = objectiveAnswers.value[questionId] ?? {}
  if (Array.isArray(payload.selectedOptionIds)) {
    return Array.from(
      new Set(
        payload.selectedOptionIds
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      ),
    )
  }
  if (typeof payload.selectedOptionId === 'string' && payload.selectedOptionId.trim()) {
    return [payload.selectedOptionId.trim()]
  }
  return []
}

const toggleMultiChoiceValue = (questionId: string, optionId: string) => {
  const id = optionId.trim()
  const values = getMultiChoiceValues(questionId)
  const next = values.includes(id) ? values.filter((item) => item !== id) : [...values, id]
  const payload = clonePayload(questionId)
  setObjectivePayload(questionId, {
    ...payload,
    selectedOptionIds: next,
  })
}

const getJudgeValue = (questionId: string): boolean | null => {
  const payload = objectiveAnswers.value[questionId] ?? {}
  const parsed = parseBooleanValue(payload.value)
  if (parsed !== null) return parsed
  return parseBooleanValue(payload.answer)
}

const setJudgeValue = (questionId: string, value: boolean | undefined) => {
  if (typeof value !== 'boolean') return
  const payload = clonePayload(questionId)
  setObjectivePayload(questionId, {
    ...payload,
    value,
  })
}

const getFillBlankValues = (question: SubmitQuestion) => {
  const payload = objectiveAnswers.value[question.questionId] ?? {}
  const values = Array.isArray(payload.blanks)
    ? payload.blanks.map((item) => String(item ?? ''))
    : []
  const count = getBlankCount(question)
  if (values.length >= count) return values.slice(0, count)
  return [...values, ...new Array(count - values.length).fill('')]
}

const setFillBlankValue = (questionId: string, index: number, value: string) => {
  const question = questions.value.find((item) => item.questionId === questionId)
  if (!question) return
  const next = getFillBlankValues(question)
  next[index] = value
  const payload = clonePayload(questionId)
  setObjectivePayload(questionId, {
    ...payload,
    blanks: next,
  })
}

const handleFillBlankInput = (questionId: string, index: number, event: Event) => {
  const target = event.target as HTMLInputElement | null
  setFillBlankValue(questionId, index, target?.value ?? '')
}

const normalizeObjectivePayloadFromAny = (
  question: SubmitQuestion,
  payload: unknown,
  fallbackText = '',
): ObjectiveAnswerPayload => {
  if (objectiveTypeOf(question) === 'SINGLE_CHOICE') {
    const ids = (() => {
      if (isRecord(payload)) {
        if (typeof payload.selectedOptionId === 'string' && payload.selectedOptionId.trim()) {
          return [payload.selectedOptionId.trim()]
        }
        if (Array.isArray(payload.selectedOptionIds)) {
          const items = payload.selectedOptionIds
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0)
          if (items.length) return items
        }
        if (typeof payload.value === 'string' && payload.value.trim()) {
          return [payload.value.trim()]
        }
      }
      return splitAnswerTokens(fallbackText)
    })()
    if (ids.length > 0) {
      return { selectedOptionId: ids[0], selectedOptionIds: [ids[0]] }
    }
    return {}
  }

  if (objectiveTypeOf(question) === 'MULTI_CHOICE') {
    const ids = (() => {
      if (isRecord(payload) && Array.isArray(payload.selectedOptionIds)) {
        const items = payload.selectedOptionIds
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
        if (items.length) return items
      }
      if (isRecord(payload) && typeof payload.selectedOptionId === 'string' && payload.selectedOptionId.trim()) {
        return [payload.selectedOptionId.trim()]
      }
      return splitAnswerTokens(fallbackText)
    })()
    if (ids.length > 0) {
      return { selectedOptionIds: Array.from(new Set(ids)) }
    }
    return {}
  }

  if (objectiveTypeOf(question) === 'JUDGE') {
    const bool = (() => {
      if (isRecord(payload)) {
        const parsed = parseBooleanValue(payload.value)
        if (parsed !== null) return parsed
        return parseBooleanValue(payload.answer)
      }
      return parseBooleanValue(payload ?? fallbackText)
    })()
    if (bool !== null) {
      return { value: bool }
    }
    return {}
  }

  if (objectiveTypeOf(question) === 'FILL_BLANK') {
    const blanks = (() => {
      if (isRecord(payload) && Array.isArray(payload.blanks)) {
        const items = payload.blanks
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0)
        if (items.length) return items
      }
      return splitAnswerTokens(fallbackText)
    })()
    if (blanks.length > 0) {
      return { blanks }
    }
    return { blanks: new Array(getBlankCount(question)).fill('') }
  }

  return {}
}

const objectiveAnswerToText = (question: SubmitQuestion, payload: ObjectiveAnswerPayload) => {
  const type = objectiveTypeOf(question)
  if (type === 'SINGLE_CHOICE') {
    if (typeof payload.selectedOptionId === 'string' && payload.selectedOptionId.trim()) {
      return payload.selectedOptionId.trim()
    }
    if (Array.isArray(payload.selectedOptionIds)) {
      const first = payload.selectedOptionIds
        .map((item) => String(item).trim())
        .find((item) => item.length > 0)
      return first ?? ''
    }
    return ''
  }
  if (type === 'MULTI_CHOICE') {
    const values = Array.isArray(payload.selectedOptionIds)
      ? payload.selectedOptionIds
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
      : []
    return values.join(',')
  }
  if (type === 'JUDGE') {
    const value = parseBooleanValue(payload.value)
    if (value === null) return ''
    return value ? '对' : '错'
  }
  if (type === 'FILL_BLANK') {
    const blanks = Array.isArray(payload.blanks)
      ? payload.blanks.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0)
      : []
    return blanks.join('；')
  }
  return ''
}

const buildObjectiveAnswer = (question: SubmitQuestion) => {
  return normalizeObjectivePayloadFromAny(
    question,
    objectiveAnswers.value[question.questionId] ?? null,
  )
}

const formatSubmittedObjective = (question: SubmitQuestion, submitted?: SubmittedItem) => {
  if (!submitted) return '未提交答案'
  const payload = normalizeObjectivePayloadFromAny(
    question,
    submitted.answerPayload,
    submitted.contentText ?? '',
  )
  const type = objectiveTypeOf(question)
  const optionMap = new Map(getQuestionOptions(question).map((item) => [item.id, item.text]))
  if (type === 'SINGLE_CHOICE') {
    const selected = typeof payload.selectedOptionId === 'string' ? payload.selectedOptionId.trim() : ''
    if (!selected) return '未提交答案'
    const text = optionMap.get(selected)
    return text ? `${selected}. ${text}` : selected
  }
  if (type === 'MULTI_CHOICE') {
    const selected = Array.isArray(payload.selectedOptionIds)
      ? payload.selectedOptionIds.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : []
    if (!selected.length) return '未提交答案'
    return selected
      .map((id) => (optionMap.has(id) ? `${id}. ${optionMap.get(id)}` : id))
      .join('；')
  }
  if (type === 'JUDGE') {
    const value = parseBooleanValue(payload.value)
    if (value === null) return '未提交答案'
    return value ? '正确' : '错误'
  }
  if (type === 'FILL_BLANK') {
    const blanks = Array.isArray(payload.blanks)
      ? payload.blanks.map((item) => String(item ?? '').trim())
      : []
    const valid = blanks.filter((item) => item.length > 0)
    if (!valid.length) return '未提交答案'
    return valid.map((item, index) => `第${index + 1}空：${item}`).join('；')
  }
  return submitted.contentText || '未提交答案'
}

const loadSnapshot = async () => {
  if (!assignmentId.value) {
    error.value = '缺少作业信息'
    loading.value = false
    return
  }
  try {
    const snapshot = await getAssignmentSnapshot(assignmentId.value)
    const snapshotQuestions = (snapshot?.questions ?? []) as AssignmentSnapshotQuestion[]
    questions.value = snapshotQuestions.map((item) => {
      const prompt = normalizePrompt(item.prompt)
      const parentPrompt = normalizePrompt((item as { parentPrompt?: unknown }).parentPrompt)
      const questionType = normalizeQuestionType(item.questionType)
      return {
        questionId: item.questionId,
        questionIndex: item.questionIndex,
        promptText: prompt.text,
        parentPromptText: parentPrompt.text || '',
        promptMedia: prompt.media,
        questionType,
        questionSchema: normalizeStructuredValue(item.questionSchema),
        standardAnswer: normalizeStructuredValue(item.standardAnswer),
      }
    })
    currentIndex.value = 0
    questions.value.forEach((question) => {
      if (isObjectiveQuestion(question)) {
        if (!(question.questionId in objectiveAnswers.value)) {
          objectiveAnswers.value[question.questionId] = normalizeObjectivePayloadFromAny(question, null)
        }
      } else if (!(question.questionId in answers.value)) {
        answers.value[question.questionId] = ''
      }
    })
    if (questions.value.length === 0) {
      error.value = '作业题目为空或未发布，请联系老师确认'
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载题目失败'
    if (message.includes('作业提交后不可查看')) {
      error.value = '教师设置学生提交后暂不可见'
    } else {
      error.value = message
    }
  } finally {
    loading.value = false
  }
}

const loadLatestSubmissions = async () => {
  if (!assignmentId.value) return
  try {
    const response = await listLatestSubmissions(assignmentId.value)
    const items = response?.items ?? []
    isFinalized.value = items.some((item) => item.isFinal)
    const questionMap = new Map(questions.value.map((question) => [question.questionId, question]))
    items.forEach((item) => {
      const question = questionMap.get(item.questionId)
      const answerPayload = isRecord(item.answerPayload) ? item.answerPayload : null
      submittedMap.value[item.questionId] = {
        submissionVersionId: item.submissionVersionId,
        contentText: item.contentText ?? '',
        fileUrls: item.fileUrls ?? [],
        answerPayload,
        answerFormat: item.answerFormat ?? null,
      }
      if (question && isObjectiveQuestion(question)) {
        objectiveAnswers.value[item.questionId] = normalizeObjectivePayloadFromAny(
          question,
          answerPayload,
          item.contentText ?? '',
        )
      } else if (!answers.value[item.questionId]) {
        answers.value[item.questionId] = item.contentText ?? ''
      }
    })
    syncEditorFromCurrentQuestion()
  } catch {
    // ignore
  }
}

const resetQuestionFiles = (questionId: string, files: File[]) => {
  const oldUrls = previewUrls.value[questionId] ?? []
  oldUrls.forEach((item) => URL.revokeObjectURL(item))
  previewUrls.value[questionId] = files.map((file) => URL.createObjectURL(file))
  filesByQuestion.value[questionId] = files
}

const mergeImageFiles = (
  questionId: string,
  incomingFiles: File[],
) => {
  const question = questions.value.find((item) => item.questionId === questionId)
  if (question && isObjectiveQuestion(question)) {
    showAppToast('客观题不支持上传图片', 'error')
    return
  }
  const imageFiles = incomingFiles.filter((file) => file.type.startsWith('image/'))
  if (imageFiles.length === 0) return

  const existing = filesByQuestion.value[questionId] ?? []
  const remain = Math.max(0, 4 - existing.length)
  if (remain === 0) {
    showAppToast('图片最多提交4张', 'error')
    return
  }

  const accepted = imageFiles.slice(0, remain)
  resetQuestionFiles(questionId, [...existing, ...accepted])
  if (imageFiles.length > remain) {
    showAppToast('图片最多提交4张', 'error')
  } else {
    error.value = ''
  }
}

const getClipboardImageFiles = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items ?? []
  return Array.from(items)
    .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
    .filter((file): file is File => Boolean(file && file.type.startsWith('image/')))
}

const getTransferImageFiles = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) return []
  return Array.from(dataTransfer.files).filter((file) => file.type.startsWith('image/'))
}

const hasTransferFiles = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types ?? []).includes('Files')
}

const onFileChange = (event: Event, questionId: string) => {
  const input = event.target as HTMLInputElement | null
  if (!input?.files) return
  const question = questions.value.find((item) => item.questionId === questionId)
  if (!question) return
  mergeImageFiles(questionId, Array.from(input.files))
  input.value = ''
}

const onToolbarFileChange = (event: Event) => {
  const questionId = currentQuestion.value?.questionId
  if (!questionId) return
  onFileChange(event, questionId)
}

const onEditorPaste = (event: ClipboardEvent) => {
  if (isFinalized.value || !currentQuestion.value) return
  const imageFiles = getClipboardImageFiles(event)
  if (imageFiles.length === 0) return
  event.preventDefault()
  mergeImageFiles(currentQuestion.value.questionId, imageFiles)
}

const onEditorDragEnter = (event: DragEvent) => {
  if (isFinalized.value) return
  if (!hasTransferFiles(event.dataTransfer)) return
  event.preventDefault()
  const imageFiles = getTransferImageFiles(event.dataTransfer)
  dragDepth.value += 1
  if (imageFiles.length > 0) {
    dragActive.value = true
  }
}

const onEditorDragOver = (event: DragEvent) => {
  if (isFinalized.value) return
  if (!hasTransferFiles(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  const imageFiles = getTransferImageFiles(event.dataTransfer)
  if (imageFiles.length > 0) {
    dragActive.value = true
  }
}

const onEditorDragLeave = (event: DragEvent) => {
  if (isFinalized.value || !dragActive.value) return
  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    dragActive.value = false
  }
}

const onEditorDrop = (event: DragEvent) => {
  if (isFinalized.value || !currentQuestion.value) return
  if (hasTransferFiles(event.dataTransfer)) {
    event.preventDefault()
  }
  const imageFiles = getTransferImageFiles(event.dataTransfer)
  if (imageFiles.length === 0) {
    dragDepth.value = 0
    dragActive.value = false
    return
  }
  dragDepth.value = 0
  dragActive.value = false
  mergeImageFiles(currentQuestion.value.questionId, imageFiles)
}

const getFileCount = (questionId: string) =>
  filesByQuestion.value[questionId]?.length ?? 0

const getSelectedPreviews = (questionId: string) =>
  previewUrls.value[questionId] ?? []

const removeSelectedFile = (questionId: string, index: number) => {
  const files = filesByQuestion.value[questionId] ?? []
  const urls = previewUrls.value[questionId] ?? []
  const removed = urls[index]
  if (removed) URL.revokeObjectURL(removed)
  files.splice(index, 1)
  urls.splice(index, 1)
  filesByQuestion.value[questionId] = [...files]
  previewUrls.value[questionId] = [...urls]
}

const prevQuestion = () => {
  if (currentIndex.value > 0) currentIndex.value -= 1
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) currentIndex.value += 1
}

const goQuestion = (index: number) => {
  if (index < 0 || index >= questions.value.length) return
  currentIndex.value = index
}

const runCommand = (
  command:
    | 'undo'
    | 'redo'
    | 'heading'
    | 'bulletList'
    | 'orderedList'
    | 'codeBlock'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strike'
    | 'superscript'
    | 'subscript'
    | 'alignLeft'
    | 'alignCenter'
    | 'alignRight'
    | 'alignJustify',
) => {
  if (!editor.value || isFinalized.value) return

  if (command === 'undo') {
    editor.value.chain().focus().undo().run()
    return
  }
  if (command === 'redo') {
    editor.value.chain().focus().redo().run()
    return
  }
  if (command === 'heading') {
    editor.value.chain().focus().toggleHeading({ level: 2 }).run()
    return
  }
  if (command === 'bulletList') {
    editor.value.chain().focus().toggleBulletList().run()
    return
  }
  if (command === 'orderedList') {
    editor.value.chain().focus().toggleOrderedList().run()
    return
  }
  if (command === 'codeBlock') {
    editor.value.chain().focus().toggleCodeBlock().run()
    return
  }
  if (command === 'bold') {
    editor.value.chain().focus().toggleBold().run()
    return
  }
  if (command === 'italic') {
    editor.value.chain().focus().toggleItalic().run()
    return
  }
  if (command === 'underline') {
    editor.value.chain().focus().toggleUnderline().run()
    return
  }
  if (command === 'strike') {
    editor.value.chain().focus().toggleStrike().run()
    return
  }
  if (command === 'superscript') {
    editor.value.chain().focus().toggleSuperscript().run()
    return
  }
  if (command === 'subscript') {
    editor.value.chain().focus().toggleSubscript().run()
    return
  }
  if (command === 'alignLeft') {
    editor.value.chain().focus().setTextAlign('left').run()
    return
  }
  if (command === 'alignCenter') {
    editor.value.chain().focus().setTextAlign('center').run()
    return
  }
  if (command === 'alignRight') {
    editor.value.chain().focus().setTextAlign('right').run()
    return
  }
  editor.value.chain().focus().setTextAlign('justify').run()
}

const isEditorActive = (name: string, attrs?: Record<string, unknown>) => {
  if (!editor.value) return false
  return editor.value.isActive(name, attrs)
}

const triggerToolbarImageUpload = () => {
  if (isFinalized.value) return
  toolbarFileInputRef.value?.click()
}

const syncEditorFromCurrentQuestion = () => {
  const question = currentQuestion.value
  if (!editor.value || !question) return
  if (isObjectiveQuestion(question)) return
  const html = answers.value[question.questionId] ?? ''
  syncingFromQuestion.value = true
  editor.value.commands.setContent(html, false)
  void nextTick(() => {
    syncingFromQuestion.value = false
  })
}

watch(currentQuestion, () => {
  syncEditorFromCurrentQuestion()
})

watch(isFinalized, (locked) => {
  editor.value?.setEditable(!locked)
})

const validateObjectiveQuestion = (question: SubmitQuestion) => {
  const payload = buildObjectiveAnswer(question)
  const type = objectiveTypeOf(question)
  if (type === 'SINGLE_CHOICE') {
    const value =
      typeof payload.selectedOptionId === 'string' ? payload.selectedOptionId.trim() : ''
    if (!value) return `第 ${question.questionIndex} 题请选择一个选项`
  }
  if (type === 'MULTI_CHOICE') {
    const values = Array.isArray(payload.selectedOptionIds)
      ? payload.selectedOptionIds
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
      : []
    if (!values.length) return `第 ${question.questionIndex} 题请至少选择一个选项`
  }
  if (type === 'JUDGE') {
    if (parseBooleanValue(payload.value) === null) return `第 ${question.questionIndex} 题请选择正确或错误`
  }
  if (type === 'FILL_BLANK') {
    const values = Array.isArray(payload.blanks)
      ? payload.blanks.map((item) => String(item ?? '').trim())
      : []
    if (!values.length || values.some((item) => item.length === 0)) {
      return `第 ${question.questionIndex} 题请填写所有空位`
    }
  }
  return ''
}

const validate = () => {
  for (const question of questions.value) {
    if (isObjectiveQuestion(question)) {
      const files = filesByQuestion.value[question.questionId] ?? []
      if (files.length > 0) {
        return `第 ${question.questionIndex} 题为客观题，不支持上传图片`
      }
      const message = validateObjectiveQuestion(question)
      if (message) return message
      continue
    }
    const html = answers.value[question.questionId] ?? ''
    const text = stripHtml(html)
    const files = filesByQuestion.value[question.questionId] ?? []
    if (!text && files.length === 0) {
      return `第 ${question.questionIndex} 题需要文字或图片`
    }
    if (files.length > 4) {
      return `第 ${question.questionIndex} 题最多 4 张图片`
    }
  }
  return ''
}

const submit = async () => {
  if (submitting.value) return
  error.value = ''
  const validationMessage = validate()
  if (validationMessage) {
    error.value = validationMessage
    return
  }

  submitting.value = true
  try {
    const payloadAnswers = questions.value.map((question) => {
      if (isObjectiveQuestion(question)) {
        const payload = buildObjectiveAnswer(question)
        const contentText = objectiveAnswerToText(question, payload)
        return {
          questionId: question.questionId,
          contentText,
          answerPayload: payload,
          answerFormat: 'STRUCTURED',
        }
      }
      return {
        questionId: question.questionId,
        contentText: answers.value[question.questionId] ?? '',
      }
    })
    const response = await uploadSubmission({
      assignmentId: assignmentId.value,
      answers: payloadAnswers,
      filesByQuestion: filesByQuestion.value,
    })
    const items = response?.data?.items ?? []
    const payloadAnswerMap = new Map(payloadAnswers.map((answer) => [answer.questionId, answer]))
    items.forEach((item) => {
      const answer = payloadAnswerMap.get(item.questionId)
      submittedMap.value[item.questionId] = {
        submissionVersionId: item.submissionVersionId,
        contentText: answer?.contentText ?? '',
        fileUrls: item.fileUrls ?? [],
        answerPayload: isRecord(answer?.answerPayload) ? answer?.answerPayload : null,
        answerFormat: typeof answer?.answerFormat === 'string' ? answer.answerFormat : null,
      }
    })
    previewUrls.value = {}
    filesByQuestion.value = {}
    showAppToast('已提交', 'success')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await refreshProfile()
  await loadSnapshot()
  await loadLatestSubmissions()
})

onBeforeUnmount(() => {
  dragDepth.value = 0
  dragActive.value = false
  Object.values(previewUrls.value).forEach((items) => {
    items.forEach((url) => URL.revokeObjectURL(url))
  })
  editor.value?.destroy()
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

.submit-layout {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 16px;
  align-items: start;
}

.question-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.sidebar-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 600;
}

.sidebar-item {
  border: none;
  border-radius: 10px;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
}

.sidebar-item.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #ffffff;
}

.sidebar-item.done {
  border: 1px solid rgba(120, 200, 170, 0.6);
}

.submit-list {
  display: grid;
  gap: 16px;
}

.submit-card {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 18px;
  padding: 16px;
  display: grid;
  gap: 10px;
}

.submit-prompt {
  font-size: 13px;
  color: #000000;
}

.submit-media {
  display: grid;
  gap: 10px;
}

.submit-media img {
  max-width: 100%;
  border-radius: 10px;
  background: #ffffff;
}

.objective-shell {
  border: 1px solid rgba(178, 194, 225, 0.55);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.objective-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.objective-option-list {
  display: grid;
  gap: 8px;
}

.objective-option {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(182, 197, 226, 0.45);
  background: rgba(255, 255, 255, 0.86);
}

.objective-option input {
  margin: 0;
  width: 14px;
  height: 14px;
}

.objective-option-id {
  min-width: 20px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  font-weight: 600;
}

.objective-option-text {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.88);
}

.blank-answer-list {
  display: grid;
  gap: 8px;
}

.blank-answer-item {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: 10px;
}

.blank-answer-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  font-weight: 600;
}

.blank-answer-item input {
  border: 1px solid rgba(174, 190, 220, 0.55);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: rgba(26, 29, 51, 0.86);
  font-size: 13px;
  padding: 7px 10px;
}

.blank-answer-item input:focus {
  outline: none;
  border-color: rgba(84, 126, 255, 0.55);
}

.editor-shell {
  border: 1px solid rgba(174, 190, 220, 0.55);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid rgba(178, 194, 225, 0.55);
  background: rgba(245, 249, 255, 0.9);
}

.tool-btn {
  border: none;
  background: transparent;
  color: rgba(26, 29, 51, 0.62);
  min-width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tool-btn:hover {
  background: rgba(84, 126, 255, 0.12);
}

.tool-btn.active {
  background: rgba(84, 126, 255, 0.18);
  color: #305fd3;
}

.tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-divider {
  width: 1px;
  height: 18px;
  background: rgba(170, 185, 210, 0.55);
  margin: 0 2px;
}

.tool-icon {
  width: 16px;
  height: 16px;
  pointer-events: none;
}

.hidden-input {
  display: none;
}

.editor-content-wrap {
  position: relative;
}

.editor-content {
  min-height: 160px;
}

.editor-content.drag-active {
  background: rgba(84, 126, 255, 0.08);
}

.editor-content :deep(.ProseMirror) {
  min-height: 160px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.75;
  color: rgba(26, 29, 51, 0.86);
  outline: none;
}

.editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: '输入文字答案（可留空，仅上传图片也可以）';
  float: left;
  color: rgba(26, 29, 51, 0.38);
  pointer-events: none;
  height: 0;
}

.editor-content :deep(.ProseMirror h2) {
  margin: 8px 0;
  font-size: 18px;
}

.editor-content :deep(.ProseMirror pre) {
  background: rgba(40, 48, 78, 0.9);
  color: #f8fbff;
  border-radius: 10px;
  padding: 10px;
}

.editor-content :deep(.ProseMirror ul),
.editor-content :deep(.ProseMirror ol) {
  padding-left: 18px;
}

.submit-files {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.submit-preview {
  margin-top: 10px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  display: grid;
  gap: 8px;
}

.preview-item {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.preview-remove {
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 15px;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
  background: rgba(26, 29, 51, 0.72);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.preview-remove:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selected-preview .preview-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 10px;
}

.selected-preview .preview-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
}

.selected-preview .preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  background: #ffffff;
}

.selected-preview .preview-remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

.parent-prompt {
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.question-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.nav-btn {
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.nav-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.nav-info {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 960px) {
  .submit-layout {
    grid-template-columns: 1fr;
  }

  .question-sidebar {
    position: static;
    grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  }
}

.preview-title {
  font-weight: 600;
  font-size: 13px;
}

.preview-text {
  font-size: 13px;
  white-space: pre-wrap;
}

.rich-text-preview :deep(p) {
  margin: 4px 0;
}

.preview-empty {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.5);
}

.preview-media {
  display: grid;
  gap: 8px;
}

.preview-media img {
  max-width: 100%;
  border-radius: 8px;
  background: #ffffff;
}

.submit-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.submit-actions .task-action.is-locked,
.submit-actions .task-action.is-locked:disabled {
  background: linear-gradient(135deg, rgba(88, 174, 255, 0.45), rgba(108, 229, 215, 0.45));
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: none;
  cursor: not-allowed;
}

.submit-error {
  font-size: 12px;
  color: #e76464;
}

.submit-lock {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}
</style>
