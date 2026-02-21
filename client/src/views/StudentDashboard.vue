<template>
  <StudentLayout
    title="个人主页"
    subtitle="学习进度与任务安排一屏总览"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="学习面板"
  >
    <section class="kpi-grid">
      <article class="kpi-card kpi-blue">
        <div class="kpi-title">我的课程</div>
        <div class="kpi-value">{{ totalCourses }}</div>
        <div class="kpi-meta">进行中课程</div>
      </article>
      <article class="kpi-card kpi-green">
        <div class="kpi-title">未截止作业</div>
        <div class="kpi-value">{{ openAssignmentCount }}</div>
        <div class="kpi-meta">当前任务池</div>
      </article>
      <article class="kpi-card kpi-amber">
        <div class="kpi-title">待提交</div>
        <div class="kpi-value">{{ pendingTasks.length }}</div>
        <div class="kpi-meta">尽快完成</div>
      </article>
      <article class="kpi-card kpi-purple">
        <div class="kpi-title">已出分</div>
        <div class="kpi-value">{{ gradedTasks.length }}</div>
        <div class="kpi-meta">可查看成绩</div>
      </article>
    </section>

    <div class="dashboard-stack">
      <section class="dashboard-grid">
        <div class="panel glass">
          <div class="panel-title panel-title-row">
            <div>学习任务进度</div>
            <div class="panel-mini">总体完成率：{{ completionRate }}%</div>
          </div>
          <div class="class-list">
            <div v-for="item in courseProgressTop" :key="item.courseKey" class="class-row">
              <div class="class-main">
                <div class="class-name">{{ item.courseName }}</div>
                <div class="class-meta">
                  <span>已提交 {{ item.submitted }} / {{ item.total }}</span>
                  <span>待提交 {{ item.pending }}</span>
                </div>
              </div>
              <div class="class-rate">{{ item.rate }}%</div>
            </div>
            <div v-if="!courseProgressTop.length" class="task-empty">
              {{ assignmentError || '暂无课程数据' }}
            </div>
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-title">作业状态分布</div>
          <div class="status-wrap">
            <div class="status-donut" :style="donutStyle">
              <div class="status-center">{{ openAssignmentCount }}</div>
            </div>
            <div class="status-legend">
              <div class="legend-item">
                <span class="dot dot-pending" /> 待提交 {{ statusRates.pending }}%
              </div>
              <div class="legend-item">
                <span class="dot dot-submitted" /> 已提交 {{ statusRates.submitted }}%
              </div>
              <div class="legend-item">
                <span class="dot dot-graded" /> 已出分 {{ statusRates.graded }}%
              </div>
            </div>
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-title">最近截止</div>
          <div class="task-list compact">
            <div v-for="task in urgentPendingTasks" :key="task.id" class="task-card compact">
              <div class="task-head compact">
                <div class="task-main">
                  <div class="task-title" v-mathjax v-html="renderTextHtml(task.title)" />
                  <div class="task-sub">{{ task.course }}</div>
                </div>
                <div class="task-deadline">{{ task.deadline }}</div>
              </div>
              <button class="task-action small" @click="goSubmit(task.id)">去提交</button>
            </div>
            <div v-if="!urgentPendingTasks.length" class="task-empty">当前没有紧急截止作业</div>
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-title">成绩概览</div>
          <div class="mini-kpi-grid">
            <div class="mini-kpi">
              <div class="mini-label">已出分作业</div>
              <div class="mini-value">{{ gradedTasks.length }}</div>
            </div>
            <div class="mini-kpi">
              <div class="mini-label">平均分</div>
              <div class="mini-value good">{{ averageScore }}</div>
            </div>
            <div class="mini-kpi">
              <div class="mini-label">最高分</div>
              <div class="mini-value">{{ bestScore }}</div>
            </div>
            <div class="mini-kpi">
              <div class="mini-label">最近一次得分</div>
              <div class="mini-value warn">{{ latestScore }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-grid">
        <article class="panel glass">
          <div class="panel-title panel-title-row">
            <div>待提交作业</div>
            <button class="ghost-action" type="button" @click="goAssignments">
              查看全部
            </button>
          </div>
          <div class="table-wrap">
            <table class="overview-table">
              <thead>
                <tr>
                  <th>作业</th>
                  <th>课程</th>
                  <th>截止时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in pendingTasksTop" :key="task.id">
                  <td v-mathjax v-html="renderTextHtml(task.title)" />
                  <td>{{ task.course }}</td>
                  <td>{{ task.deadline }}</td>
                  <td><span class="status-pill warn">未提交</span></td>
                  <td>
                    <button class="table-action" type="button" @click="goSubmit(task.id)">继续作业</button>
                  </td>
                </tr>
                <tr v-if="!pendingTasksTop.length">
                  <td colspan="5" class="empty-cell">{{ assignmentError || '暂无待提交作业' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel glass">
          <div class="panel-title panel-title-row">
            <div>已提交与已出分</div>
            <button class="ghost-action" type="button" @click="goScores">
              查看成绩
            </button>
          </div>
          <div class="table-wrap">
            <table class="overview-table">
              <thead>
                <tr>
                  <th>作业</th>
                  <th>课程</th>
                  <th>截止时间</th>
                  <th>状态</th>
                  <th>得分</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in submittedTasksTop" :key="task.id">
                  <td v-mathjax v-html="renderTextHtml(task.title)" />
                  <td>{{ task.course }}</td>
                  <td>{{ task.deadline }}</td>
                  <td>
                    <span class="status-pill" :class="task.isFinal ? 'good' : 'info'">
                      {{ task.isFinal ? '已出分' : '已提交' }}
                    </span>
                  </td>
                  <td>{{ scoreByAssignment[task.id] ?? '-' }}</td>
                </tr>
                <tr v-if="!submittedTasksTop.length">
                  <td colspan="5" class="empty-cell">{{ assignmentError || '暂无已提交作业' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>

    <RouterLink to="/student/assistant" class="floating-ai" aria-label="AI assistant">
      <span>AI</span>
    </RouterLink>
  </StudentLayout>

  <div v-if="showPasswordModal" class="password-modal">
    <div class="password-card glass">
      <div class="password-title">首次登录请修改密码</div>
      <div class="password-subtitle">为保障账号安全，请先设置新密码。</div>
      <div class="password-form">
        <input
          v-model="currentPassword"
          type="password"
          placeholder="当前密码"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="新密码（至少 6 位）"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="确认新密码"
        />
      </div>
      <div v-if="passwordError" class="password-error">{{ passwordError }}</div>
      <button
        class="password-submit"
        :disabled="passwordLoading"
        @click="submitPasswordChange"
      >
        {{ passwordLoading ? '提交中...' : '确认修改' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { changePassword } from '../api/auth'
import { listAllAssignments, listOpenAssignments } from '../api/assignment'
import { listMyScores } from '../api/score'
import { getAccessToken, getStoredUser, updateStoredUser } from '../auth/storage'
import { useStudentProfile } from '../composables/useStudentProfile'

const { storedUser, profileName, profileAccount, refreshProfile } =
  useStudentProfile()

const showPasswordModal = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const assignmentItems = ref([])
const assignmentError = ref('')
const scoreItems = ref([])
const router = useRouter()

const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
const safeRound = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const requiresPasswordChange = computed(() => {
  const user = storedUser.value
  if (!user || user.role !== 'STUDENT') return false
  if (!user.createdAt || !user.updatedAt) return false
  return user.createdAt === user.updatedAt
})

const submitPasswordChange = async () => {
  passwordError.value = ''
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = '请完整填写所有字段'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  if (passwordLoading.value) return
  passwordLoading.value = true
  try {
    await changePassword(
      {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value,
      },
      getAccessToken(),
    )

    updateStoredUser({ updatedAt: new Date().toISOString() })
    storedUser.value = getStoredUser()
    showPasswordModal.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : '修改失败'
  } finally {
    passwordLoading.value = false
  }
}

const formatDeadline = (deadline) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `截止 ${year}/${month}/${day} ${hour}:${minute}`
}

const renderTextHtml = (text) => {
  if (!text) return ''
  return String(text).replace(/\n/g, '<br />')
}

const finalAssignmentIds = computed(() => {
  const ids = new Set()
  scoreItems.value.forEach((item) => {
    if (item.assignmentId && item.totalScore != null) {
      ids.add(item.assignmentId)
    }
  })
  return ids
})

const scoreByAssignment = computed(() => {
  const map = {}
  scoreItems.value.forEach((item) => {
    if (!item.assignmentId || item.totalScore == null) return
    map[item.assignmentId] = safeRound(Number(item.totalScore), 1)
  })
  return map
})

const taskList = computed(() =>
  assignmentItems.value.map((item) => {
    const isFinal = finalAssignmentIds.value.has(item.id)
    const submitted = Boolean(item.submitted)
    return {
      id: item.id,
      title: item.title,
      course: item.courseName ?? item.courseId,
      status: item.status,
      rawDeadline: item.deadline ?? null,
      deadline: formatDeadline(item.deadline),
      submitted,
      isFinal,
      level: isFinal ? '已批改' : submitted ? '已提交' : '未提交',
    }
  }),
)

const isOpenTask = (task) => {
  const status = String(task.status ?? '').toUpperCase()
  if (status && status !== 'OPEN') return false
  const deadlineValue = task.rawDeadline ?? task.deadline
  if (!deadlineValue) return true
  const deadline = new Date(deadlineValue).getTime()
  if (Number.isNaN(deadline)) return true
  return deadline > Date.now()
}

const openTasks = computed(() =>
  assignmentItems.value.filter((item) => isOpenTask(item)),
)

const pendingTasks = computed(() =>
  taskList.value.filter((task) => !task.submitted && isOpenTask(task)),
)

const submittedTasks = computed(() =>
  taskList.value.filter((task) => task.submitted),
)

const gradedTasks = computed(() =>
  taskList.value.filter((task) => task.isFinal),
)

const openAssignmentCount = computed(() => openTasks.value.length)

const totalCourses = computed(() => {
  const keys = new Set(taskList.value.map((task) => `${task.course}`))
  return keys.size
})

const completionRate = computed(() => {
  if (!openAssignmentCount.value) return 0
  return safeRound((submittedTasks.value.length / openAssignmentCount.value) * 100, 1)
})

const statusRates = computed(() => {
  const total = openAssignmentCount.value || 1
  const pending = clampPercent((pendingTasks.value.length / total) * 100)
  const graded = clampPercent((gradedTasks.value.length / total) * 100)
  const submitted = clampPercent(100 - pending - graded)
  return {
    pending: safeRound(pending, 1),
    submitted: safeRound(submitted, 1),
    graded: safeRound(graded, 1),
  }
})

const donutStyle = computed(() => {
  const pending = statusRates.value.pending
  const submitted = statusRates.value.submitted
  const graded = statusRates.value.graded
  return {
    background: `conic-gradient(
      #ffbe3b 0 ${pending}%,
      #5aa1ff ${pending}% ${safeRound(pending + submitted, 1)}%,
      #30c879 ${safeRound(pending + submitted, 1)}% ${safeRound(
      pending + submitted + graded,
      1,
    )}%,
      rgba(172, 180, 198, 0.25) ${safeRound(pending + submitted + graded, 1)}% 100%
    )`,
  }
})

const parseDeadlineTime = (deadlineLabel) => {
  if (!deadlineLabel || deadlineLabel.startsWith('未设置')) return Number.POSITIVE_INFINITY
  const raw = String(deadlineLabel).replace('截止 ', '')
  const match = raw.match(
    /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/,
  )
  if (!match) {
    const fallback = new Date(raw).getTime()
    return Number.isNaN(fallback) ? Number.POSITIVE_INFINITY : fallback
  }
  const [, y, m, d, h, min] = match
  const value = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    0,
    0,
  ).getTime()
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value
}

const urgentPendingTasks = computed(() =>
  [...pendingTasks.value].sort((a, b) => parseDeadlineTime(a.deadline) - parseDeadlineTime(b.deadline)).slice(0, 4),
)

const pendingTasksTop = computed(() => pendingTasks.value.slice(0, 6))
const submittedTasksTop = computed(() => submittedTasks.value.slice(0, 6))

const gradedScores = computed(() =>
  scoreItems.value
    .map((item) => Number(item.totalScore))
    .filter((value) => Number.isFinite(value)),
)

const averageScore = computed(() => {
  if (!gradedScores.value.length) return '-'
  return safeRound(
    gradedScores.value.reduce((acc, item) => acc + item, 0) / gradedScores.value.length,
    1,
  )
})

const bestScore = computed(() => {
  if (!gradedScores.value.length) return '-'
  return safeRound(Math.max(...gradedScores.value), 1)
})

const latestScore = computed(() => {
  const latest = [...scoreItems.value]
    .filter((item) => item.totalScore != null)
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || 0).getTime()
      const tb = new Date(b.updatedAt || 0).getTime()
      return tb - ta
    })[0]
  if (!latest) return '-'
  return safeRound(Number(latest.totalScore), 1)
})

const courseProgressTop = computed(() => {
  const map = new Map()
  taskList.value.forEach((task) => {
    const key = task.course || '未分组课程'
    if (!map.has(key)) {
      map.set(key, { courseKey: key, courseName: key, total: 0, submitted: 0, pending: 0 })
    }
    const row = map.get(key)
    row.total += 1
    if (task.submitted) {
      row.submitted += 1
    } else {
      row.pending += 1
    }
  })
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      rate: item.total ? safeRound((item.submitted / item.total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4)
})

const goSubmit = (assignmentId) => {
  if (!assignmentId) return
  router.push(`/student/assignments/${assignmentId}/submit`)
}

const goAssignments = () => router.push('/student/assignments')
const goScores = () => router.push('/student/scores')
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const forceModal = params.get('forcePasswordModal') === '1'
  const token = getAccessToken()

  if (token) {
    await refreshProfile()
  }

  try {
    const response = await listAllAssignments()
    assignmentItems.value = response?.items ?? []
    if (!assignmentItems.value.length) {
      const fallback = await listOpenAssignments()
      assignmentItems.value = fallback?.items ?? []
    }
  } catch {
    try {
      const fallback = await listOpenAssignments()
      assignmentItems.value = fallback?.items ?? []
      assignmentError.value = ''
    } catch (fallbackErr) {
      assignmentError.value =
        fallbackErr instanceof Error ? fallbackErr.message : '加载作业失败'
    }
  }

  try {
    const response = await listMyScores()
    scoreItems.value = response?.items ?? []
  } catch {
    scoreItems.value = []
  }

  if (forceModal || requiresPasswordChange.value) {
    showPasswordModal.value = true
  }
})
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.dashboard-stack {
  display: grid;
  gap: 14px;
}

.kpi-card {
  padding: 18px;
  border-radius: 16px;
  color: #fff;
}

.kpi-blue { background: linear-gradient(135deg, #4092ff, #62c3ff); }
.kpi-green { background: linear-gradient(135deg, #32bb6e, #4ad58b); }
.kpi-amber { background: linear-gradient(135deg, #ffb019, #ffcb53); }
.kpi-purple { background: linear-gradient(135deg, #8e6fff, #c172ed); }

.kpi-title {
  font-size: 13px;
  font-weight: 700;
  opacity: 0.95;
}

.kpi-value {
  margin-top: 6px;
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.kpi-meta {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.92;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.panel {
  padding: 16px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-title {
  font-size: 24px;
  font-weight: 800;
  color: #222a3f;
  margin-bottom: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-mini {
  font-size: 13px;
  color: #6e7890;
}

.class-list {
  display: grid;
  gap: 10px;
}

.class-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(214, 223, 240, 0.8);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.62);
}

.class-main {
  min-width: 0;
}

.class-name {
  font-size: 14px;
  font-weight: 700;
  color: #1f273d;
}

.class-meta {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  color: #7a8397;
  font-size: 12px;
}

.class-rate {
  color: #2f89ff;
  font-size: 16px;
  font-weight: 800;
}

.status-wrap {
  display: grid;
  grid-template-columns: 210px 1fr;
  gap: 8px;
  align-items: center;
}

.status-donut {
  width: 168px;
  height: 168px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin: 4px auto 2px;
  position: relative;
}

.status-donut::before {
  content: '';
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: rgba(251, 253, 255, 0.96);
  box-shadow: inset 0 0 0 1px rgba(205, 213, 226, 0.5);
}

.status-center {
  position: absolute;
  font-size: 30px;
  font-weight: 800;
  color: #25314b;
}

.status-legend {
  display: grid;
  gap: 10px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4e5972;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.dot-pending { background: #ffbe3b; }
.dot-submitted { background: #5aa1ff; }
.dot-graded { background: #30c879; }

.task-list {
  display: grid;
  gap: 10px;
}

.task-list.compact .task-card {
  padding: 10px 12px;
}

.task-card {
  border: 1px solid rgba(214, 223, 240, 0.8);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.62);
}

.task-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.task-head.compact {
  align-items: center;
}

.task-main {
  min-width: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f273d;
  line-height: 1.4;
}

.task-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #7a8397;
}

.task-deadline {
  white-space: nowrap;
  font-size: 12px;
  color: #f28b42;
  font-weight: 700;
}

.task-action {
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4c9fff, #72d5df);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  padding: 7px 12px;
  cursor: pointer;
}

.task-action.small {
  margin-top: 8px;
}

.task-empty {
  border: 1px dashed rgba(177, 188, 208, 0.6);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: #7a8397;
}

.mini-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mini-kpi {
  border: 1px solid rgba(214, 223, 240, 0.8);
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.62);
}

.mini-label {
  font-size: 12px;
  color: #7a8397;
}

.mini-value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 800;
  color: #2f3b56;
}

.mini-value.good { color: #2fb36b; }
.mini-value.warn { color: #df9837; }

.table-wrap {
  overflow: auto;
}

.overview-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.overview-table th,
.overview-table td {
  border-bottom: 1px solid rgba(214, 223, 240, 0.72);
  padding: 10px 8px;
  text-align: left;
  font-size: 13px;
  color: #2f3b56;
}

.overview-table th {
  font-weight: 700;
  color: #5f6980;
  background: rgba(255, 255, 255, 0.52);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.status-pill.warn {
  background: rgba(255, 190, 59, 0.18);
  color: #cb8d1c;
}

.status-pill.info {
  background: rgba(90, 161, 255, 0.18);
  color: #2f7ddd;
}

.status-pill.good {
  background: rgba(48, 200, 121, 0.2);
  color: #228c52;
}

.ghost-action {
  border: 1px solid rgba(199, 209, 228, 0.8);
  background: rgba(255, 255, 255, 0.72);
  color: #5a667f;
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.table-action {
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4c9fff, #72d5df);
  color: #fff;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.empty-cell {
  text-align: center !important;
  color: #7a8397 !important;
}

.password-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 20, 40, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 99;
  animation: fadeIn 0.35s ease;
}

.password-card {
  width: min(420px, 86vw);
  padding: 26px 24px 22px;
  border-radius: 22px;
  display: grid;
  gap: 12px;
}

.password-title {
  font-size: 18px;
  font-weight: 700;
}

.password-subtitle {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.password-form {
  display: grid;
  gap: 10px;
  margin-top: 6px;
}

.password-form input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}

.password-form input:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(78, 132, 255, 0.18);
}

.password-error {
  color: #e76464;
  font-size: 12px;
}

.password-submit {
  border: none;
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.9), rgba(129, 228, 194, 0.9));
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.password-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .status-wrap {
    grid-template-columns: 1fr;
  }

  .mini-kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
