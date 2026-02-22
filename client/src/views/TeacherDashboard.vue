<template>
  <TeacherLayout
    title="教师的教学中心"
    subtitle="班级进度、批改状态和作业数据一屏总览"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
  >
    <section class="kpi-grid">
      <article class="kpi-card kpi-blue">
        <div class="kpi-title">我的班级</div>
        <div class="kpi-value">{{ totalCourses }}</div>
        <div class="kpi-meta">活跃课程</div>
      </article>
      <article class="kpi-card kpi-green">
        <div class="kpi-title">我的作业</div>
        <div class="kpi-value">{{ totalAssignments }}</div>
        <div class="kpi-meta">发布/草稿</div>
      </article>
      <article class="kpi-card kpi-amber">
        <div class="kpi-title">待批改</div>
        <div class="kpi-value">{{ totalPending }}</div>
        <div class="kpi-meta">AI已批改 {{ totalAiSuccess }}</div>
      </article>
      <article class="kpi-card kpi-purple">
        <div class="kpi-title">班级学生</div>
        <div class="kpi-value">{{ totalStudents }}</div>
        <div class="kpi-meta">活跃学生</div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel glass">
        <div class="panel-title panel-title-row">
          <div>班级提交统计</div>
          <div class="panel-mini">平均完成率：{{ averageCompletionRate }}%</div>
        </div>
        <div class="class-list">
          <button
            v-for="item in courseStatsTop"
            :key="item.courseId"
            type="button"
            class="class-row"
            @click="goCourse(item.courseId)"
          >
            <div class="class-main">
              <div class="class-name">{{ item.courseName }}</div>
              <div class="class-meta">
                <span>{{ item.students }} 人</span>
                <span>已提交 {{ item.submitted }} 份</span>
              </div>
            </div>
            <div class="class-rate">{{ item.completionRate }}%</div>
          </button>
          <div v-if="!courseStatsTop.length" class="task-empty">
            {{ gradingError || '暂无班级数据' }}
          </div>
        </div>
      </article>

      <article class="panel glass">
        <div class="panel-title">作业状态分布</div>
        <div class="status-wrap">
          <div class="status-donut" :style="donutStyle">
            <div class="status-center">{{ totalAssignments }}</div>
          </div>
          <div class="status-legend">
            <div class="legend-item">
              <span class="dot dot-open" /> 发布中 {{ statusRates.open }}%
            </div>
            <div class="legend-item">
              <span class="dot dot-closed" /> 已结束 {{ statusRates.closed }}%
            </div>
            <div class="legend-item">
              <span class="dot dot-draft" /> 草稿 {{ statusRates.draft }}%
            </div>
          </div>
        </div>
      </article>

      <article class="panel glass">
        <div class="panel-title">AI批改统计</div>
        <div class="mini-kpi-grid">
          <div class="mini-kpi">
            <div class="mini-label">累计批改</div>
            <div class="mini-value">{{ totalSubmitted }}</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">AI成功</div>
            <div class="mini-value good">{{ totalAiSuccess }}</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">AI失败</div>
            <div class="mini-value bad">{{ totalAiFailed }}</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">等待批改</div>
            <div class="mini-value warn">{{ totalPending }}</div>
          </div>
        </div>
      </article>

      <article class="panel glass">
        <div class="panel-title">作业完成分析</div>
        <div class="mini-kpi-grid">
          <div class="mini-kpi">
            <div class="mini-label">整体完成率</div>
            <div class="mini-value">{{ overallCompletionRate }}%</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">已提交占比</div>
            <div class="mini-value good">{{ submittedRate }}%</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">待批改占比</div>
            <div class="mini-value warn">{{ pendingRate }}%</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-label">未提交占比</div>
            <div class="mini-value bad">{{ unsubmittedRate }}%</div>
          </div>
        </div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel glass">
        <div class="panel-title panel-title-row">
          <div>我的作业管理</div>
          <button class="ghost-action" type="button" @click="goGradingOverview">
            查看全部
          </button>
        </div>
        <div class="table-wrap">
          <table class="overview-table">
            <thead>
              <tr>
                <th>作业</th>
                <th>课程</th>
                <th>提交率</th>
                <th>状态</th>
                <th>截止时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in assignmentRowsTop" :key="item.id">
                <td>{{ item.title }}</td>
                <td>{{ item.courseName }}</td>
                <td>{{ item.submissionRate }}%</td>
                <td>
                  <span class="status-pill" :class="item.statusClass">
                    {{ item.statusText }}
                  </span>
                </td>
                <td>{{ item.deadlineText }}</td>
              </tr>
              <tr v-if="!assignmentRowsTop.length">
                <td colspan="5" class="empty-cell">{{ gradingError || '暂无作业数据' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel glass">
        <div class="panel-title panel-title-row">
          <div>待处理提交</div>
          <button class="ghost-action" type="button" @click="goGradingOverview">
            查看更多
          </button>
        </div>
        <div class="table-wrap">
          <table class="overview-table">
            <thead>
              <tr>
                <th>课程</th>
                <th>作业</th>
                <th>待批改</th>
                <th>未提交</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pendingRowsTop" :key="item.id">
                <td>{{ item.courseName }}</td>
                <td>{{ item.title }}</td>
                <td>{{ item.pendingCount }}</td>
                <td>{{ item.unsubmittedCount }}</td>
                <td>
                  <button
                    class="table-action"
                    type="button"
                    @click="goGrading(item.id, item.courseId)"
                  >
                    去批改
                  </button>
                </td>
              </tr>
              <tr v-if="!pendingRowsTop.length">
                <td colspan="5" class="empty-cell">当前没有待处理提交</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listTeacherAssignments } from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const gradingItems = ref<any[]>([])
const gradingError = ref('')
const router = useRouter()

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

const safeRound = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const formatDeadline = (deadline: string | null | undefined) => {
  if (!deadline) return '-'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '-'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

const mapStatusText = (status: string) => {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'OPEN') return '发布中'
  if (normalized === 'CLOSED') return '已结束'
  return '草稿'
}

const gradingList = computed(() =>
  gradingItems.value.map((item) => {
    const studentCount = Number(item.studentCount ?? 0)
    const submittedCount = Number(item.submittedStudentCount ?? item.submissionCount ?? 0)
    const pendingCount = Number(item.pendingStudentCount ?? item.pendingCount ?? 0)
    const unsubmittedCount = Number(item.unsubmittedCount ?? 0)
    const aiSuccessCount = Number(item.aiSuccessCount ?? 0)
    const aiFailedCount = Number(item.aiFailedCount ?? 0)

    return {
      id: item.id,
      title: item.title ?? '未命名作业',
      courseId: item.courseId,
      courseName: item.courseName ?? item.courseId ?? '课程',
      status: String(item.status ?? 'DRAFT').toUpperCase(),
      statusText: mapStatusText(item.status ?? 'DRAFT'),
      statusClass:
        String(item.status ?? '').toUpperCase() === 'OPEN'
          ? 'is-open'
          : String(item.status ?? '').toUpperCase() === 'CLOSED'
            ? 'is-closed'
            : 'is-draft',
      deadline: item.deadline,
      deadlineText: formatDeadline(item.deadline),
      studentCount,
      submittedCount,
      pendingCount,
      unsubmittedCount,
      aiSuccessCount,
      aiFailedCount,
      submissionRate: clampPercent(
        studentCount > 0 ? (submittedCount / studentCount) * 100 : 0,
      ),
    }
  }),
)

const totalAssignments = computed(() => gradingList.value.length)
const totalCourses = computed(() => new Set(gradingList.value.map((item) => item.courseId)).size)
const totalPending = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.pendingCount, 0),
)
const totalAiSuccess = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.aiSuccessCount, 0),
)
const totalAiFailed = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.aiFailedCount, 0),
)
const totalSubmitted = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.submittedCount, 0),
)
const totalUnsubmitted = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.unsubmittedCount, 0),
)

const courseStats = computed(() => {
  const map = new Map<
    string,
    {
      courseId: string
      courseName: string
      students: number
      submitted: number
      completionRate: number
      assignmentCount: number
    }
  >()

  gradingList.value.forEach((item) => {
    const exist = map.get(item.courseId)
    if (!exist) {
      map.set(item.courseId, {
        courseId: item.courseId,
        courseName: item.courseName,
        students: item.studentCount,
        submitted: item.submittedCount,
        completionRate: item.submissionRate,
        assignmentCount: 1,
      })
      return
    }
    exist.assignmentCount += 1
    exist.students = Math.max(exist.students, item.studentCount)
    exist.submitted += item.submittedCount
    const base = exist.students * exist.assignmentCount
    exist.completionRate = clampPercent(base > 0 ? (exist.submitted / base) * 100 : 0)
  })

  return Array.from(map.values())
})

const totalStudents = computed(() =>
  courseStats.value.reduce((acc, item) => acc + item.students, 0),
)

const averageCompletionRate = computed(() => {
  if (!courseStats.value.length) return 0
  const sum = courseStats.value.reduce((acc, item) => acc + item.completionRate, 0)
  return safeRound(sum / courseStats.value.length)
})

const overallCompletionRate = computed(() => {
  const denominator = totalSubmitted.value + totalUnsubmitted.value
  if (!denominator) return 0
  return safeRound((totalSubmitted.value / denominator) * 100)
})

const submittedRate = computed(() => overallCompletionRate.value)
const pendingRate = computed(() => {
  if (!totalSubmitted.value) return 0
  return safeRound((totalPending.value / totalSubmitted.value) * 100)
})
const unsubmittedRate = computed(() => {
  const denominator = totalSubmitted.value + totalUnsubmitted.value
  if (!denominator) return 0
  return safeRound((totalUnsubmitted.value / denominator) * 100)
})

const statusCounts = computed(() => {
  const counts = { open: 0, closed: 0, draft: 0 }
  gradingList.value.forEach((item) => {
    if (item.status === 'OPEN') counts.open += 1
    else if (item.status === 'CLOSED') counts.closed += 1
    else counts.draft += 1
  })
  return counts
})

const statusRates = computed(() => {
  const total = totalAssignments.value || 1
  return {
    open: safeRound((statusCounts.value.open / total) * 100),
    closed: safeRound((statusCounts.value.closed / total) * 100),
    draft: safeRound((statusCounts.value.draft / total) * 100),
  }
})

const donutStyle = computed(() => {
  const open = statusRates.value.open
  const closed = statusRates.value.closed
  const split1 = open
  const split2 = open + closed
  return {
    background: `conic-gradient(
      #1f87f0 0% ${split1}%,
      #ff6a56 ${split1}% ${split2}%,
      #8a95aa ${split2}% 100%
    )`,
  }
})

const courseStatsTop = computed(() =>
  [...courseStats.value]
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5)
    .map((item) => ({ ...item, completionRate: safeRound(item.completionRate) })),
)

const assignmentRowsTop = computed(() =>
  [...gradingList.value]
    .sort((a, b) => {
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
    .slice(0, 8)
    .map((item) => ({ ...item, submissionRate: safeRound(item.submissionRate) })),
)

const pendingRowsTop = computed(() =>
  [...gradingList.value]
    .filter((item) => item.pendingCount > 0 || item.unsubmittedCount > 0)
    .sort((a, b) => b.pendingCount + b.unsubmittedCount - (a.pendingCount + a.unsubmittedCount))
    .slice(0, 8),
)

const goGrading = (assignmentId: string, courseId?: string) => {
  router.push({
    path: `/teacher/grading/${assignmentId}`,
    query: courseId ? { courseId } : undefined,
  })
}

const goCourse = (courseId: string) => {
  router.push(`/teacher/courses/${courseId}`)
}

const goGradingOverview = () => {
  router.push('/teacher/grading')
}

const refreshAll = async () => {
  gradingError.value = ''
  try {
    await refreshProfile()
    const response = await listTeacherAssignments()
    gradingItems.value = response?.items ?? []
  } catch (err) {
    gradingError.value = err instanceof Error ? err.message : '加载作业失败'
  }
}

onMounted(async () => {
  await refreshAll()
})
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card {
  border-radius: 16px;
  padding: 16px 18px;
  color: #fff;
  box-shadow: 0 12px 24px rgba(43, 76, 124, 0.2);
}

.kpi-blue {
  background: linear-gradient(135deg, #1f87f0, #43b2f1);
}

.kpi-green {
  background: linear-gradient(135deg, #25b85f, #35ce6f);
}

.kpi-amber {
  background: linear-gradient(135deg, #f4ab00, #ffbe1b);
}

.kpi-purple {
  background: linear-gradient(135deg, #9a53db, #c26ce2);
}

.kpi-title {
  font-size: 13px;
  opacity: 0.94;
}

.kpi-value {
  margin-top: 4px;
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
}

.kpi-meta {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.9;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel-mini {
  color: rgba(26, 29, 51, 0.55);
  font-size: 13px;
  font-weight: 500;
}

.class-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.class-row {
  border: none;
  border-radius: 14px;
  background: rgba(240, 247, 255, 0.72);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
}

.class-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.class-name {
  font-weight: 600;
}

.class-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.class-rate {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  display: grid;
  place-items: center;
  color: #21a360;
  font-size: 13px;
  font-weight: 700;
}

.status-wrap {
  display: grid;
  place-items: center;
  gap: 14px;
  padding: 8px 0 4px;
}

.status-donut {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.status-center {
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 26px;
  color: #1d3d68;
}

.status-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-open {
  background: #1f87f0;
}

.dot-closed {
  background: #ff6a56;
}

.dot-draft {
  background: #8a95aa;
}

.mini-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.mini-kpi {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  padding: 12px;
}

.mini-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.56);
}

.mini-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #243e66;
}

.mini-value.good {
  color: #1f9f53;
}

.mini-value.warn {
  color: #ef9a06;
}

.mini-value.bad {
  color: #e65a5a;
}

.table-wrap {
  overflow: auto;
}

.overview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.overview-table thead th {
  text-align: left;
  color: rgba(26, 29, 51, 0.55);
  font-weight: 600;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(26, 29, 51, 0.1);
}

.overview-table tbody td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(26, 29, 51, 0.07);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
}

.status-pill.is-open {
  color: #209b4a;
  background: rgba(42, 184, 96, 0.16);
}

.status-pill.is-closed {
  color: #da5f45;
  background: rgba(255, 106, 86, 0.14);
}

.status-pill.is-draft {
  color: #667187;
  background: rgba(102, 113, 135, 0.14);
}

.table-action {
  border: none;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.9), rgba(108, 229, 215, 0.9));
}

.empty-cell {
  text-align: center;
  color: rgba(26, 29, 51, 0.5);
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

@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
