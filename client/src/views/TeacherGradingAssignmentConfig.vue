<template>
  <TeacherLayout
    title="作业详情 / 修改"
    :subtitle="assignmentTitle || '调整截止时间、总分和题目权重'"
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
        <div>作业配置</div>
        <button class="ghost-action" type="button" @click="goBack">返回作业列表</button>
      </div>

      <div v-if="loading" class="task-empty">加载中...</div>
      <div v-else-if="loadError" class="task-empty">{{ loadError }}</div>
      <div v-else class="config-form">
        <div class="form-row">
          <label>截止时间</label>
          <input v-model="deadlineInput" type="datetime-local" class="config-input" />
        </div>

        <div class="form-row">
          <label>作业总分</label>
          <input v-model.number="totalScore" type="number" min="1" step="1" class="config-input" />
        </div>

        <div class="form-row">
          <label>各题权重（总和需为 100）</label>
          <div class="weight-list">
            <div v-for="item in weights" :key="item.questionId" class="weight-row">
              <div class="weight-title">第{{ item.questionIndex }}题（满分{{ item.maxScore }}）</div>
              <input
                v-model.number="item.weight"
                type="number"
                min="0"
                step="0.1"
                class="config-input weight-input"
              />
            </div>
          </div>
          <div class="weight-total">当前总和：{{ weightSum.toFixed(2) }}</div>
        </div>

        <div class="actions">
          <button class="task-action" type="button" :disabled="saving" @click="saveConfig">
            {{ saving ? '保存中...' : '保存修改' }}
          </button>
          <div v-if="saveError" class="task-empty">{{ saveError }}</div>
          <div v-if="saveSuccess" class="save-ok">{{ saveSuccess }}</div>
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
} from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'

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

const assignmentTitle = ref('')
const deadlineInput = ref('')
const totalScore = ref(100)
const weights = ref<WeightRow[]>([])

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

const weightSum = computed(() =>
  weights.value.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
)

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
    assignmentTitle.value = assignment.title || ''
    deadlineInput.value = toDatetimeLocal(assignment.deadline)
    totalScore.value = Number(assignment.totalScore ?? 100)
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
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载作业配置失败'
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saveError.value = ''
  saveSuccess.value = ''
  if (!weights.value.length) {
    saveError.value = '作业题目为空'
    return
  }
  if (Math.abs(weightSum.value - 100) > 0.01) {
    saveError.value = '权重总和必须为 100'
    return
  }
  if (!Number.isFinite(totalScore.value) || totalScore.value <= 0) {
    saveError.value = '总分必须大于 0'
    return
  }

  saving.value = true
  try {
    const result = await updateAssignmentGradingConfig(assignmentId.value, {
      deadline: fromDatetimeLocal(deadlineInput.value),
      totalScore: Number(totalScore.value),
      questionWeights: weights.value.map((item) => ({
        questionId: item.questionId,
        weight: Number(item.weight),
      })),
    })
    saveSuccess.value = result.needRepublish
      ? '已保存，成绩发布状态已重置，请重新发布'
      : '已保存'
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
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
  gap: 12px;
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

.weight-list {
  display: grid;
  gap: 8px;
}

.weight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.weight-title {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.85);
}

.weight-input {
  max-width: 150px;
}

.weight-total {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
}

.actions {
  display: grid;
  gap: 8px;
}

.save-ok {
  color: #1f7a4b;
  font-size: 12px;
}
</style>
