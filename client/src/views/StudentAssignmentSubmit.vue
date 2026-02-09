<template>
  <StudentLayout
    title="提交作业"
    subtitle="本次提交仅支持文字与图片"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业提交"
  >
    <section class="panel glass">
      <div class="panel-title">作业提交</div>
      <div v-if="loading" class="task-empty">加载题目中...</div>
      <div v-else class="submit-list">
        <div v-for="question in questions" :key="question.questionId" class="submit-card">
          <div class="submit-title">
            第 {{ question.questionIndex }} 题
          </div>
          <div
            class="submit-prompt"
            v-mathjax
            v-html="renderTextHtml(question.promptText)"
          />
          <div v-if="question.promptMedia.length" class="submit-media">
            <img
              v-for="(img, index) in question.promptMedia"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>
          <textarea
            v-model="answers[question.questionId]"
            class="submit-textarea"
            placeholder="输入文字答案（可留空，仅上传图片也可以）"
            :disabled="isFinalized"
          />
          <div class="submit-upload">
            <input
              type="file"
              accept="image/*"
              multiple
              :disabled="isFinalized"
              @change="onFileChange($event, question.questionId)"
            />
            <div class="submit-upload-hint">
              每题最多 4 张图片
            </div>
          </div>
          <div v-if="getFileCount(question.questionId) > 0" class="submit-files">
            已选择 {{ getFileCount(question.questionId) }} 张图片
          </div>

          <div v-if="submittedMap[question.questionId]" class="submit-preview">
            <div class="preview-title">已提交内容</div>
            <div v-if="submittedMap[question.questionId].contentText" class="preview-text">
              {{ submittedMap[question.questionId].contentText }}
            </div>
            <div v-else class="preview-empty">未填写文字答案</div>
            <div v-if="submittedMap[question.questionId].fileUrls.length" class="preview-media">
              <img
                v-for="(img, index) in submittedMap[question.questionId].fileUrls"
                :key="index"
                :src="resolveFileUrl(img)"
                alt="submission image"
              />
            </div>
          </div>

        </div>
        <div class="submit-actions">
          <button class="task-action" :disabled="submitting || isFinalized" @click="submit">
            {{ isFinalized ? '已评分不可再提交' : submitting ? '提交中...' : '提交作业' }}
          </button>
          <div v-if="error" class="submit-error">{{ error }}</div>
          <div v-if="success" class="submit-success">提交成功</div>
          <div v-if="isFinalized" class="submit-lock">老师已确认最终成绩，无法再次提交。</div>
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import type { AssignmentSnapshotQuestion } from '../api/assignment'
import { getAssignmentSnapshot } from '../api/assignment'
import { listLatestSubmissions, uploadSubmission } from '../api/submission'
import { API_BASE_URL } from '../api/http'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const route = useRoute()

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref(false)
type SubmitQuestion = {
  questionId: string
  questionIndex: number
  promptText: string
  promptMedia: Array<{ url: string; caption?: string }>
}

type SubmittedItem = {
  submissionVersionId: string
  contentText: string
  fileUrls: string[]
}

const questions = ref<SubmitQuestion[]>([])
const answers = ref<Record<string, string>>({})
const filesByQuestion = ref<Record<string, File[]>>({})
const submittedMap = ref<Record<string, SubmittedItem>>({})
const isFinalized = ref(false)

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const normalizePrompt = (prompt: unknown) => {
  if (!prompt) return { text: '', media: [] }
  if (typeof prompt === 'string') return { text: prompt, media: [] }
  if (typeof prompt === 'object') {
    const text = String((prompt as any).text ?? '')
    const media = Array.isArray((prompt as any).media) ? (prompt as any).media : []
    return { text, media }
  }
  return { text: '', media: [] }
}

const renderTextHtml = (text: string) => {
  if (!text) return '题目内容加载失败'
  return text.replace(/\n/g, '<br />')
}

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const loadSnapshot = async () => {
  if (!assignmentId.value) {
    error.value = '缺少作业信息'
    loading.value = false
    return
  }
  try {
    const snapshot = await getAssignmentSnapshot(assignmentId.value)
    console.log('snapshot', snapshot)
    const snapshotQuestions = (snapshot?.questions ?? []) as AssignmentSnapshotQuestion[]
    console.log('snapshotQuestions', snapshotQuestions)
    questions.value = snapshotQuestions.map((item) => {
      const prompt = normalizePrompt(item.prompt)
      return {
        questionId: item.questionId,
        questionIndex: item.questionIndex,
        promptText: prompt.text,
        promptMedia: prompt.media,
      }
    })
    questions.value.forEach((question) => {
      if (!(question.questionId in answers.value)) {
        answers.value[question.questionId] = ''
      }
    })
    if (questions.value.length === 0) {
      error.value = '作业题目为空或未发布，请联系老师确认'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载题目失败'
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
    items.forEach((item) => {
      submittedMap.value[item.questionId] = {
        submissionVersionId: item.submissionVersionId,
        contentText: item.contentText ?? '',
        fileUrls: item.fileUrls ?? [],
      }
    })
  } catch {
    // ignore
  }
}

const onFileChange = (event: Event, questionId: string) => {
  const input = event.target as HTMLInputElement | null
  if (!input?.files) return
  const files = Array.from(input.files)
  filesByQuestion.value[questionId] = files.slice(0, 4)
  input.value = ''
}

const getFileCount = (questionId: string) =>
  filesByQuestion.value[questionId]?.length ?? 0

const validate = () => {
  for (const question of questions.value) {
    const text = (answers.value[question.questionId] ?? '').trim()
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
  success.value = false
  const validationMessage = validate()
  if (validationMessage) {
    error.value = validationMessage
    return
  }

  submitting.value = true
  try {
    const payloadAnswers = questions.value.map((question) => ({
      questionId: question.questionId,
      contentText: answers.value[question.questionId] ?? '',
    }))
    const response = await uploadSubmission({
      assignmentId: assignmentId.value,
      answers: payloadAnswers,
      filesByQuestion: filesByQuestion.value,
    })
    const items = response?.data?.items ?? []
    const aiEnabled = response?.data?.aiEnabled ?? false

    items.forEach((item) => {
      submittedMap.value[item.questionId] = {
        submissionVersionId: item.submissionVersionId,
        contentText: answers.value[item.questionId] ?? '',
        fileUrls: item.fileUrls ?? [],
      }
      void aiEnabled
    })
    success.value = true
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
</script>

<style scoped>
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

.submit-title {
  font-weight: 700;
}

.submit-prompt {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.7);
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

.submit-textarea {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 12px;
  padding: 10px 12px;
  min-height: 80px;
  font-size: 14px;
  outline: none;
  resize: vertical;
}

.submit-textarea:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(78, 132, 255, 0.18);
}

.submit-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.submit-upload input[type='file'] {
  font-size: 12px;
}

.submit-upload-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.5);
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

.preview-title {
  font-weight: 600;
  font-size: 13px;
}

.preview-text {
  font-size: 13px;
  white-space: pre-wrap;
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

.submit-error {
  font-size: 12px;
  color: #e76464;
}

.submit-success {
  font-size: 12px;
  color: #2e9d70;
}

.submit-lock {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}
</style>
