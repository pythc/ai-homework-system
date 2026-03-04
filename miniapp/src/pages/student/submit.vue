<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card fx-fade-in">
      <view class="ui-header-main">
        <view class="ui-title">作业提交</view>
        <view class="ui-subtitle">{{ assignment.title || '未命名作业' }}</view>
      </view>
      <button class="ui-btn-ghost back-btn" @click="goBack">返回</button>
    </view>

    <view class="ui-card block-card fx-fade-up fx-delay-1" v-if="visibleBlocked">
      <view class="ui-empty">教师设置提交后暂不可见</view>
    </view>

    <view v-else-if="currentQuestion" class="ui-card submit-card fx-scale-in fx-delay-1">
      <scroll-view class="index-list" scroll-x>
        <view
          v-for="(q, idx) in questions"
          :key="q.questionId"
          class="index-item fx-fade-up"
          :class="{ active: idx === currentIndex }"
          @click="currentIndex = idx"
        >
          {{ questionIndexLabel(idx) }}
        </view>
      </scroll-view>

      <view class="question-head">
        <view class="question-no">{{ displayQuestionIndex }}.</view>
        <view class="question-type">{{ questionTypeLabel(currentQuestion.questionType) }}</view>
      </view>

      <view class="prompt-box">
        <text class="prompt-text" user-select>{{ renderPrompt(currentQuestion) }}</text>
      </view>

      <view v-if="isSingleChoice(currentQuestion)" class="choice-list">
        <label
          v-for="opt in getOptions(currentQuestion)"
          :key="opt.id"
          class="choice-item fx-fade-up"
        >
          <radio
            :value="opt.id"
            :checked="getAnswerPayload(currentQuestion.questionId).optionIds?.[0] === opt.id"
            @click="setSingleChoice(currentQuestion.questionId, opt.id)"
          />
          <text class="choice-text">{{ opt.id }}. {{ formatOptionText(opt.text) }}</text>
        </label>
      </view>

      <view v-else-if="isMultiChoice(currentQuestion)" class="choice-list">
        <label v-for="opt in getOptions(currentQuestion)" :key="opt.id" class="choice-item fx-fade-up">
          <checkbox
            :value="opt.id"
            :checked="(getAnswerPayload(currentQuestion.questionId).optionIds || []).includes(opt.id)"
            @click="toggleMultiChoice(currentQuestion.questionId, opt.id)"
          />
          <text class="choice-text">{{ opt.id }}. {{ formatOptionText(opt.text) }}</text>
        </label>
      </view>

      <view v-else-if="isFillBlank(currentQuestion)" class="blank-list">
        <input
          v-for="(_, idx) in getBlankCount(currentQuestion)"
          :key="idx"
          class="ui-input"
          :placeholder="`填空 ${idx + 1}`"
          :value="getBlankAnswers(currentQuestion.questionId)[idx] || ''"
          @input="setBlankAnswer(currentQuestion.questionId, idx, $event.detail.value)"
        />
      </view>

      <view v-else>
        <view class="editor-wrap">
          <scroll-view class="editor-toolbar" scroll-x>
            <view class="editor-toolbar-inner">
              <button class="editor-btn" @click="onEditorAction('undo')">↶</button>
              <button class="editor-btn" @click="onEditorAction('redo')">↷</button>
              <view class="editor-divider" />
              <button class="editor-btn" @click="onEditorAction('h2')">H2</button>
              <button class="editor-btn" @click="onEditorAction('ul')">• 列表</button>
              <button class="editor-btn" @click="onEditorAction('ol')">1. 列表</button>
              <view class="editor-divider" />
              <button class="editor-btn" @click="onEditorAction('bold')">B</button>
              <button class="editor-btn" @click="onEditorAction('italic')">I</button>
              <button class="editor-btn" @click="onEditorAction('underline')">U</button>
              <button class="editor-btn" @click="onEditorAction('strike')">S</button>
              <view class="editor-divider" />
              <button class="editor-btn" @click="onEditorAction('super')">x²</button>
              <button class="editor-btn" @click="onEditorAction('sub')">x₂</button>
              <view class="editor-divider" />
              <button class="editor-btn" @click="onEditorAction('left')">左</button>
              <button class="editor-btn" @click="onEditorAction('center')">中</button>
              <button class="editor-btn" @click="onEditorAction('right')">右</button>
              <view class="editor-divider" />
              <button class="editor-btn" @click="onEditorAction('clear')">清除</button>
            </view>
          </scroll-view>
          <editor
            id="answer-editor"
            class="answer-editor"
            placeholder="请输入答案"
            :read-only="finalized"
            show-img-size
            show-img-toolbar
            show-img-resize
            @ready="onEditorReady"
            @input="onEditorInput"
          />
        </view>
        <view class="editor-preview-card" v-if="answers[currentQuestion.questionId]?.contentText">
          <view class="editor-preview-title">富文本预览</view>
          <rich-text class="editor-preview-content" :nodes="answers[currentQuestion.questionId]?.contentText || ''"></rich-text>
        </view>
      </view>

      <view class="upload-box">
        <view class="upload-head">
          <text class="upload-title">附图（最多4张）</text>
          <view class="tool-row">
            <button class="tool-icon-btn" @click="pickImages(currentQuestion.questionId)">
              <font-awesome-icon icon="far fa-image-polaroid" class="tool-icon" />
            </button>
            <button class="tool-icon-btn" @click="pickImages(currentQuestion.questionId)">
              <font-awesome-icon icon="far fa-camera-alt" class="tool-icon" />
            </button>
          </view>
        </view>

        <view class="img-list" v-if="(answers[currentQuestion.questionId]?.images || []).length">
          <view
            v-for="(img, idx) in answers[currentQuestion.questionId]?.images || []"
            :key="img.path"
            class="img-item"
          >
            <image class="img" :src="img.path" mode="aspectFill" />
            <view class="img-del" @click="removeImage(currentQuestion.questionId, idx)">×</view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!visibleBlocked" class="submit-footer fx-fade-up fx-delay-2">
      <button class="ui-btn-primary submit-btn" :disabled="submitting || finalized" @click="submitAll">
        {{ finalized ? '已评分不可再提交' : submitting ? '提交中...' : '提交作业' }}
      </button>
    </view>

    <StudentBottomNav active="assignments" />
  </view>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getAssignment, getAssignmentSnapshot } from '../../api/assignment'
import { listLatestSubmissions, uploadSubmission } from '../../api/submission'
import { requireStudent } from '../../utils/storage'
import FontAwesomeIcon from '../../components/FontAwesomeIcon.vue'
import StudentBottomNav from '../../components/StudentBottomNav.vue'
import { toAbsoluteUrl } from '../../utils/http'

const assignmentId = ref('')
const assignment = ref({})
const questions = ref([])
const currentIndex = ref(0)
const answers = ref({})
const submitting = ref(false)
const finalized = ref(false)
const editorCtx = ref(null)
const editorReady = ref(false)
const syncingEditor = ref(false)

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)
const displayQuestionIndex = computed(() => currentQuestion.value?.questionIndex || currentIndex.value + 1)
const visibleBlocked = computed(() => {
  return assignment.value.visibleAfterSubmit === false && hasAnySubmitted.value
})

const hasAnySubmitted = ref(false)

onMounted(async () => {
  if (!requireStudent()) return
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  assignmentId.value = current?.options?.assignmentId || ''
  await fetchAssignment()
  if (!assignment.value?.currentSnapshotId) {
    uni.showToast({ title: '作业尚未发布，无法加载题目', icon: 'none' })
    return
  }
  await fetchSnapshot()
  await fetchLatest()
  void syncEditorWithCurrentQuestion()
})

watch(currentQuestion, () => {
  void syncEditorWithCurrentQuestion()
})

async function fetchAssignment() {
  try {
    assignment.value = await getAssignment(assignmentId.value)
  } catch (err) {
    uni.showToast({ title: err.message || '作业加载失败', icon: 'none' })
  }
}

async function fetchSnapshot() {
  try {
    const snapshot = await getAssignmentSnapshot(assignmentId.value)
    const sorted = [...(snapshot.questions || [])].sort((a, b) => a.questionIndex - b.questionIndex)
    questions.value = sorted
    sorted.forEach((q) => {
      if (!answers.value[q.questionId]) {
        answers.value[q.questionId] = {
          questionId: q.questionId,
          contentText: '',
          answerPayload: {},
          answerFormat: q.questionType || 'SHORT_ANSWER',
          images: [],
        }
      }
    })
  } catch (err) {
    uni.showToast({ title: err.message || '题目加载失败', icon: 'none' })
  }
}

async function fetchLatest() {
  try {
    const items = await listLatestSubmissions(assignmentId.value)
    if (!items?.length) return
    hasAnySubmitted.value = true
    items.forEach((item) => {
      if (!answers.value[item.questionId]) {
        answers.value[item.questionId] = {
          questionId: item.questionId,
          contentText: '',
          answerPayload: {},
          answerFormat: 'SHORT_ANSWER',
          images: [],
        }
      }
      answers.value[item.questionId].contentText = item.contentText || ''
      answers.value[item.questionId].answerPayload = item.answerPayload || {}
      answers.value[item.questionId].answerFormat = item.answerFormat || answers.value[item.questionId].answerFormat
      answers.value[item.questionId].images = (item.fileUrls || []).map((url) => ({
        path: toAbsoluteUrl(url),
        remote: true,
      }))
      if (item.isFinal) finalized.value = true
    })
  } catch (err) {
    // Ignore latest submission read failure to avoid blocking first-time submit.
  }
}

function questionPrompt(q) {
  const prompt = q.prompt
  if (!prompt) return ''
  if (typeof prompt === 'string') return prompt
  return prompt.text || ''
}

function toSuperscript(text = '') {
  const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ' }
  return String(text).split('').map((ch) => map[ch] || ch).join('')
}

function toSubscript(text = '') {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' }
  return String(text).split('').map((ch) => map[ch] || ch).join('')
}

const LATEX_SYMBOL_MAP = {
  in: '∈',
  notin: '∉',
  forall: '∀',
  exists: '∃',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  supseteq: '⊇',
  geq: '≥',
  geqslant: '≥',
  leq: '≤',
  leqslant: '≤',
  neq: '≠',
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  to: '→',
  cdots: '⋯',
  infty: '∞',
  pi: 'π',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  theta: 'θ',
  epsilon: 'ϵ',
  varepsilon: 'ε',
  lambda: 'λ',
  mu: 'μ',
  sigma: 'σ',
  Delta: 'Δ',
  degree: '°',
}

const LATEX_TEXT_COMMANDS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'min',
  'max',
  'lim',
])

function latexToReadable(input = '') {
  const source = String(input)
    .replace(/\\\\/g, '\\')
    .replace(/\\,/g, ' ')
    .replace(/\\!/g, '')

  let index = 0

  const isAlpha = (char) => /[a-zA-Z]/.test(char || '')

  const skipSpaces = () => {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1
    }
  }

  const parseArgument = () => {
    skipSpaces()
    if (index >= source.length) return ''
    if (source[index] === '{') {
      index += 1
      return parseUntil('}')
    }
    if (source[index] === '\\') {
      return parseCommand()
    }
    const value = source[index]
    index += 1
    return value
  }

  const parseOptionalDegree = () => {
    skipSpaces()
    if (source[index] !== '[') return ''
    index += 1
    let depth = 1
    let value = ''
    while (index < source.length && depth > 0) {
      const char = source[index]
      if (char === '[') {
        depth += 1
        value += char
        index += 1
        continue
      }
      if (char === ']') {
        depth -= 1
        index += 1
        if (depth > 0) value += char
        continue
      }
      value += char
      index += 1
    }
    return latexToReadable(value)
  }

  const parseCommand = () => {
    index += 1
    if (index >= source.length) return ''

    if (!isAlpha(source[index])) {
      const char = source[index]
      index += 1
      return char
    }

    const commandStart = index
    while (index < source.length && isAlpha(source[index])) {
      index += 1
    }
    const command = source.slice(commandStart, index)

    if (command === 'frac') {
      const numerator = parseArgument()
      const denominator = parseArgument()
      return `(${numerator})/(${denominator})`
    }

    if (command === 'sqrt') {
      const degree = parseOptionalDegree()
      const body = parseArgument()
      const cleanBody = String(body || '').trim().replace(/^\(([\s\S]*)\)$/, '$1')
      const value = `√(${cleanBody})`
      return degree ? `${degree}${value}` : value
    }

    if (command === 'left' || command === 'right' || command === 'displaystyle') {
      return ''
    }

    if (command === 'text' || command === 'mathrm' || command === 'operatorname') {
      return parseArgument()
    }

    if (command === 'mathbb') {
      const token = parseArgument()
      const blackboard = {
        R: 'ℝ',
        N: 'ℕ',
        Z: 'ℤ',
        Q: 'ℚ',
        C: 'ℂ',
      }
      return blackboard[token] || token
    }

    if (LATEX_SYMBOL_MAP[command]) {
      return LATEX_SYMBOL_MAP[command]
    }

    if (LATEX_TEXT_COMMANDS.has(command)) {
      return command
    }

    return command
  }

  const parseScript = (marker) => {
    index += 1
    const body = parseArgument()
    if (marker === '^') return toSuperscript(body)
    return toSubscript(body)
  }

  const parseUntil = (endChar = '') => {
    let result = ''
    while (index < source.length) {
      const char = source[index]
      if (endChar && char === endChar) {
        index += 1
        break
      }
      if (char === '\\') {
        result += parseCommand()
        continue
      }
      if (char === '^' || char === '_') {
        result += parseScript(char)
        continue
      }
      if (char === '{') {
        index += 1
        result += parseUntil('}')
        continue
      }
      if (char === '}') {
        if (!endChar) {
          index += 1
          continue
        }
        break
      }
      result += char
      index += 1
    }
    return result
  }

  return parseUntil('')
    .replace(/\\+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(input = '') {
  return String(input)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function renderPlainMathText(raw = '') {
  const source = String(raw)
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
  const parts = source.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g)
  return parts.map((part) => {
    if (!part) return ''
    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      const pure = part.startsWith('$$') ? part.slice(2, -2) : part.slice(1, -1)
      return latexToReadable(pure)
    }
    return /\\[a-zA-Z]+|[_^]/.test(part) ? latexToReadable(part) : part
  }).join('')
}

function renderPrompt(question) {
  return decodeHtmlEntities(
    renderPlainMathText(questionPrompt(question))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/\r/g, ''),
  )
}

function questionTypeLabel(type) {
  if (type === 'SINGLE_CHOICE') return '单选题'
  if (type === 'MULTI_CHOICE') return '多选题'
  if (type === 'JUDGE') return '判断题'
  if (type === 'FILL_BLANK') return '填空题'
  return '简答题'
}

function formatOptionText(text) {
  const raw = String(text || '').trim()
  const wrapped = raw.startsWith('$') && raw.endsWith('$')
    ? raw.slice(1, -1)
    : raw
  return latexToReadable(wrapped)
}

function getSchema(q) {
  return q.questionSchema || {}
}

function isSingleChoice(q) {
  return q.questionType === 'SINGLE_CHOICE' || q.questionType === 'JUDGE'
}

function isMultiChoice(q) {
  return q.questionType === 'MULTI_CHOICE'
}

function isFillBlank(q) {
  return q.questionType === 'FILL_BLANK'
}

function isObjectiveQuestion(q) {
  return isSingleChoice(q) || isMultiChoice(q) || isFillBlank(q)
}

function getOptions(q) {
  const schema = getSchema(q)
  if (q.questionType === 'JUDGE' && (!schema.options || !schema.options.length)) {
    return [
      { id: 'A', text: '对' },
      { id: 'B', text: '错' },
    ]
  }
  return schema.options || []
}

function getAnswerPayload(questionId) {
  return answers.value[questionId]?.answerPayload || {}
}

function setSingleChoice(questionId, optionId) {
  answers.value[questionId].answerPayload = { optionIds: [optionId] }
}

function toggleMultiChoice(questionId, optionId) {
  const current = new Set(getAnswerPayload(questionId).optionIds || [])
  if (current.has(optionId)) {
    current.delete(optionId)
  } else {
    current.add(optionId)
  }
  answers.value[questionId].answerPayload = { optionIds: [...current] }
}

function getBlankCount(q) {
  const schema = getSchema(q)
  if (typeof schema.blankCount === 'number' && schema.blankCount > 0) {
    return schema.blankCount
  }
  return 1
}

function getBlankAnswers(questionId) {
  return getAnswerPayload(questionId).blanks || []
}

function setBlankAnswer(questionId, index, value) {
  const blanks = [...getBlankAnswers(questionId)]
  blanks[index] = value
  answers.value[questionId].answerPayload = { blanks }
}

function setTextAnswer(questionId, value) {
  answers.value[questionId].contentText = value
}

const CN_NUM_MAP = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const CN_QUESTION_LABELS = [
  '第一题',
  '第二题',
  '第三题',
  '第四题',
  '第五题',
  '第六题',
  '第七题',
  '第八题',
  '第九题',
  '第十题',
]
function toChineseNumber(num) {
  if (num <= 10) return num === 10 ? '十' : CN_NUM_MAP[num]
  if (num < 20) return `十${CN_NUM_MAP[num % 10]}`
  if (num < 100) {
    const tens = Math.floor(num / 10)
    const units = num % 10
    return `${CN_NUM_MAP[tens]}十${units ? CN_NUM_MAP[units] : ''}`
  }
  return String(num)
}

function questionIndexLabel(idx) {
  if (CN_QUESTION_LABELS[idx]) return CN_QUESTION_LABELS[idx]
  return `第${toChineseNumber(idx + 1)}题`
}

function ensureEditorContext() {
  if (editorCtx.value) return Promise.resolve(editorCtx.value)
  return new Promise((resolve) => {
    uni.createSelectorQuery()
      .select('#answer-editor')
      .context((res) => {
        editorCtx.value = res?.context || null
        resolve(editorCtx.value)
      })
      .exec()
  })
}

async function syncEditorWithCurrentQuestion() {
  const q = currentQuestion.value
  if (!q || isObjectiveQuestion(q) || !editorReady.value) return
  await nextTick()
  const ctx = await ensureEditorContext()
  if (!ctx) return
  const html = answers.value[q.questionId]?.contentText || ''
  syncingEditor.value = true
  if (html) {
    ctx.setContents({ html })
  } else {
    ctx.clear()
  }
  setTimeout(() => {
    syncingEditor.value = false
  }, 0)
}

async function onEditorAction(action) {
  if (finalized.value) return
  const q = currentQuestion.value
  if (!q || isObjectiveQuestion(q)) return
  const ctx = await ensureEditorContext()
  if (!ctx) return

  if (action === 'undo') {
    if (typeof ctx.undo === 'function') ctx.undo()
    return
  }
  if (action === 'redo') {
    if (typeof ctx.redo === 'function') ctx.redo()
    return
  }
  if (action === 'clear') {
    if (typeof ctx.clear === 'function') {
      ctx.clear()
    } else if (typeof ctx.removeFormat === 'function') {
      ctx.removeFormat()
    }
    return
  }

  if (action === 'h2') {
    ctx.format('header', 'H2')
    return
  }
  if (action === 'ul') {
    ctx.format('list', 'bullet')
    return
  }
  if (action === 'ol') {
    ctx.format('list', 'ordered')
    return
  }
  if (action === 'super') {
    ctx.format('script', 'super')
    return
  }
  if (action === 'sub') {
    ctx.format('script', 'sub')
    return
  }
  if (action === 'left' || action === 'center' || action === 'right') {
    ctx.format('align', action)
    return
  }

  if (['bold', 'italic', 'underline', 'strike'].includes(action)) {
    ctx.format(action)
  }
}

function onEditorReady() {
  editorReady.value = true
  void syncEditorWithCurrentQuestion()
}

function onEditorInput(event) {
  if (syncingEditor.value) return
  const q = currentQuestion.value
  if (!q) return
  setTextAnswer(q.questionId, event?.detail?.html || '')
}

function pickImages(questionId) {
  const current = answers.value[questionId]?.images || []
  const remain = 4 - current.length
  if (remain <= 0) {
    uni.showToast({ title: '图片最多提交4张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const files = (res.tempFiles || []).map((f) => ({ path: f.path || f.tempFilePath, remote: false }))
      answers.value[questionId].images = [...current, ...files].slice(0, 4)
    },
  })
}

function removeImage(questionId, index) {
  const current = [...(answers.value[questionId]?.images || [])]
  current.splice(index, 1)
  answers.value[questionId].images = current
}

async function submitAll() {
  if (finalized.value) return
  submitting.value = true
  try {
    const payloadAnswers = questions.value.map((q) => {
      const answer = answers.value[q.questionId] || {}
      return {
        questionId: q.questionId,
        contentText: answer.contentText || '',
        answerPayload: answer.answerPayload || null,
        answerFormat: answer.answerFormat || q.questionType || 'SHORT_ANSWER',
      }
    })

    const fileEntries = []
    questions.value.forEach((q) => {
      const images = answers.value[q.questionId]?.images || []
      images.filter((img) => !img.remote).forEach((img) => {
        fileEntries.push({
          questionId: q.questionId,
          path: img.path,
        })
      })
    })

    if (fileEntries.length > 4) {
      uni.showToast({ title: '图片最多提交4张', icon: 'none' })
      submitting.value = false
      return
    }

    await uploadSubmission({
      assignmentId: assignmentId.value,
      answers: payloadAnswers,
      fileEntries,
    })
    hasAnySubmitted.value = true
    uni.showToast({ title: '已提交', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 600)
  } catch (err) {
    uni.showToast({ title: err.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.back-btn {
  margin-left: auto;
  height: 62rpx;
  line-height: 62rpx;
  font-size: 22rpx;
  padding: 0 18rpx;
}

.block-card {
  padding: 20rpx;
}

.submit-card {
  padding: 20rpx;
}

.index-list {
  white-space: nowrap;
  margin-bottom: 14rpx;
}

.index-item {
  min-width: 122rpx;
  width: auto;
  padding: 0 14rpx;
  height: 62rpx;
  margin-right: 10rpx;
  border-radius: 14rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2f8;
  color: #64718c;
  font-size: 23rpx;
  font-weight: 700;
  white-space: nowrap;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.index-item.active {
  background: linear-gradient(90deg, #5a8ff2 0%, #69d0dc 100%);
  color: #fff;
  text-shadow: 0 2rpx 6rpx rgba(15, 47, 102, 0.25);
  box-shadow: 0 10rpx 18rpx rgba(83, 146, 238, 0.24);
}

.index-item:active {
  transform: scale(0.96);
}

.question-head {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.question-no {
  font-size: 46rpx;
  line-height: 1;
  font-weight: 700;
  color: rgba(26, 36, 64, 0.34);
}

.question-type {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2d4b;
}

.prompt-box {
  margin-top: 12rpx;
  border-radius: 18rpx;
  border: 2rpx solid #e1e8f5;
  background: #f9fbff;
  padding: 18rpx;
}

.prompt-text {
  font-size: 30rpx;
  line-height: 1.62;
  color: #1f2d4b;
  white-space: pre-wrap;
}

.choice-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.choice-item {
  border-radius: 16rpx;
  border: 2rpx solid #e1e8f5;
  background: #fff;
  padding: 14rpx 16rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.choice-item:active {
  transform: translateY(2rpx) scale(0.995);
  box-shadow: 0 10rpx 20rpx rgba(32, 58, 106, 0.1);
}

.choice-text {
  flex: 1;
  font-size: 28rpx;
  color: #273451;
  line-height: 1.5;
}

.blank-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.editor-wrap {
  margin-top: 16rpx;
  border-radius: 18rpx;
  border: 2rpx solid #dbe4f4;
  background: #fff;
  overflow: hidden;
}

.editor-toolbar {
  white-space: nowrap;
  padding: 0 12rpx;
  border-bottom: 2rpx solid #edf2fb;
  background: #f5f8fc;
}

.editor-toolbar-inner {
  height: 68rpx;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
}

.editor-btn {
  margin: 0;
  min-width: 58rpx;
  height: 50rpx;
  padding: 0 14rpx;
  border-radius: 10rpx;
  border: 2rpx solid transparent;
  background: transparent;
  color: #6a7692;
  font-size: 22rpx;
  line-height: 50rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.editor-btn::after {
  border: none;
}

.editor-btn:active {
  background: #e8eef9;
}

.editor-divider {
  width: 2rpx;
  height: 26rpx;
  background: #d9e2f2;
  border-radius: 1rpx;
  margin: 0 2rpx;
}

.answer-editor {
  min-height: 340rpx;
  padding: 16rpx;
  font-size: 30rpx;
  line-height: 1.58;
  color: #273451;
}

.editor-preview-card {
  margin-top: 10rpx;
  border-radius: 16rpx;
  border: 2rpx solid #e4eaf6;
  background: #f9fbff;
  padding: 14rpx;
}

.editor-preview-title {
  font-size: 23rpx;
  color: rgba(26, 36, 64, 0.62);
  margin-bottom: 8rpx;
}

.editor-preview-content {
  font-size: 28rpx;
  line-height: 1.56;
  color: #24314e;
  word-break: break-all;
}

.upload-box {
  margin-top: 16rpx;
  border-radius: 16rpx;
  border: 2rpx solid #e1e8f5;
  background: #fff;
  padding: 14rpx;
  animation: fieldEnter 0.5s ease both;
}

.upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.upload-title {
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.6);
}

.tool-row {
  display: flex;
  gap: 10rpx;
}

.tool-icon-btn {
  margin: 0;
  width: 62rpx;
  height: 62rpx;
  border-radius: 31rpx;
  border: 2rpx solid #cfd7e6;
  background: #fff;
  color: #6f7c98;
  font-size: 34rpx;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tool-icon {
  font-size: 30rpx;
  line-height: 1;
}

.tool-icon-btn:active {
  transform: scale(0.94);
  box-shadow: 0 8rpx 16rpx rgba(32, 58, 106, 0.12);
}

.img-list {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.img-item {
  width: 112rpx;
  height: 112rpx;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
  border: 2rpx solid #dbe4f4;
}

.img {
  width: 100%;
  height: 100%;
}

.img-del {
  position: absolute;
  right: 4rpx;
  top: 4rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: rgba(20, 26, 40, 0.62);
  color: #fff;
  text-align: center;
  line-height: 28rpx;
  font-size: 20rpx;
}

.submit-footer {
  margin-top: 4rpx;
}

.submit-btn {
  width: 100%;
  height: 86rpx;
  line-height: 86rpx;
  font-size: 30rpx;
}

.tool-icon-btn::after {
  border: none;
}

.choice-list .choice-item:nth-child(1),
.index-list .index-item:nth-child(1) {
  animation-delay: 0.04s;
}

.choice-list .choice-item:nth-child(2),
.index-list .index-item:nth-child(2) {
  animation-delay: 0.08s;
}

.choice-list .choice-item:nth-child(3),
.index-list .index-item:nth-child(3) {
  animation-delay: 0.12s;
}

.choice-list .choice-item:nth-child(4),
.index-list .index-item:nth-child(4) {
  animation-delay: 0.16s;
}

@keyframes fieldEnter {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
