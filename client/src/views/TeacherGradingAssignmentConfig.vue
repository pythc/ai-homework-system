<template>
  <TeacherLayout
    title="作业详情 / 修改"
    :subtitle="assignmentName || '按区块调整作业配置'"
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
        <div class="panel-title-with-sub">
          <div>作业配置</div>
          <div class="panel-sub-title">调整截止时间、总分、发布设置与评分权重</div>
        </div>
        <button class="ghost-action" type="button" @click="goBack">返回作业列表</button>
      </div>

      <div v-if="loading" class="task-empty">加载中...</div>
      <div v-else-if="loadError" class="task-empty">{{ loadError }}</div>
      <div v-else class="config-form">
        <section class="section-card">
          <div class="section-title">基本信息</div>
          <div class="section-sub">标题、截止时间、总分</div>
          <div class="basic-grid">
            <div class="form-row full-col">
              <label>作业标题</label>
              <input v-model.trim="assignmentName" type="text" class="config-input" />
            </div>
            <div class="form-row">
              <label>截止时间</label>
              <input v-model="deadlineInput" type="datetime-local" class="config-input" />
            </div>
            <div class="form-row">
              <label>作业总分</label>
              <input
                v-model.number="totalScore"
                type="number"
                min="1"
                step="1"
                class="config-input"
              />
            </div>
          </div>
        </section>

        <section class="section-card">
          <div class="section-title">发布设置</div>
          <div class="section-sub">学生是否可见、是否可看答案、是否可看分数</div>
          <div class="option-grid">
            <label class="option-item">
              <input v-model="visibleAfterSubmit" type="checkbox" />
              <span>学生提交后作业仍可见</span>
            </label>
            <label class="option-item">
              <input v-model="allowViewAnswer" type="checkbox" />
              <span>允许学生查看标准答案</span>
            </label>
            <label class="option-item">
              <input v-model="allowViewScore" type="checkbox" />
              <span>教师批改后允许学生查看分数</span>
            </label>
          </div>
        </section>

        <section class="section-card">
          <div class="section-title section-title-row">
            <span>评分设置</span>
            <div class="weight-tools">
              <button class="ghost-action" type="button" @click="autoBalanceWeights">平均分配</button>
              <button class="ghost-action" type="button" @click="distributeByMaxScore">按满分占比</button>
              <button class="ghost-action" type="button" @click="resetWeights">重置</button>
            </div>
          </div>
          <div class="section-sub">题号 / 满分 / 权重（总和需为 100）</div>

          <div class="weight-table-wrap">
            <table class="weight-table">
              <thead>
                <tr>
                  <th>题号</th>
                  <th>满分</th>
                  <th>权重</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in weights" :key="item.questionId">
                  <td>第{{ item.questionIndex }}题</td>
                  <td>{{ item.maxScore }}</td>
                  <td>
                    <div class="weight-input-wrap">
                      <input
                        v-model.number="item.weight"
                        type="number"
                        min="0"
                        step="0.1"
                        class="config-input weight-input"
                      />
                      <span class="weight-suffix">%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="weight-total" :class="{ invalid: !isWeightValid }">
            当前总和：{{ weightSum.toFixed(2) }}
          </div>
        </section>

        <section class="section-card">
          <div class="section-title">高级功能</div>
          <div class="section-sub">AI批改与手写识别策略</div>
          <div class="option-grid">
            <label class="option-item">
              <input v-model="aiEnabled" type="checkbox" />
              <span>启用 AI 批改</span>
            </label>
            <label class="option-item">
              <input v-model="handwritingRecognition" type="checkbox" />
              <span>启用手写识别批改模式</span>
            </label>
          </div>
          <div class="form-row threshold-field">
            <label>低置信度阈值（0~1）</label>
            <input
              v-model.number="aiConfidenceThreshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="config-input threshold-input"
              :disabled="!aiEnabled"
              @blur="clampConfidenceThreshold"
            />
            <div class="section-sub">低于阈值将自动标记为“有异议”，建议教师优先复核。</div>
          </div>
        </section>

        <div class="actions">
          <button class="task-action" type="button" :disabled="saving || !canSave" @click="saveConfig">
            {{ saving ? '保存中...' : '保存修改' }}
          </button>
          <div v-if="!isWeightValid" class="task-empty">权重总和必须为 100</div>
          <div v-if="saveError" class="task-empty">{{ saveError }}</div>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import {
  getAssignment,
  getAssignmentSnapshot,
  updateAssignmentGradingConfig,
  updateAssignmentMeta,
} from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { showAppToast } from '../composables/useAppToast'

type WeightRow = {
  questionId: string
  questionIndex: number
  weight: number
  maxScore: number
}

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const courseId = computed(() => String(route.query.courseId ?? ''))

const assignmentName = ref('')
const originalAssignmentName = ref('')
const deadlineInput = ref('')
const totalScore = ref(100)
const visibleAfterSubmit = ref(true)
const allowViewAnswer = ref(false)
const allowViewScore = ref(true)
const aiEnabled = ref(true)
const handwritingRecognition = ref(false)
const aiConfidenceThreshold = ref(0.75)
const weights = ref<WeightRow[]>([])
const initialWeights = ref<WeightRow[]>([])

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

const weightSum = computed(() =>
  weights.value.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
)
const isWeightValid = computed(() => Math.abs(weightSum.value - 100) <= 0.01)
const canSave = computed(
  () =>
    isWeightValid.value &&
    Number.isFinite(totalScore.value) &&
    totalScore.value > 0 &&
    Number.isFinite(Number(aiConfidenceThreshold.value)) &&
    Number(aiConfidenceThreshold.value) >= 0 &&
    Number(aiConfidenceThreshold.value) <= 1 &&
    assignmentName.value.trim().length > 0,
)

const clampConfidenceThreshold = () => {
  const value = Number(aiConfidenceThreshold.value)
  if (!Number.isFinite(value)) {
    aiConfidenceThreshold.value = 0.75
    return
  }
  if (value < 0) {
    aiConfidenceThreshold.value = 0
    return
  }
  if (value > 1) {
    aiConfidenceThreshold.value = 1
    return
  }
  aiConfidenceThreshold.value = Number(value.toFixed(3))
}

const toDatetimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

const fromDatetimeLocal = (value?: string) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

const fetchConfig = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [assignment, snapshot] = await Promise.all([
      getAssignment(assignmentId.value),
      getAssignmentSnapshot(assignmentId.value),
    ])
    const questions = snapshot?.questions ?? []
    const defaultWeight = questions.length > 0 ? Number((100 / questions.length).toFixed(2)) : 0
    assignmentName.value = assignment.title || ''
    originalAssignmentName.value = assignment.title || ''
    deadlineInput.value = toDatetimeLocal(assignment.deadline)
    totalScore.value = Number(assignment.totalScore ?? 100)
    visibleAfterSubmit.value = assignment.visibleAfterSubmit !== false
    allowViewAnswer.value = assignment.allowViewAnswer === true
    allowViewScore.value = assignment.allowViewScore !== false
    aiEnabled.value = assignment.aiEnabled !== false
    handwritingRecognition.value = assignment.handwritingRecognition === true
    aiConfidenceThreshold.value = Number(assignment.aiConfidenceThreshold ?? 0.75)
    clampConfidenceThreshold()
    weights.value = questions.map((question, index) => {
      const explicit = Number(question.weight ?? 0)
      const weight =
        Number.isFinite(explicit) && explicit > 0
          ? explicit
          : index === questions.length - 1
            ? Number((100 - defaultWeight * (questions.length - 1)).toFixed(2))
            : defaultWeight
      const maxScore = (question.rubric ?? []).reduce(
        (sum, rule) => sum + (Number(rule.maxScore) || 0),
        0,
      )
      return {
        questionId: question.questionId,
        questionIndex: question.questionIndex,
        weight,
        maxScore,
      }
    })
    initialWeights.value = weights.value.map((item) => ({ ...item }))
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载作业配置失败'
  } finally {
    loading.value = false
  }
}

const roundWeight = (value: number) => Number(value.toFixed(2))

const normalizeWeightsTo100 = () => {
  if (!weights.value.length) return
  const rounded = weights.value.map((item) => ({
    ...item,
    weight: roundWeight(Number(item.weight) || 0),
  }))
  const sum = rounded.reduce((acc, item) => acc + item.weight, 0)
  const delta = roundWeight(100 - sum)
  const lastIndex = rounded.length - 1
  if (lastIndex >= 0) {
    const last = rounded[lastIndex]
    if (last) {
      last.weight = roundWeight(last.weight + delta)
    }
  }
  weights.value = rounded
}

const autoBalanceWeights = () => {
  if (!weights.value.length) return
  const avg = roundWeight(100 / weights.value.length)
  weights.value = weights.value.map((item, index) => ({
    ...item,
    weight:
      index === weights.value.length - 1
        ? roundWeight(100 - avg * (weights.value.length - 1))
        : avg,
  }))
}

const distributeByMaxScore = () => {
  if (!weights.value.length) return
  const totalMax = weights.value.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0)
  if (totalMax <= 0) {
    autoBalanceWeights()
    return
  }
  weights.value = weights.value.map((item, index) => ({
    ...item,
    weight:
      index === weights.value.length - 1
        ? 0
        : roundWeight(((Number(item.maxScore) || 0) / totalMax) * 100),
  }))
  normalizeWeightsTo100()
}

const resetWeights = () => {
  if (!initialWeights.value.length) return
  weights.value = initialWeights.value.map((item) => ({ ...item }))
}

const saveConfig = async () => {
  saveError.value = ''
  const nextTitle = assignmentName.value.trim()
  if (!nextTitle) {
    saveError.value = '作业标题不能为空'
    return
  }
  if (!weights.value.length) {
    saveError.value = '作业题目为空'
    return
  }
  if (!isWeightValid.value) {
    saveError.value = '权重总和必须为 100'
    return
  }
  if (!Number.isFinite(totalScore.value) || totalScore.value <= 0) {
    saveError.value = '总分必须大于 0'
    return
  }

  normalizeWeightsTo100()
  saving.value = true
  try {
    if (nextTitle !== originalAssignmentName.value) {
      await updateAssignmentMeta(assignmentId.value, { title: nextTitle })
      originalAssignmentName.value = nextTitle
    }
    await updateAssignmentGradingConfig(assignmentId.value, {
      deadline: fromDatetimeLocal(deadlineInput.value),
      totalScore: Number(totalScore.value),
      visibleAfterSubmit: visibleAfterSubmit.value,
      allowViewAnswer: allowViewAnswer.value,
      allowViewScore: allowViewScore.value,
      aiEnabled: aiEnabled.value,
      handwritingRecognition: handwritingRecognition.value,
      aiConfidenceThreshold: Number(aiConfidenceThreshold.value),
      questionWeights: weights.value.map((item) => ({
        questionId: item.questionId,
        weight: Number(item.weight),
      })),
    })
    showAppToast('已修改', 'success')
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
    showAppToast(saveError.value || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (courseId.value) {
    router.push(`/teacher/grading/course/${courseId.value}`)
    return
  }
  router.push('/teacher/grading')
}

onMounted(async () => {
  await refreshProfile()
  await fetchConfig()
})
</script>

<style scoped>
.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title-with-sub {
  display: grid;
  gap: 4px;
}

.panel-sub-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
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

.config-form {
  display: grid;
  gap: 14px;
}

.section-card {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 14px;
  display: grid;
  gap: 10px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.92);
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.section-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.basic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-col {
  grid-column: 1 / -1;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label {
  font-weight: 600;
  color: rgba(26, 29, 51, 0.85);
}

.config-input {
  width: 100%;
  border: 1px solid rgba(130, 150, 190, 0.4);
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  color: rgba(26, 29, 51, 0.9);
}

.threshold-field {
  max-width: 320px;
}

.threshold-input {
  width: 160px;
}

.weight-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.weight-table-wrap {
  overflow-x: auto;
}

.weight-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
  overflow: hidden;
}

.weight-table th,
.weight-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(180, 194, 220, 0.24);
  text-align: left;
  font-size: 13px;
}

.weight-table th {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  font-weight: 700;
}

.weight-table tbody tr:last-child td {
  border-bottom: none;
}

.weight-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.weight-input {
  width: 110px;
}

.weight-suffix {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.62);
}

.weight-total {
  font-size: 13px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.72);
}

.weight-total.invalid {
  color: #c84c4c;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 900px) {
  .basic-grid,
  .option-grid {
    grid-template-columns: 1fr;
  }

  .section-title-row {
    align-items: flex-start;
  }
}
</style>
