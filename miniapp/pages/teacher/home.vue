<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card header-compact fx-fade-in">
      <view class="ui-profile profile-left">
        <view class="ui-avatar">{{ profileInitial }}</view>
        <view class="ui-profile-text">
          <view class="ui-profile-name">{{ profileName }}</view>
          <view class="ui-profile-account">{{ profileAccount }}</view>
        </view>
      </view>
      <button class="ui-btn-ghost logout-btn" @click="logout">退出登录</button>
    </view>

    <view class="kpi-grid">
      <view class="kpi-card blue fx-fade-up fx-delay-1">
        <view class="kpi-title">我的班级</view>
        <view class="kpi-value">{{ totalCourses }}</view>
        <view class="kpi-meta">活跃课程</view>
      </view>
      <view class="kpi-card green fx-fade-up fx-delay-2">
        <view class="kpi-title">我的作业</view>
        <view class="kpi-value">{{ totalAssignments }}</view>
        <view class="kpi-meta">发布/草稿</view>
      </view>
      <view class="kpi-card amber fx-fade-up fx-delay-3">
        <view class="kpi-title">待批改</view>
        <view class="kpi-value">{{ totalPending }}</view>
        <view class="kpi-meta">AI已批改 {{ totalAiSuccess }}</view>
      </view>
      <view class="kpi-card purple fx-fade-up fx-delay-4">
        <view class="kpi-title">班级学生</view>
        <view class="kpi-value">{{ totalStudents }}</view>
        <view class="kpi-meta">活跃学生</view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-1">
      <view class="section-head">
        <view class="ui-card-title">班级提交统计</view>
        <view class="section-mini">平均完成率：{{ averageCompletionRate }}%</view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseStatsTop.length" class="ui-empty">{{ loadError || '暂无班级数据' }}</view>
      <view v-else class="class-list">
        <button
          v-for="item in courseStatsTop"
          :key="item.courseId"
          class="class-row"
          @click="goCourse(item.courseId, item.courseName)"
        >
          <view class="class-main">
            <view class="class-name">{{ item.courseName }}</view>
            <view class="class-meta">{{ item.students }} 人 · 已提交 {{ item.submitted }} 份</view>
          </view>
          <view class="class-rate">{{ item.completionRate }}%</view>
        </button>
      </view>
    </view>

    <view class="dashboard-grid">
      <view class="ui-card section-card fx-fade-up fx-delay-2">
        <view class="section-head">
          <view class="ui-card-title">作业状态分布</view>
        </view>
        <view class="status-wrap">
          <view class="status-donut" :style="statusDonutStyle">
            <view class="status-center">{{ totalAssignments }}</view>
          </view>
          <view class="status-legend">
            <view class="legend-item"><text class="dot dot-open" /> 发布中 {{ statusRates.open }}%</view>
            <view class="legend-item"><text class="dot dot-closed" /> 已结束 {{ statusRates.closed }}%</view>
            <view class="legend-item"><text class="dot dot-draft" /> 草稿 {{ statusRates.draft }}%</view>
          </view>
        </view>
      </view>

      <view class="ui-card section-card fx-fade-up fx-delay-3">
        <view class="section-head">
          <view class="ui-card-title">AI批改统计</view>
        </view>
        <view class="mini-grid">
          <view class="mini-card">
            <view class="mini-label">累计批改</view>
            <view class="mini-value">{{ totalSubmitted }}</view>
          </view>
          <view class="mini-card">
            <view class="mini-label">AI成功</view>
            <view class="mini-value good">{{ totalAiSuccess }}</view>
          </view>
          <view class="mini-card">
            <view class="mini-label">AI失败</view>
            <view class="mini-value bad">{{ totalAiFailed }}</view>
          </view>
          <view class="mini-card">
            <view class="mini-label">等待批改</view>
            <view class="mini-value warn">{{ totalPending }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-3">
      <view class="section-head">
        <view class="ui-card-title">作业完成分析</view>
      </view>
      <view class="mini-grid">
        <view class="mini-card">
          <view class="mini-label">整体完成率</view>
          <view class="mini-value">{{ overallCompletionRate }}%</view>
        </view>
        <view class="mini-card">
          <view class="mini-label">已提交占比</view>
          <view class="mini-value good">{{ submittedRate }}%</view>
        </view>
        <view class="mini-card">
          <view class="mini-label">待批改占比</view>
          <view class="mini-value warn">{{ pendingRate }}%</view>
        </view>
        <view class="mini-card">
          <view class="mini-label">未提交占比</view>
          <view class="mini-value bad">{{ unsubmittedRate }}%</view>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-4">
      <view class="section-head">
        <view class="ui-card-title">我的作业管理</view>
      </view>
      <view v-if="!assignmentRowsTop.length" class="ui-empty">{{ loadError || '暂无作业数据' }}</view>
      <view v-else class="task-list">
        <view v-for="item in assignmentRowsTop" :key="item.id" class="task-item">
          <view class="task-main">
            <view class="task-title">{{ item.title }}</view>
            <view class="task-meta">{{ item.courseName }} · 提交率 {{ item.submissionRate }}%</view>
            <view class="task-meta">截止 {{ item.deadlineText }}</view>
          </view>
          <view class="task-right">
            <text class="status-pill" :class="item.statusClass">{{ item.statusText }}</text>
            <button class="ui-btn-soft slim-btn" @click="goCourse(item.courseId, item.courseName)">进入课程</button>
          </view>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-4">
      <view class="section-head">
        <view class="ui-card-title">待处理提交</view>
      </view>
      <view v-if="!pendingRowsTop.length" class="ui-empty">当前没有待处理提交</view>
      <view v-else class="task-list">
        <view v-for="item in pendingRowsTop" :key="item.id" class="task-item">
          <view class="task-main">
            <view class="task-title">{{ item.courseName }} · {{ item.title }}</view>
            <view class="task-meta">待批改 {{ item.pendingCount }} · 未提交 {{ item.unsubmittedCount }}</view>
          </view>
          <button class="ui-btn-primary slim-btn" @click="goCourse(item.courseId, item.courseName)">去处理</button>
        </view>
      </view>
    </view>

    <TeacherBottomNav active="home" />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listTeacherAssignments } from '../../api/assignment'
import { listTeacherCourses } from '../../api/course'
import { clearAuth, getUser, requireTeacher } from '../../utils/storage'
import { replacePage } from '../../utils/navigation'
import TeacherBottomNav from '../../components/TeacherBottomNav.vue'

const loading = ref(false)
const loadError = ref('')
const courses = ref([])
const assignments = ref([])
const currentUser = ref(getUser() || {})

const profileName = computed(
  () => currentUser.value?.realName || currentUser.value?.name || currentUser.value?.username || '教师',
)

const profileAccount = computed(
  () =>
    currentUser.value?.teacherNumber ||
    currentUser.value?.account ||
    currentUser.value?.username ||
    '教师账号',
)

const profileInitial = computed(() => String(profileName.value || '教').trim().slice(0, 1))

const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

const safeRound = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatDeadline(deadline) {
  if (!deadline) return '未设置'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${hh}:${mm}`
}

function mapStatusText(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'OPEN') return '发布中'
  if (normalized === 'CLOSED') return '已结束'
  return '草稿'
}

const gradingList = computed(() =>
  (assignments.value || []).map((item) => {
    const studentCount = Number(item.studentCount ?? 0)
    const submittedCount = Number(item.submittedStudentCount ?? item.submissionCount ?? 0)
    const pendingCount = Number(item.pendingStudentCount ?? item.pendingCount ?? 0)
    const unsubmittedCount = Number(item.unsubmittedCount ?? 0)
    const aiSuccessCount = Number(item.aiSuccessCount ?? 0)
    const aiFailedCount = Number(item.aiFailedCount ?? 0)

    return {
      id: item.id,
      title: item.title || '未命名作业',
      courseId: item.courseId,
      courseName: item.courseName || item.courseId || '课程',
      status: String(item.status || 'DRAFT').toUpperCase(),
      statusText: mapStatusText(item.status || 'DRAFT'),
      statusClass:
        String(item.status || '').toUpperCase() === 'OPEN'
          ? 'is-open'
          : String(item.status || '').toUpperCase() === 'CLOSED'
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
      submissionRate: clampPercent(studentCount > 0 ? (submittedCount / studentCount) * 100 : 0),
    }
  }),
)

const courseStats = computed(() => {
  const map = new Map()

  ;(courses.value || []).forEach((course) => {
    map.set(course.id, {
      courseId: course.id,
      courseName: course.name || course.id,
      students: 0,
      submitted: 0,
      assignmentCount: 0,
      completionRate: 0,
    })
  })

  gradingList.value.forEach((item) => {
    if (!item.courseId) return
    if (!map.has(item.courseId)) {
      map.set(item.courseId, {
        courseId: item.courseId,
        courseName: item.courseName,
        students: 0,
        submitted: 0,
        assignmentCount: 0,
        completionRate: 0,
      })
    }

    const exist = map.get(item.courseId)
    exist.assignmentCount += 1
    exist.students = Math.max(exist.students, item.studentCount)
    exist.submitted += item.submittedCount
  })

  return Array.from(map.values()).map((item) => {
    const base = item.students * item.assignmentCount
    return {
      ...item,
      completionRate: clampPercent(base > 0 ? safeRound((item.submitted / base) * 100) : 0),
    }
  })
})

const totalAssignments = computed(() => gradingList.value.length)
const totalCourses = computed(() => {
  if (courses.value.length) return courses.value.length
  return new Set(gradingList.value.map((item) => item.courseId).filter(Boolean)).size
})
const totalPending = computed(() => gradingList.value.reduce((acc, item) => acc + item.pendingCount, 0))
const totalAiSuccess = computed(() => gradingList.value.reduce((acc, item) => acc + item.aiSuccessCount, 0))
const totalAiFailed = computed(() => gradingList.value.reduce((acc, item) => acc + item.aiFailedCount, 0))
const totalSubmitted = computed(() => gradingList.value.reduce((acc, item) => acc + item.submittedCount, 0))
const totalUnsubmitted = computed(() =>
  gradingList.value.reduce((acc, item) => acc + item.unsubmittedCount, 0),
)
const totalStudents = computed(() => courseStats.value.reduce((acc, item) => acc + item.students, 0))

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

const statusDonutStyle = computed(() => {
  const open = statusRates.value.open
  const closed = statusRates.value.closed
  const split1 = open
  const split2 = open + closed
  return {
    background: `conic-gradient(#1f87f0 0% ${split1}%, #ff6a56 ${split1}% ${split2}%, #8a95aa ${split2}% 100%)`,
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

onMounted(async () => {
  if (!requireTeacher()) return
  currentUser.value = getUser() || {}
  await fetchDashboardData()
})

async function fetchDashboardData() {
  loading.value = true
  loadError.value = ''
  try {
    const [courseItems, assignmentItems] = await Promise.all([
      listTeacherCourses(),
      listTeacherAssignments(),
    ])
    courses.value = courseItems || []
    assignments.value = assignmentItems || []
  } catch (err) {
    loadError.value = err?.message || '数据加载失败'
    uni.showToast({ title: loadError.value, icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goCourse(courseId, courseName = '') {
  if (!courseId) return
  uni.navigateTo({
    url: `/pages/teacher/courses?courseId=${courseId}&courseName=${encodeURIComponent(courseName)}`,
  })
}

function logout() {
  clearAuth()
  replacePage('/pages/login/index')
}
</script>

<style scoped>
.header-compact {
  justify-content: space-between;
}

.profile-left {
  flex: 0 1 360rpx;
  max-width: 360rpx;
}

.logout-btn {
  height: 62rpx;
  line-height: 62rpx;
  min-width: 138rpx;
  padding: 0 20rpx;
  font-size: 22rpx;
  white-space: nowrap;
  flex-shrink: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.kpi-card {
  border-radius: 20rpx;
  padding: 20rpx;
  color: #fff;
  box-shadow: 0 10rpx 22rpx rgba(37, 53, 89, 0.16);
}

.kpi-card.blue {
  background: linear-gradient(135deg, #1f87f0, #43b2f1);
}

.kpi-card.green {
  background: linear-gradient(135deg, #25b85f, #35ce6f);
}

.kpi-card.amber {
  background: linear-gradient(135deg, #f4ab00, #ffbe1b);
}

.kpi-card.purple {
  background: linear-gradient(135deg, #9a53db, #c26ce2);
}

.kpi-title {
  font-size: 23rpx;
  opacity: 0.95;
}

.kpi-value {
  margin-top: 8rpx;
  font-size: 52rpx;
  line-height: 1.06;
  font-weight: 800;
}

.kpi-meta {
  margin-top: 6rpx;
  font-size: 21rpx;
  opacity: 0.92;
}

.section-card {
  padding: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
  gap: 12rpx;
}

.section-mini {
  color: rgba(26, 36, 64, 0.55);
  font-size: 22rpx;
}

.class-list,
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.class-row {
  margin: 0;
  border: none;
  border-radius: 16rpx;
  background: rgba(240, 247, 255, 0.82);
  padding: 14rpx 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12rpx;
}

.class-row::after {
  border: none;
}

.class-main {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.class-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2440;
}

.class-meta,
.task-meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(26, 36, 64, 0.58);
}

.class-rate {
  width: 84rpx;
  height: 84rpx;
  border-radius: 42rpx;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #21a360;
  font-size: 22rpx;
  font-weight: 700;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.status-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.status-donut {
  width: 200rpx;
  height: 200rpx;
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-center {
  width: 130rpx;
  height: 130rpx;
  border-radius: 65rpx;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  font-weight: 700;
  color: #1d3d68;
}

.status-legend {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: rgba(26, 36, 64, 0.62);
}

.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 7rpx;
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

.mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.mini-card {
  border-radius: 14rpx;
  border: 2rpx solid #e1e7f4;
  background: #f9fbff;
  padding: 14rpx;
}

.mini-label {
  font-size: 21rpx;
  color: rgba(26, 36, 64, 0.56);
}

.mini-value {
  margin-top: 8rpx;
  font-size: 36rpx;
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

.task-item {
  border-radius: 16rpx;
  border: 2rpx solid #e1e7f4;
  background: #f9fbff;
  padding: 16rpx;
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  align-items: center;
}

.task-main {
  min-width: 0;
  flex: 1;
}

.task-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2440;
}

.task-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
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

.slim-btn {
  height: 54rpx;
  line-height: 54rpx;
  border-radius: 12rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}
</style>
