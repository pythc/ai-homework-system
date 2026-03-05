<template>
  <TeacherLayout
    title="批改作业"
    subtitle="选择学生提交进行批改"
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
        <div>
          提交列表
          <span class="badge">{{ displayCount }} 条</span>
        </div>
        <button class="ghost-action" @click="goBack">返回作业</button>
      </div>

      <div class="grading-toolbar">
        <div class="grading-search">
          <input
            v-model="searchText"
            class="search-input"
            type="text"
            placeholder="搜索学生姓名/学号"
          />
        </div>
        <div class="grading-tabs">
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'PENDING' }"
            @click="statusFilter = 'PENDING'"
          >
            待确认（{{ pendingCount }}）
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'GRADED' }"
            @click="statusFilter = 'GRADED'"
          >
            已确认（{{ gradedCount }}）
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'MISSING' }"
            @click="statusFilter = 'MISSING'"
          >
            未提交（{{ missingCount }}）
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'ALL' }"
            @click="statusFilter = 'ALL'"
          >
            全部（{{ allCount }}）
          </button>
        </div>
      </div>

      <div v-if="statusFilter !== 'MISSING'" class="submission-list">
        <div
          v-for="item in pagedSubmissions"
          :key="item.studentId"
          class="submission-row clickable"
          role="button"
          tabindex="0"
          @click="goGrading(item.submissionVersionId, item.studentId)"
          @keydown.enter.prevent="goGrading(item.submissionVersionId, item.studentId)"
          @keydown.space.prevent="goGrading(item.submissionVersionId, item.studentId)"
        >
          <div class="submission-main">
            <div class="submission-name">
              {{ formatStudentDisplay(item.student) }}
            </div>
            <div class="submission-meta">
              提交 {{ formatTime(item.submittedAt) }}
            </div>
          </div>
          <div class="submission-score-simple">
            {{ scoreLabel(item) }}
          </div>
          <div
            class="submission-status"
            :class="item.isFinal ? 'graded' : item.hasObjection ? 'objection' : 'pending'"
          >
            {{ item.isFinal ? '已确认' : item.hasObjection ? '有异议' : '待确认' }}
          </div>
        </div>
        <div v-if="!filteredSubmissions.length" class="task-empty">
          {{ loadError || '暂无提交' }}
        </div>
        <div v-if="totalPages > 1" class="paging">
          <button class="page-btn" :disabled="pageIndex === 1" @click="pageIndex -= 1">
            上一页
          </button>
          <span class="page-text">{{ pageIndex }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="pageIndex === totalPages" @click="pageIndex += 1">
            下一页
          </button>
        </div>
      </div>
      <div v-else class="submission-list">
        <div
          v-for="student in missingStudents"
          :key="student.studentId"
          class="submission-row"
        >
          <div class="submission-main">
            <div class="submission-name">
              {{ student.name || student.account || '学生' }}
            </div>
            <div class="submission-meta">
              学号 {{ formatStudentAccount(student) }}
            </div>
          </div>
          <div class="submission-status pending">未提交</div>
        </div>
        <div v-if="!missingStudents.length" class="task-empty">
          {{ missingError || '暂无未提交学生' }}
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listMissingByAssignment, listSubmissionsByAssignment } from '../api/teacherGrading'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const courseId = computed(() => String(route.query.courseId ?? ''))

const submissions = ref<any[]>([])
const missingStudents = ref<any[]>([])
const missingError = ref('')
const loadError = ref('')
const statusFilter = ref<'PENDING' | 'GRADED' | 'ALL' | 'MISSING'>('PENDING')
const searchText = ref('')
const pageIndex = ref(1)
const pageSize = ref(20)

const formatTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

const formatStudentAccount = (student?: { account?: string | null; studentId?: string }) => {
  const account = student?.account ?? ''
  if (/^\d+$/.test(account)) return account
  const fallback = student?.studentId ?? ''
  if (/^\d+$/.test(fallback)) return fallback
  return '-'
}

const formatStudentDisplay = (student?: { name?: string | null; account?: string | null; studentId?: string }) => {
  const name = student?.name?.trim() || student?.account || '学生'
  const account = formatStudentAccount(student)
  return `${name}（${account}）`
}

const mergedSubmissions = computed(() => {
  const map = new Map<
    string,
    {
        studentId: string
        student: any
        submittedAt?: string
        score: number | null
        aiScore: number | null
        assignmentTotalScore: number | null
        isFinal: boolean
        hasObjection: boolean
        submissionVersionId: string
        items: any[]
      }
  >()
  submissions.value.forEach((item: any) => {
    const studentId = item.student?.studentId
    if (!studentId) return
    if (!map.has(studentId)) {
      map.set(studentId, {
        studentId,
        student: item.student,
        submittedAt: item.submittedAt,
        score:
          typeof item.assignmentScore === 'number' && Number.isFinite(item.assignmentScore)
            ? Number(item.assignmentScore)
            : null,
        aiScore:
          typeof item.aiTotalScore === 'number' && Number.isFinite(item.aiTotalScore)
            ? Number(item.aiTotalScore)
            : null,
        assignmentTotalScore:
          typeof item.assignmentTotalScore === 'number' && Number.isFinite(item.assignmentTotalScore)
            ? Number(item.assignmentTotalScore)
            : null,
        isFinal: Boolean(item.isFinal ?? item.status === 'FINAL'),
        hasObjection: Boolean(item.aiIsUncertain),
        submissionVersionId: item.submissionVersionId,
        items: [item],
      })
      return
    }
    const group = map.get(studentId)
    if (!group) return
    group.items.push(item)
    const prevTime = new Date(group.submittedAt ?? 0).getTime()
    const nextTime = new Date(item.submittedAt ?? 0).getTime()
    if (nextTime >= prevTime) {
      group.submittedAt = item.submittedAt
      group.submissionVersionId = item.submissionVersionId
    }
    if (!Boolean(item.isFinal ?? item.status === 'FINAL')) {
      group.isFinal = false
    }
    if (Boolean(item.aiIsUncertain)) {
      group.hasObjection = true
    }
    if (group.score === null) {
      const assignmentScore =
        typeof item.assignmentScore === 'number' && Number.isFinite(item.assignmentScore)
          ? Number(item.assignmentScore)
          : null
      if (assignmentScore !== null) {
        group.score = assignmentScore
      }
    }
  })
  return Array.from(map.values()).map((group) => {
    const assignmentTotal =
      typeof group.assignmentTotalScore === 'number' && Number.isFinite(group.assignmentTotalScore)
        ? group.assignmentTotalScore
        : 0
    const toProjectedScore = (field: 'aiTotalScore' | 'finalScore') => {
      if (assignmentTotal <= 0) return null
      let hasSample = false
      const total = group.items.reduce((sum: number, item: any) => {
        const raw = Number(item?.[field])
        const maxScore = Number(item?.questionMaxScore)
        const weight = Number(item?.questionWeight)
        if (
          !Number.isFinite(raw) ||
          !Number.isFinite(maxScore) ||
          !Number.isFinite(weight) ||
          maxScore <= 0 ||
          weight <= 0
        ) {
          return sum
        }
        hasSample = true
        const clamped = Math.max(0, Math.min(raw, maxScore))
        return sum + (clamped / maxScore) * (weight / 100) * assignmentTotal
      }, 0)
      return hasSample ? Number(total.toFixed(2)) : null
    }
    const projectedAi = toProjectedScore('aiTotalScore')
    if (projectedAi !== null) {
      group.aiScore = projectedAi
    }
    if (typeof group.score === 'number' && Number.isFinite(group.score)) {
      return group
    }
    if (!group.isFinal) {
      return group
    }
    const projectedFinal = toProjectedScore('finalScore')
    return {
      ...group,
      score: projectedFinal,
    }
  })
})

const scoreLabel = (item: {
  isFinal: boolean
  score: number | null
  aiScore: number | null
  assignmentTotalScore: number | null
}) => {
  const formatScoreValue = (value: number) => {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
  }
  const denominator =
    typeof item.assignmentTotalScore === 'number' && Number.isFinite(item.assignmentTotalScore)
      ? item.assignmentTotalScore
      : 10
  const denominatorText = formatScoreValue(denominator)
  if (item.isFinal) {
    if (typeof item.score !== 'number' || !Number.isFinite(item.score)) return `-/${denominatorText}分`
    return `${formatScoreValue(item.score)}/${denominatorText}分`
  }
  if (typeof item.aiScore !== 'number' || !Number.isFinite(item.aiScore)) return `-/${denominatorText}分`
  return `${formatScoreValue(item.aiScore)}/${denominatorText}分`
}

const filteredSubmissions = computed(() => {
  if (statusFilter.value === 'MISSING') return []
  const keyword = searchText.value.trim()
  let list = mergedSubmissions.value
  if (statusFilter.value === 'PENDING') {
    list = list.filter((item: any) => !item.isFinal)
  } else if (statusFilter.value === 'GRADED') {
    list = list.filter((item: any) => item.isFinal)
  }
  if (keyword) {
    list = list.filter((item: any) =>
      `${item.student.name ?? ''}${item.student.account ?? ''}`.includes(keyword),
    )
  }
  return list
})

const displayCount = computed(() =>
  statusFilter.value === 'MISSING'
    ? missingStudents.value.length
    : filteredSubmissions.value.length,
)

const pendingCount = computed(() =>
  mergedSubmissions.value.filter((item) => !item.isFinal).length,
)

const gradedCount = computed(() =>
  mergedSubmissions.value.filter((item) => item.isFinal).length,
)

const allCount = computed(() => mergedSubmissions.value.length)

const missingCount = computed(() => missingStudents.value.length)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredSubmissions.value.length / pageSize.value)),
)

const pagedSubmissions = computed(() => {
  const start = (pageIndex.value - 1) * pageSize.value
  return filteredSubmissions.value.slice(start, start + pageSize.value)
})

const goGrading = (submissionVersionId: string, studentId?: string) => {
  if (!assignmentId.value || !submissionVersionId) return
  router.push({
    path: `/teacher/grading/${assignmentId.value}/submission/${submissionVersionId}`,
    query: {
      ...(courseId.value ? { courseId: courseId.value } : {}),
      ...(studentId ? { studentId } : {}),
    },
  })
}

const goBack = () => {
  if (courseId.value) {
    router.push(`/teacher/grading/course/${courseId.value}`)
  } else {
    router.push('/teacher/grading')
  }
}

const loadData = async () => {
  if (!assignmentId.value) {
    loadError.value = '缺少作业 ID'
    return
  }
  loadError.value = ''
  try {
    const response = await listSubmissionsByAssignment(assignmentId.value)
    submissions.value = response?.items ?? []
  } catch (err) {
    submissions.value = []
    loadError.value = err instanceof Error ? err.message : '加载提交失败'
  }
}

const loadMissing = async () => {
  if (!assignmentId.value) return
  missingError.value = ''
  try {
    const response = await listMissingByAssignment(assignmentId.value)
    missingStudents.value = response?.items ?? []
  } catch (err) {
    missingStudents.value = []
    missingError.value = err instanceof Error ? err.message : '加载未提交失败'
  }
}

const loadAll = async () => {
  await Promise.all([loadData(), loadMissing()])
}

watch([statusFilter, searchText], () => {
  pageIndex.value = 1
})

watch(statusFilter, async (value) => {
  if (value === 'MISSING' && !missingStudents.value.length) {
    await loadMissing()
  }
})

onMounted(async () => {
  await refreshProfile()
  await loadAll()
})

watch(
  assignmentId,
  async () => {
    await loadAll()
  },
)
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

.grading-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}

.grading-tabs {
  display: flex;
  gap: 8px;
  justify-self: end;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.tab-btn {
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #ffffff;
}

.grading-search {
  min-width: 0;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
}

.submission-list {
  display: grid;
  gap: 10px;
}

.submission-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submission-row.clickable {
  cursor: pointer;
}

.submission-row.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 24px rgba(57, 78, 126, 0.14);
}

.submission-row.clickable:active {
  transform: translateY(0);
}

.submission-row.clickable:focus-visible {
  outline: 2px solid rgba(95, 148, 255, 0.7);
  outline-offset: 2px;
}

.submission-name {
  font-weight: 600;
}

.submission-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.submission-status {
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
}

.submission-score-simple {
  font-size: 22px;
  line-height: 1;
  font-weight: 800;
  color: rgba(26, 29, 51, 0.9);
  white-space: nowrap;
}

.submission-status.pending {
  background: rgba(255, 196, 154, 0.35);
  color: #9a4a12;
}

.submission-status.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
}

.submission-status.objection {
  background: rgba(244, 67, 54, 0.18);
  color: #b42318;
}

.paging {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.page-btn {
  border: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-text {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 900px) {
  .grading-toolbar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .grading-tabs {
    margin-left: 0;
    justify-content: flex-start;
  }

  .submission-row {
    grid-template-columns: 1fr auto auto;
    align-items: flex-start;
  }

  .submission-score-simple {
    font-size: 18px;
  }
}
</style>
