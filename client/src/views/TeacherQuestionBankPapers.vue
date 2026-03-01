<template>
  <TeacherLayout
    title="试卷库"
    subtitle="复用题库筛选与自定义题编辑，自行组卷并保存草稿"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库目录"
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

    <section class="panel glass paper-save-panel">
      <div class="panel-title">试卷信息</div>
      <div class="paper-save-grid">
        <div class="form-field">
          <label>试卷名称</label>
          <input v-model="paperName" type="text" placeholder="例如：高数A 第一章周测卷" />
        </div>
        <div class="paper-save-actions">
          <button class="primary-btn" type="button" @click="savePaper">保存试卷</button>
          <button class="primary-btn ghost" type="button" @click="createNewPaper()">新建试卷</button>
        </div>
      </div>
      <div class="helper-text">
        当前保存方式：后端存储（同账号跨设备可见）。
      </div>
      <div v-if="currentPaperId" class="helper-text">当前正在编辑：{{ currentPaperId }}</div>
    </section>

    <section class="panel glass">
      <div class="panel-title paper-list-title">
        <span>已保存试卷</span>
        <span class="badge">{{ savedPapers.length }} 份</span>
      </div>
      <div v-if="!savedPapers.length" class="empty-box">暂无已保存试卷</div>
      <div v-else class="saved-paper-list">
        <div v-for="paper in savedPapers" :key="paper.id" class="saved-paper-card">
          <div class="saved-paper-main">
            <div class="saved-paper-name">{{ paper.name }}</div>
            <div class="saved-paper-meta">
              <span>题库题 {{ paper.bankCount }}</span>
              <span>自定义题 {{ paper.customCount }}</span>
              <span>共 {{ paper.totalCount }} 题</span>
              <span>更新于 {{ formatDateTime(paper.updatedAt) }}</span>
            </div>
          </div>
          <div class="saved-paper-actions">
            <button class="qb-action" type="button" @click="loadPaper(paper.id)">载入</button>
            <button class="qb-action danger" type="button" @click="removePaper(paper.id)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel glass question-picker-panel">
      <div class="panel-title question-picker-title">
        <span>题库筛选</span>
        <span class="badge">{{ totalSelectedQuestionCount }} 题已选择</span>
      </div>

      <div class="question-source-tabs">
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'MIXED' }"
          @click="questionSourceMode = 'MIXED'"
        >
          混合组卷
        </button>
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'BANK' }"
          @click="questionSourceMode = 'BANK'"
        >
          从课本题库选题
        </button>
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'CUSTOM' }"
          @click="questionSourceMode = 'CUSTOM'"
        >
          自定义题目
        </button>
        <span class="helper-text source-tab-hint">课本筛选作为选题来源之一，可与自定义题混合保存为试卷</span>
      </div>

      <div class="question-picker-layout">
        <aside class="question-outline-panel">
          <div class="question-outline-head">
            <div class="question-outline-title">题目概览</div>
            <div class="helper-text">题库题 {{ bankSelectedCount }} · 自定义 {{ customSelectedCount }}</div>
          </div>
          <div v-if="!questionTypeOutline.length" class="empty-box question-outline-empty">尚未选题</div>
          <div v-else class="question-outline-list">
            <div v-for="item in questionTypeOutline" :key="item.type" class="question-outline-item">
              <span class="question-outline-label">{{ item.label }}</span>
              <span class="badge">{{ item.count }}</span>
            </div>
          </div>
        </aside>

        <div class="question-main-panel">
          <div v-if="questionSourceMode !== 'CUSTOM'" class="question-main-card">
            <div class="question-main-card-head">
              <div>
                <div class="question-main-card-title">课本筛选</div>
                <div class="helper-text">按课本章节筛选题库题目</div>
              </div>
              <div class="question-select-count">当前可选 {{ filteredQuestions.length }} 题</div>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-field">
                  <label>课本</label>
                  <select v-model="selectedTextbookId" @change="handleTextbookChange">
                    <option value="">请选择课本</option>
                    <option v-for="book in textbooks" :key="book.id" :value="book.id">{{ book.title }}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>章节</label>
                  <div class="form-row">
                    <div class="form-field">
                      <select v-model="selectedParentChapterId" @change="handleParentChapterChange">
                        <option value="">请选择大章节</option>
                        <option v-for="chapter in parentChapterOptions" :key="chapter.id" :value="chapter.id">
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
                <button class="primary-btn" type="button" @click="selectAllVisible">全选当前章节</button>
                <button class="primary-btn ghost" type="button" @click="clearSelection">清空选择</button>
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
                  <span v-if="item.isExpandable" class="qb-expand" @click.stop="toggleExpand(item.id)">
                    {{ expandedIds.has(item.id) ? '▾' : '▸' }}
                  </span>
                  <span class="qb-title-text" @click="item.isExpandable ? toggleExpand(item.id) : viewDetail(item.id)">
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
                  <button class="qb-action qb-detail-btn" type="button" @click.stop="viewDetail(item.id)">
                    详情
                  </button>
                </div>
              </div>
              <div v-if="!filteredQuestions.length" class="empty-box">{{ questionError || '暂无题目' }}</div>
            </div>
            <div v-if="filteredQuestions.length > 12" class="qb-footer">
              <button class="qb-toggle" type="button" @click="expandQuestionList = !expandQuestionList">
                {{ expandQuestionList ? '收起列表' : '展开全部' }}
              </button>
              <div class="helper-text">可滚动浏览更多题目</div>
            </div>
          </div>

          <div v-if="questionSourceMode !== 'BANK'" class="question-main-card">
            <div class="custom-builder">
              <div class="custom-builder-header">
                <div class="custom-builder-title">自定义题目</div>
                <div class="custom-builder-actions">
                  <button
                    v-for="type in quickQuestionTypes"
                    :key="type.value"
                    class="custom-type-btn"
                    type="button"
                    @click="addCustomQuestion(type.value)"
                  >
                    + {{ type.label }}
                  </button>
                </div>
              </div>
              <div v-if="!customQuestions.length" class="empty-box">
                还没有自定义题目，可点击上方按钮添加并与题库题混合保存
              </div>
              <div v-else class="custom-list">
                <div v-for="(question, index) in customQuestions" :key="question.tempId" class="custom-card">
                  <div class="custom-card-head">
                    <div class="custom-card-title">
                      <span class="badge">{{ customTypeLabel(question.questionType) }}</span>
                      <span>自定义第 {{ index + 1 }} 题</span>
                    </div>
                    <button class="qb-action danger" type="button" @click="removeCustomQuestion(question.tempId)">
                      删除
                    </button>
                  </div>
                  <div class="form-row">
                    <div class="form-field">
                      <label>题目标题（可选）</label>
                      <input
                        v-model="question.title"
                        type="text"
                        :placeholder="`例如：${customTypeLabel(question.questionType)}第 ${index + 1} 题`"
                      />
                    </div>
                    <div class="form-field">
                      <label>题目分值</label>
                      <input v-model.number="question.defaultScore" type="number" min="1" step="1" />
                    </div>
                  </div>
                  <div class="form-field">
                    <label>题干</label>
                    <TiptapInput
                      v-model="question.prompt"
                      :min-height="150"
                      placeholder="请输入题干内容，可使用 LaTeX 公式"
                    />
                  </div>

                  <div v-if="['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(question.questionType)" class="form-field">
                    <label>选项</label>
                    <div class="option-list">
                      <div v-for="option in question.options" :key="option.id" class="option-row">
                        <span class="option-id">{{ option.id }}</span>
                        <input
                          v-model="option.text"
                          type="text"
                          :placeholder="`选项 ${option.id}`"
                          :disabled="question.questionType === 'JUDGE'"
                        />
                        <button
                          v-if="question.questionType !== 'JUDGE' && question.options.length > 2"
                          class="qb-action"
                          type="button"
                          @click="removeOption(question.tempId, option.id)"
                        >
                          移除
                        </button>
                      </div>
                      <button v-if="question.questionType !== 'JUDGE'" class="qb-action" type="button" @click="appendOption(question.tempId)">
                        添加选项
                      </button>
                    </div>
                  </div>

                  <div v-if="question.questionType === 'SINGLE_CHOICE'" class="form-field">
                    <label>标准答案（单选）</label>
                    <div class="answer-option-list">
                      <label
                        v-for="option in question.options"
                        :key="`single-${question.tempId}-${option.id}`"
                        class="answer-option"
                      >
                        <input
                          type="radio"
                          :name="`single-${question.tempId}`"
                          :checked="question.correctOptionIds[0] === option.id"
                          @change="setSingleChoiceAnswer(question.tempId, option.id)"
                        />
                        {{ option.id }}
                      </label>
                    </div>
                  </div>

                  <div v-if="question.questionType === 'MULTI_CHOICE'" class="form-field">
                    <label>标准答案（多选）</label>
                    <div class="answer-option-list">
                      <label
                        v-for="option in question.options"
                        :key="`multi-${question.tempId}-${option.id}`"
                        class="answer-option"
                      >
                        <input
                          type="checkbox"
                          :checked="question.correctOptionIds.includes(option.id)"
                          @change="toggleMultiChoiceAnswer(question.tempId, option.id)"
                        />
                        {{ option.id }}
                      </label>
                    </div>
                  </div>

                  <div v-if="question.questionType === 'JUDGE'" class="form-field">
                    <label>标准答案（判断）</label>
                    <div class="answer-option-list">
                      <label class="answer-option">
                        <input
                          type="radio"
                          :name="`judge-${question.tempId}`"
                          :checked="question.judgeAnswer === true"
                          @change="setJudgeAnswer(question.tempId, true)"
                        />
                        正确
                      </label>
                      <label class="answer-option">
                        <input
                          type="radio"
                          :name="`judge-${question.tempId}`"
                          :checked="question.judgeAnswer === false"
                          @change="setJudgeAnswer(question.tempId, false)"
                        />
                        错误
                      </label>
                    </div>
                  </div>

                  <div v-if="question.questionType === 'FILL_BLANK'" class="form-field">
                    <label>标准答案（填空）</label>
                    <div class="blank-list">
                      <div v-for="(_, blankIndex) in question.blankAnswers" :key="`blank-${question.tempId}-${blankIndex}`" class="blank-row">
                        <input v-model="question.blankAnswers[blankIndex]" type="text" :placeholder="`第 ${blankIndex + 1} 空答案`" />
                        <button v-if="question.blankAnswers.length > 1" class="qb-action" type="button" @click="removeBlankAnswer(question.tempId, blankIndex)">
                          移除
                        </button>
                      </div>
                      <button class="qb-action" type="button" @click="appendBlankAnswer(question.tempId)">添加空位</button>
                    </div>
                  </div>

                  <div v-if="['SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'PROOF'].includes(question.questionType)" class="form-field">
                    <label>标准答案（主观题）</label>
                    <TiptapInput
                      v-model="question.standardAnswerText"
                      :min-height="140"
                      placeholder="用于对照的标准答案、关键步骤或评分参考"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button class="primary-btn" type="button" @click="savePaper">保存试卷</button>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import TiptapInput from '../components/TiptapInput.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import {
  deleteQuestionBankPaper,
  getQuestionBankPaper,
  getQuestionBankStructure,
  listQuestionBank,
  listQuestionBankPapers,
  saveQuestionBankPaper,
  type QuestionBankItem,
} from '../api/questionBank'
import { showAppToast } from '../composables/useAppToast'

type CustomQuestionDraft = {
  tempId: string
  questionType: string
  title: string
  prompt: string
  defaultScore: number
  allowPartial: boolean
  options: Array<{ id: string; text: string }>
  correctOptionIds: string[]
  judgeAnswer: boolean | null
  blankAnswers: string[]
  standardAnswerText: string
}

type SavedPaper = {
  id: string
  name: string
  updatedAt: string
  createdAt: string
  questionSourceMode: 'MIXED' | 'BANK' | 'CUSTOM'
  selectedTextbookId: string
  selectedParentChapterId: string
  selectedChapterId: string
  selectedQuestionIds: string[]
  selectedQuestionOrder: string[]
  customQuestions: CustomQuestionDraft[]
  bankCount?: number
  customCount?: number
  totalCount?: number
}

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()

const textbooks = ref<Array<{ id: string; title: string }>>([])
const chapters = ref<any[]>([])
const questions = ref<QuestionBankItem[]>([])
const expandedIds = ref(new Set<string>())
const selectedQuestionIds = ref(new Set<string>())
const selectedQuestionOrder = ref<string[]>([])
const customQuestions = ref<CustomQuestionDraft[]>([])
const customQuestionCounter = ref(1)
const expandQuestionList = ref(false)

const selectedTextbookId = ref('')
const selectedParentChapterId = ref('')
const selectedChapterId = ref('')
const questionSourceMode = ref<'MIXED' | 'BANK' | 'CUSTOM'>('MIXED')

const questionError = ref('')
const paperName = ref('')
const currentPaperId = ref('')
const savedPapers = ref<SavedPaper[]>([])

const customTypeLabels: Record<string, string> = {
  SINGLE_CHOICE: '单选题',
  MULTI_CHOICE: '多选题',
  FILL_BLANK: '填空题',
  JUDGE: '判断题',
  SHORT_ANSWER: '简答题',
  ESSAY: '论述题',
  CALCULATION: '计算题',
  PROOF: '证明题',
}

const quickQuestionTypes = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTI_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'JUDGE', label: '判断题' },
  { value: 'SHORT_ANSWER', label: '简答题' },
  { value: 'CALCULATION', label: '计算题' },
]

const customTypeLabel = (questionType: string) => customTypeLabels[questionType] ?? '题目'

const createOptionList = (forJudge = false) => {
  if (forJudge) return [{ id: 'A', text: '正确' }, { id: 'B', text: '错误' }]
  return [{ id: 'A', text: '' }, { id: 'B', text: '' }]
}

const nextOptionId = (options: Array<{ id: string; text: string }>) => {
  const code = 'A'.charCodeAt(0) + options.length
  if (code <= 'Z'.charCodeAt(0)) return String.fromCharCode(code)
  return `OPT_${options.length + 1}`
}

const createCustomQuestionDraft = (questionType: string): CustomQuestionDraft => {
  const tempId = `tmp-${Date.now()}-${customQuestionCounter.value}`
  customQuestionCounter.value += 1
  const isJudge = questionType === 'JUDGE'
  return {
    tempId,
    questionType,
    title: '',
    prompt: '',
    defaultScore: 10,
    allowPartial: questionType === 'MULTI_CHOICE' || questionType === 'FILL_BLANK',
    options: ['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(questionType)
      ? createOptionList(isJudge)
      : [],
    correctOptionIds: questionType === 'JUDGE' ? ['A'] : [],
    judgeAnswer: questionType === 'JUDGE' ? true : null,
    blankAnswers: questionType === 'FILL_BLANK' ? [''] : [],
    standardAnswerText: '',
  }
}

const sanitizeCustomQuestionDraft = (input: any): CustomQuestionDraft | null => {
  if (!input || typeof input !== 'object') return null
  const questionType = String(input.questionType || '').toUpperCase()
  if (!customTypeLabels[questionType]) return null
  const draft = createCustomQuestionDraft(questionType)
  draft.title = String(input.title || '')
  draft.prompt = String(input.prompt || '')
  draft.defaultScore = Number(input.defaultScore) > 0 ? Number(input.defaultScore) : 10
  draft.allowPartial = Boolean(input.allowPartial)
  if (Array.isArray(input.options)) {
    const options = input.options
      .map((item: any) => ({ id: String(item?.id || '').trim(), text: String(item?.text || '') }))
      .filter((item: any) => item.id)
    if (options.length >= 2) draft.options = options
  }
  if (Array.isArray(input.correctOptionIds)) {
    draft.correctOptionIds = input.correctOptionIds.map((item: any) => String(item)).filter(Boolean)
  }
  if (typeof input.judgeAnswer === 'boolean') draft.judgeAnswer = input.judgeAnswer
  if (Array.isArray(input.blankAnswers) && input.blankAnswers.length) {
    draft.blankAnswers = input.blankAnswers.map((item: any) => String(item ?? ''))
  }
  draft.standardAnswerText = String(input.standardAnswerText || '')
  return draft
}

const addCustomQuestion = (questionType: string) => {
  customQuestions.value = [...customQuestions.value, createCustomQuestionDraft(questionType)]
}

const removeCustomQuestion = (tempId: string) => {
  customQuestions.value = customQuestions.value.filter((item) => item.tempId !== tempId)
}

const findCustomQuestion = (tempId: string) => customQuestions.value.find((item) => item.tempId === tempId)

const appendOption = (tempId: string) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.options.push({ id: nextOptionId(question.options), text: '' })
}

const removeOption = (tempId: string, optionId: string) => {
  const question = findCustomQuestion(tempId)
  if (!question || question.options.length <= 2) return
  question.options = question.options.filter((option) => option.id !== optionId)
  question.correctOptionIds = question.correctOptionIds.filter((id) => id !== optionId)
}

const setSingleChoiceAnswer = (tempId: string, optionId: string) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.correctOptionIds = [optionId]
}

const toggleMultiChoiceAnswer = (tempId: string, optionId: string) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  if (question.correctOptionIds.includes(optionId)) {
    question.correctOptionIds = question.correctOptionIds.filter((id) => id !== optionId)
  } else {
    question.correctOptionIds = [...question.correctOptionIds, optionId]
  }
}

const setJudgeAnswer = (tempId: string, value: boolean) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.judgeAnswer = value
  question.correctOptionIds = [value ? 'A' : 'B']
}

const appendBlankAnswer = (tempId: string) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.blankAnswers.push('')
}

const removeBlankAnswer = (tempId: string, blankIndex: number) => {
  const question = findCustomQuestion(tempId)
  if (!question || question.blankAnswers.length <= 1) return
  question.blankAnswers.splice(blankIndex, 1)
}

const getQuestionLabel = (item: any) => {
  const title = item.title?.trim()
  if (title) return title
  if (typeof item.prompt === 'string') return item.prompt.slice(0, 24)
  if (item.prompt?.text) return String(item.prompt.text).slice(0, 24)
  return '未命名题目'
}

const parentChapterOptions = computed(() => {
  if (!selectedTextbookId.value) return []
  const items = chapters.value.filter((chapter: any) => chapter.textbookId === selectedTextbookId.value)
  const parentIds = new Set(items.map((item: any) => item.parentId).filter(Boolean))
  return items
    .filter((item: any) => parentIds.has(item.id) || !item.parentId)
    .sort((a: any, b: any) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const childChapterOptions = computed(() => {
  if (!selectedParentChapterId.value) return []
  return chapters.value
    .filter((chapter: any) => chapter.parentId === selectedParentChapterId.value)
    .sort((a: any, b: any) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const filteredQuestions = computed(() => {
  if (!selectedChapterId.value) return []
  return questions.value
    .filter((item) => item.chapterId === selectedChapterId.value)
    .map((item) => ({ ...item, label: getQuestionLabel(item) }))
})

const parseQuestionIndex = (item: any) => {
  const text = `${item?.title ?? ''} ${item?.label ?? ''}`
  const match = text.match(/第\s*(\d+)\s*题/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const flattenedQuestions = computed(() => {
  const byParent = new Map<string, any[]>()
  filteredQuestions.value.forEach((item: any, idx: number) => {
    const parentId = item.parentId ?? ''
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId)!.push({ ...item, __index: idx })
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
  const result: any[] = []
  const walk = (parentId: string, depth: number) => {
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
  return expandQuestionList.value ? list : list.slice(0, 12)
})

const handleTextbookChange = () => {
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
}

const handleParentChapterChange = () => {
  selectedChapterId.value = ''
}

const filteredQuestionById = computed(() => new Map(filteredQuestions.value.map((item: any) => [item.id, item])))
const questionById = computed(() => new Map(questions.value.map((item) => [item.id, item])))

const isDescendantOf = (itemId: string, ancestorId: string) => {
  let current: any = filteredQuestionById.value.get(itemId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = filteredQuestionById.value.get(current.parentId)
  }
  return false
}

const getDescendantLeafIdsInOrder = (groupId: string) =>
  flattenedQuestions.value
    .filter((item) => item.nodeType === 'LEAF' && isDescendantOf(item.id, groupId))
    .map((item) => item.id)

const isGroupChecked = (groupId: string) => {
  const ids = getDescendantLeafIdsInOrder(groupId)
  return ids.length > 0 && ids.every((id) => selectedQuestionIds.value.has(id))
}

const toggleQuestion = (id: string) => {
  const item: any = questions.value.find((q: any) => q.id === id)
  if (!item) return
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]

  if (item.nodeType === 'GROUP') {
    const leafIds = getDescendantLeafIdsInOrder(item.id)
    if (!leafIds.length) return
    const allSelected = leafIds.every((leafId) => next.has(leafId))
    if (allSelected) {
      leafIds.forEach((leafId) => next.delete(leafId))
      const removeSet = new Set(leafIds)
      selectedQuestionOrder.value = order.filter((leafId) => !removeSet.has(leafId))
      selectedQuestionIds.value = next
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
      if (!order.includes(item.id)) order.push(item.id)
    }
  }
  selectedQuestionIds.value = next
  selectedQuestionOrder.value = order
}

const clearSelection = () => {
  selectedQuestionIds.value = new Set()
  selectedQuestionOrder.value = []
}

const toggleExpand = (questionId: string) => {
  const next = new Set(expandedIds.value)
  if (next.has(questionId)) next.delete(questionId)
  else next.add(questionId)
  expandedIds.value = next
}

const getStemText = (item: any) => {
  if (!item?.stem) return ''
  if (typeof item.stem === 'string') return item.stem
  return item.stem.text ?? ''
}

const getQuestionPreviewText = (item: any) => {
  if (!item) return ''
  const stem = getStemText(item)
  if (stem) return stem
  if (typeof item.prompt === 'string') return item.prompt
  if (item.prompt?.text) return item.prompt.text
  if (item.description) return item.description
  return ''
}

const getQuestionPreview = (item: any) => {
  const text = getQuestionPreviewText(item)
  return text ? text.replace(/\n/g, '<br />') : ''
}

const renderStemHtml = (item: any) => {
  const text = getStemText(item)
  return text ? text.replace(/\n/g, '<br />') : ''
}

const getItemTitle = (item: any) => {
  if (item?.title) return item.title
  if (item?.depth > 0) return `（${item.displayOrder ?? 1}）`
  return '未命名'
}

const orderedSelectedQuestions = computed(() => {
  const map = questionById.value
  return selectedQuestionOrder.value.map((id) => map.get(id)).filter((item: any) => item && item.nodeType === 'LEAF')
})

const orderedPublishQuestions = computed(() => {
  const bankPart = orderedSelectedQuestions.value.map((question: any, index) => ({
    key: question.id,
    source: 'bank',
    questionType: String(question.questionType || 'SHORT_ANSWER'),
    orderNo: index + 1,
    raw: question,
  }))
  const customPart = customQuestions.value.map((question, index) => ({
    key: `custom:${question.tempId}`,
    source: 'custom',
    questionType: question.questionType,
    orderNo: bankPart.length + index + 1,
    raw: question,
  }))
  return [...bankPart, ...customPart]
})

const totalSelectedQuestionCount = computed(() => orderedPublishQuestions.value.length)
const bankSelectedCount = computed(() => selectedQuestionIds.value.size)
const customSelectedCount = computed(() => customQuestions.value.length)

const questionTypeOutline = computed(() => {
  const typeOrder = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK', 'JUDGE', 'SHORT_ANSWER', 'CALCULATION', 'ESSAY', 'PROOF']
  const bucket = new Map<string, number>()
  orderedPublishQuestions.value.forEach((question) => {
    const type = String(question.questionType || 'SHORT_ANSWER')
    bucket.set(type, (bucket.get(type) || 0) + 1)
  })
  return typeOrder
    .map((type) => ({ type, label: customTypeLabel(type), count: bucket.get(type) || 0 }))
    .filter((item) => item.count > 0)
})

const viewDetail = (questionId: string) => {
  router.push({ path: `/teacher/question-bank/questions/${questionId}`, query: { from: 'papers' } })
}

const validateCustomQuestion = (question: CustomQuestionDraft, displayIndex: number) => {
  const label = `${customTypeLabel(question.questionType)}（第 ${displayIndex} 题）`
  if (!String(question.prompt || '').trim()) return `${label}缺少题干`
  if (!Number.isFinite(Number(question.defaultScore)) || Number(question.defaultScore) <= 0) return `${label}分值必须大于 0`
  if (['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(question.questionType)) {
    if (question.options.length < 2) return `${label}至少需要 2 个选项`
    if (question.options.find((option) => !String(option.text || '').trim())) return `${label}存在空选项，请补全`
    if (question.questionType === 'SINGLE_CHOICE' && question.correctOptionIds.length !== 1) return `${label}请选择 1 个标准答案`
    if (question.questionType === 'MULTI_CHOICE' && question.correctOptionIds.length < 1) return `${label}请至少选择 1 个标准答案`
    if (question.questionType === 'JUDGE' && typeof question.judgeAnswer !== 'boolean') return `${label}请设置判断题标准答案`
  }
  if (question.questionType === 'FILL_BLANK') {
    if (!question.blankAnswers.length) return `${label}至少需要 1 个填空答案`
    if (question.blankAnswers.find((item) => !String(item || '').trim())) return `${label}存在空白答案，请补全`
  }
  if (['SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'PROOF'].includes(question.questionType)) {
    if (!String(question.standardAnswerText || '').trim()) return `${label}请填写标准答案`
  }
  return ''
}

const buildPaperPayload = (): SavedPaper | null => {
  if (!paperName.value.trim()) {
    showAppToast('请填写试卷名称', 'error')
    return null
  }
  if (!orderedPublishQuestions.value.length) {
    showAppToast('请至少选择或创建一道题目', 'error')
    return null
  }
  for (let i = 0; i < customQuestions.value.length; i += 1) {
    const question = customQuestions.value[i]
    if (!question) {
      showAppToast('自定义题数据异常，请刷新后重试', 'error')
      return null
    }
    const msg = validateCustomQuestion(question, i + 1)
    if (msg) {
      showAppToast(msg, 'error')
      return null
    }
  }
  const now = new Date().toISOString()
  return {
    id: currentPaperId.value || (globalThis.crypto?.randomUUID?.() ?? `paper-${Date.now()}`),
    name: paperName.value.trim(),
    createdAt: currentPaperId.value ? (savedPapers.value.find((i) => i.id === currentPaperId.value)?.createdAt ?? now) : now,
    updatedAt: now,
    questionSourceMode: questionSourceMode.value,
    selectedTextbookId: selectedTextbookId.value,
    selectedParentChapterId: selectedParentChapterId.value,
    selectedChapterId: selectedChapterId.value,
    selectedQuestionIds: Array.from(selectedQuestionIds.value),
    selectedQuestionOrder: [...selectedQuestionOrder.value],
    customQuestions: customQuestions.value.map((item) => ({ ...item, options: item.options.map((opt) => ({ ...opt })), blankAnswers: [...item.blankAnswers], correctOptionIds: [...item.correctOptionIds] })),
  }
}

const fetchSavedPaperList = async () => {
  try {
    const rows = await listQuestionBankPapers()
    savedPapers.value = (rows ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      questionSourceMode: 'MIXED',
      selectedTextbookId: '',
      selectedParentChapterId: '',
      selectedChapterId: '',
      selectedQuestionIds: [],
      selectedQuestionOrder: [],
      customQuestions: [],
      bankCount: Number(item.bankCount ?? 0),
      customCount: Number(item.customCount ?? 0),
      totalCount: Number(item.totalCount ?? 0),
    })) as any
  } catch (err: any) {
    showAppToast(err instanceof Error ? err.message : '加载试卷列表失败', 'error')
    savedPapers.value = []
  }
}

const savePaper = async () => {
  const payload = buildPaperPayload()
  if (!payload) return
  try {
    const saved = await saveQuestionBankPaper({
      id: payload.id,
      name: payload.name,
      content: {
        questionSourceMode: payload.questionSourceMode,
        selectedTextbookId: payload.selectedTextbookId,
        selectedParentChapterId: payload.selectedParentChapterId,
        selectedChapterId: payload.selectedChapterId,
        selectedQuestionIds: payload.selectedQuestionIds,
        selectedQuestionOrder: payload.selectedQuestionOrder,
        customQuestions: payload.customQuestions,
      },
    })
    currentPaperId.value = saved.id
    await fetchSavedPaperList()
    showAppToast('试卷已保存', 'success')
  } catch (err: any) {
    showAppToast(err instanceof Error ? err.message : '保存试卷失败', 'error')
  }
}

const loadPaper = async (paperId: string) => {
  try {
    const item = await getQuestionBankPaper(paperId)
    const content = (item as any)?.content ?? {}
    currentPaperId.value = item.id
    paperName.value = item.name
    questionSourceMode.value =
      content.questionSourceMode === 'BANK' || content.questionSourceMode === 'CUSTOM'
        ? content.questionSourceMode
        : 'MIXED'
    selectedTextbookId.value = String(content.selectedTextbookId ?? '')
    selectedParentChapterId.value = String(content.selectedParentChapterId ?? '')
    selectedChapterId.value = String(content.selectedChapterId ?? '')
    selectedQuestionIds.value = new Set(
      Array.isArray(content.selectedQuestionIds)
        ? content.selectedQuestionIds.map((v: any) => String(v)).filter(Boolean)
        : [],
    )
    selectedQuestionOrder.value = Array.isArray(content.selectedQuestionOrder)
      ? content.selectedQuestionOrder.map((v: any) => String(v)).filter(Boolean)
      : Array.from(selectedQuestionIds.value)
    const restoredCustomQuestions: CustomQuestionDraft[] = []
    if (Array.isArray(content.customQuestions)) {
      for (const rawQuestion of content.customQuestions) {
        const normalized = sanitizeCustomQuestionDraft(rawQuestion)
        if (normalized) {
          restoredCustomQuestions.push(normalized)
        }
      }
    }
    customQuestions.value = restoredCustomQuestions
    customQuestionCounter.value = customQuestions.value.length + 1
    showAppToast('试卷已载入', 'success')
  } catch (err: any) {
    showAppToast(err instanceof Error ? err.message : '载入试卷失败', 'error')
  }
}

const removePaper = async (paperId: string) => {
  try {
    await deleteQuestionBankPaper(paperId)
    if (currentPaperId.value === paperId) createNewPaper(false)
    await fetchSavedPaperList()
    showAppToast('试卷已删除', 'success')
  } catch (err: any) {
    showAppToast(err instanceof Error ? err.message : '删除试卷失败', 'error')
  }
}

const createNewPaper = (notify = true) => {
  currentPaperId.value = ''
  paperName.value = ''
  selectedTextbookId.value = ''
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
  selectedQuestionIds.value = new Set()
  selectedQuestionOrder.value = []
  customQuestions.value = []
  expandedIds.value = new Set()
  questionSourceMode.value = 'MIXED'
  if (notify) showAppToast('已新建空白试卷', 'success')
}

const formatDateTime = (value: string) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const fetchQuestionResources = async () => {
  questionError.value = ''
  try {
    const [structure, allQuestions] = await Promise.all([getQuestionBankStructure(), listQuestionBank()])
    textbooks.value = (structure.textbooks ?? []).map((item: any) => ({ id: item.id, title: item.title }))
    chapters.value = structure.chapters ?? []
    questions.value = allQuestions ?? []
  } catch (err: any) {
    questionError.value = err instanceof Error ? err.message : '加载题库失败'
  }
}

onMounted(async () => {
  await refreshProfile()
  await fetchSavedPaperList()
  await fetchQuestionResources()
})
</script>

<style scoped>
.paper-save-panel,
.question-picker-panel {
  display: grid;
  gap: 14px;
}

.paper-save-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.paper-save-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.paper-list-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.saved-paper-list {
  display: grid;
  gap: 10px;
}

.saved-paper-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.45);
  background: rgba(255, 255, 255, 0.66);
  padding: 12px 14px;
}

.saved-paper-name {
  font-size: 15px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.92);
}

.saved-paper-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: rgba(26, 29, 51, 0.58);
  font-size: 12px;
}

.saved-paper-actions {
  display: flex;
  gap: 8px;
}

.question-picker-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.question-source-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(196, 213, 238, 0.5);
}

.source-tab {
  border: 1px solid rgba(183, 201, 230, 0.7);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: rgba(26, 29, 51, 0.74);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.source-tab:hover { border-color: rgba(122, 166, 233, 0.8); color: rgba(26, 29, 51, 0.9); }

.source-tab.active {
  border-color: rgba(99, 146, 232, 0.85);
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #fff;
}

.source-tab-hint { margin-left: auto; }

.question-picker-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.question-outline-panel {
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.5);
  background: rgba(255, 255, 255, 0.66);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.question-outline-head { display: grid; gap: 4px; }
.question-outline-title { font-size: 15px; font-weight: 700; color: rgba(26, 29, 51, 0.92); }
.question-outline-empty { min-height: 160px; display: flex; align-items: center; justify-content: center; }
.question-outline-list { display: grid; gap: 8px; }
.question-outline-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.6); }
.question-outline-label { font-size: 13px; color: rgba(26,29,51,0.82); font-weight: 600; }

.question-main-panel { display: grid; gap: 14px; }

.question-main-card {
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.5);
  background: rgba(255, 255, 255, 0.66);
  padding: 12px;
  display: grid;
  gap: 12px;
}

.question-main-card-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;
}
.question-main-card-title { font-size: 15px; font-weight: 700; color: rgba(26,29,51,0.92); }
.question-select-count { font-size: 12px; color: rgba(26,29,51,0.56); }
.question-select-actions { display: flex; gap: 10px; align-items: center; }

.qb-list { display: grid; gap: 8px; }
.qb-list-scroll { max-height: 420px; overflow: auto; padding-right: 4px; }
.qb-item {
  border-radius: 12px; border: 1px solid rgba(196,213,238,0.42); background: rgba(255,255,255,0.66); padding: 10px 12px;
}
.qb-item.active { border-color: rgba(103, 151, 235, 0.65); box-shadow: 0 6px 18px rgba(106,155,227,0.12); }
.qb-item-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.qb-indent { width: 12px; }
.qb-expand { cursor: pointer; color: rgba(26,29,51,0.6); width: 14px; text-align: center; user-select: none; }
.qb-title-text { font-weight: 700; color: rgba(26,29,51,0.9); cursor: pointer; }
.qb-stem, .qb-preview-inline { color: rgba(26,29,51,0.75); font-size: 13px; line-height: 1.45; flex: 1 1 100%; margin-left: 28px; }
.qb-preview-inline { margin-left: 28px; }
.qb-action {
  border: 1px solid rgba(183, 201, 230, 0.7);
  background: rgba(255,255,255,0.88);
  color: rgba(26,29,51,0.78);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.qb-action:hover { border-color: rgba(122,166,233,0.8); }
.qb-action.danger { color: #d25858; border-color: rgba(226,160,160,0.65); }
.qb-detail-btn { margin-left: auto; }
.qb-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.qb-toggle { border: none; background: transparent; color: #4b80e6; font-weight: 700; cursor: pointer; }

.custom-builder { display: grid; gap: 12px; }
.custom-builder-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.custom-builder-title { font-size: 15px; font-weight: 700; color: rgba(26,29,51,0.92); }
.custom-builder-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.custom-type-btn {
  border: 1px solid rgba(183,201,230,0.7);
  border-radius: 999px;
  background: rgba(255,255,255,0.88);
  color: rgba(26,29,51,0.78);
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
}
.custom-type-btn:hover { border-color: rgba(122,166,233,0.8); color: rgba(26,29,51,0.92); }
.custom-list { display: grid; gap: 12px; }
.custom-card { border: 1px solid rgba(196,213,238,0.5); border-radius: 14px; background: rgba(255,255,255,0.74); padding: 12px; display: grid; gap: 10px; }
.custom-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.custom-card-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 700; color: rgba(26,29,51,0.9); }

.option-list, .blank-list { display: grid; gap: 8px; }
.option-row, .blank-row { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 8px; align-items: center; }
.option-id {
  min-width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: rgba(242,246,255,0.9); color: rgba(63,91,145,0.85); font-weight: 700; font-size: 12px;
}
.answer-option-list { display: flex; gap: 14px; flex-wrap: wrap; }
.answer-option { display: inline-flex; align-items: center; gap: 6px; color: rgba(26,29,51,0.82); font-size: 13px; }

.step-actions { display: flex; justify-content: flex-end; gap: 10px; }

.empty-box {
  border: 1px dashed rgba(183, 201, 230, 0.7);
  background: rgba(255,255,255,0.56);
  border-radius: 12px;
  padding: 16px;
  color: rgba(26,29,51,0.52);
  text-align: center;
}

@media (max-width: 1200px) {
  .question-picker-layout { grid-template-columns: 1fr; }
  .paper-save-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .source-tab-hint { margin-left: 0; width: 100%; }
  .saved-paper-card { grid-template-columns: 1fr; }
  .saved-paper-actions { justify-content: flex-end; }
  .option-row, .blank-row { grid-template-columns: 1fr; }
  .qb-detail-btn { margin-left: 0; }
}
</style>
