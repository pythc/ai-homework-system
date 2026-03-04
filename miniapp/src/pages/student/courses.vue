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
        <view class="kpi-title">我的课程</view>
        <view class="kpi-value">{{ totalCourses }}</view>
        <view class="kpi-meta">进行中课程</view>
      </view>
      <view class="kpi-card green fx-fade-up fx-delay-2">
        <view class="kpi-title">未截止作业</view>
        <view class="kpi-value">{{ openAssignmentCount }}</view>
        <view class="kpi-meta">当前任务池</view>
      </view>
      <view class="kpi-card amber fx-fade-up fx-delay-3">
        <view class="kpi-title">待提交</view>
        <view class="kpi-value">{{ pendingCount }}</view>
        <view class="kpi-meta">尽快完成</view>
      </view>
      <view class="kpi-card purple fx-fade-up fx-delay-4">
        <view class="kpi-title">已出分</view>
        <view class="kpi-value">{{ gradedCount }}</view>
        <view class="kpi-meta">可查看成绩</view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-2">
      <view class="section-head">
        <view class="ui-card-title">待提交作业</view>
        <button class="ui-btn-soft slim-btn" @click="goAssignments">查看全部</button>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!pendingTasks.length" class="ui-empty">当前没有紧急截止作业</view>
      <view v-else class="task-list">
        <view v-for="task in pendingTasks" :key="task.id" class="task-item fx-scale-in">
          <view class="task-main">
            <view class="task-title">{{ task.title }}</view>
            <view class="task-meta">{{ task.course }} · {{ task.deadlineText }}</view>
          </view>
          <button class="ui-btn-primary action-btn" @click="goSubmit(task.id)">去提交</button>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-3">
      <view class="section-head">
        <view class="ui-card-title">成绩概览</view>
        <button class="ui-btn-soft slim-btn" @click="goScores">查看详情</button>
      </view>

      <view class="mini-grid">
        <view class="mini-card fx-fade-up fx-delay-1">
          <view class="mini-label">已出分作业</view>
          <view class="mini-value">{{ gradedCount }}</view>
        </view>
        <view class="mini-card fx-fade-up fx-delay-2">
          <view class="mini-label">平均分</view>
          <view class="mini-value good">{{ averageScore }}</view>
        </view>
        <view class="mini-card fx-fade-up fx-delay-3">
          <view class="mini-label">最高分</view>
          <view class="mini-value">{{ bestScore }}</view>
        </view>
        <view class="mini-card fx-fade-up fx-delay-4">
          <view class="mini-label">最近得分</view>
          <view class="mini-value warn">{{ latestScore }}</view>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-4">
      <view class="section-head">
        <view class="ui-card-title">我的课程</view>
        <button class="ui-btn-soft slim-btn" @click="goScores">成绩看板</button>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseCards.length" class="ui-empty">暂无课程</view>
      <view v-else class="course-list">
        <view v-for="item in courseCards" :key="item.id" class="course-item fx-scale-in">
          <view class="course-main">
            <view class="course-name">{{ item.name }}</view>
            <view class="course-meta">作业 {{ item.assignmentCount }} 份 · 已出分 {{ item.gradedCount }} 份</view>
          </view>
          <view class="course-actions">
            <button class="ui-btn-primary action-btn" @click="goAssignmentsByCourse(item)">进入作业</button>
            <button class="ui-btn-ghost action-btn ghost-alt" @click="goScoresByCourse(item)">查看成绩</button>
          </view>
        </view>
      </view>
    </view>

    <StudentBottomNav active="mine" />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listAllAssignments } from '../../api/assignment'
import { listMyScores } from '../../api/score'
import { clearAuth, getUser, requireStudent } from '../../utils/storage'
import StudentBottomNav from '../../components/StudentBottomNav.vue'
import { replacePage } from '../../utils/navigation'

const loading = ref(false)
const assignmentItems = ref([])
const scoreItems = ref([])
const currentUser = ref(getUser() || {})

const nowTs = () => Date.now()

const courseCards = computed(() => {
  const map = new Map()

  ;(assignmentItems.value || []).forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        id: courseId,
        name: item.courseName || courseId,
        assignmentCount: 0,
        gradedCount: 0,
      })
    }
    map.get(courseId).assignmentCount += 1
  })

  ;(scoreItems.value || []).forEach((item) => {
    const courseId = item.courseId
    if (!courseId) return
    if (!map.has(courseId)) {
      map.set(courseId, {
        id: courseId,
        name: item.courseName || courseId,
        assignmentCount: 0,
        gradedCount: 0,
      })
    }
    if (item.totalScore != null || item.status === 'GRADED') {
      map.get(courseId).gradedCount += 1
    }
  })

  return Array.from(map.values())
})

function parseDeadlineTs(deadline) {
  if (!deadline) return Number.POSITIVE_INFINITY
  const ts = new Date(deadline).getTime()
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY
  return ts
}

function formatDeadline(deadline) {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `截止 ${y}/${m}/${d} ${hh}:${mm}`
}

const openAssignments = computed(() =>
  (assignmentItems.value || []).filter((item) => {
    if (String(item.status || '').toUpperCase() !== 'OPEN') return false
    const deadlineTs = parseDeadlineTs(item.deadline)
    return deadlineTs > nowTs()
  }),
)

const pendingAssignments = computed(() =>
  openAssignments.value.filter((item) => !item.submitted),
)

const pendingTasks = computed(() =>
  [...pendingAssignments.value]
    .map((item) => ({
      id: item.id || item.assignmentId,
      title: item.title,
      course: item.courseName || item.courseId,
      deadlineTs: parseDeadlineTs(item.deadline),
      deadlineText: formatDeadline(item.deadline),
    }))
    .sort((a, b) => a.deadlineTs - b.deadlineTs)
    .slice(0, 4),
)

const totalCourses = computed(() => courseCards.value.length)
const openAssignmentCount = computed(() => openAssignments.value.length)
const pendingCount = computed(() => pendingAssignments.value.length)
const gradedCount = computed(() =>
  (scoreItems.value || []).filter((item) => item.totalScore != null || item.status === 'GRADED').length,
)

const profileName = computed(() =>
  currentUser.value?.realName || currentUser.value?.name || currentUser.value?.username || '同学',
)

const profileAccount = computed(() =>
  currentUser.value?.studentNumber || currentUser.value?.account || currentUser.value?.username || '学生账号',
)

const profileInitial = computed(() => String(profileName.value || '同').trim().slice(0, 1))

const gradedScoreValues = computed(() =>
  (scoreItems.value || [])
    .filter((item) => item.totalScore != null || item.status === 'GRADED')
    .map((item) => Number(item.totalScore))
    .filter((item) => Number.isFinite(item)),
)

const averageScore = computed(() => {
  if (!gradedScoreValues.value.length) return '--'
  const total = gradedScoreValues.value.reduce((sum, item) => sum + item, 0)
  const avg = Math.round((total / gradedScoreValues.value.length) * 10) / 10
  return String(avg)
})

const bestScore = computed(() => {
  if (!gradedScoreValues.value.length) return '--'
  return String(Math.max(...gradedScoreValues.value))
})

const latestScore = computed(() => {
  const latest = [...(scoreItems.value || [])]
    .filter((item) => item.totalScore != null || item.status === 'GRADED')
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0]
  if (!latest || latest.totalScore == null) return '--'
  return String(latest.totalScore)
})

onMounted(async () => {
  if (!requireStudent()) return
  currentUser.value = getUser() || {}
  await fetchDashboardData()
})

async function fetchDashboardData() {
  loading.value = true
  try {
    const [assignments, scores] = await Promise.all([
      listAllAssignments(),
      listMyScores(),
    ])
    assignmentItems.value = assignments || []
    scoreItems.value = scores || []
  } catch (err) {
    uni.showToast({ title: err?.message || '数据加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goSubmit(assignmentId) {
  if (!assignmentId) return
  uni.navigateTo({
    url: `/pages/student/submit?assignmentId=${assignmentId}`,
  })
}

function goAssignments() {
  uni.navigateTo({ url: '/pages/student/assignments' })
}

function goScores() {
  uni.navigateTo({ url: '/pages/student/scores' })
}

function goAssignmentsByCourse(course) {
  uni.navigateTo({
    url: `/pages/student/assignments?courseId=${course.id}&courseName=${encodeURIComponent(course.name)}`,
  })
}

function goScoresByCourse(course) {
  uni.navigateTo({
    url: `/pages/student/scores?courseId=${course.id}&courseName=${encodeURIComponent(course.name)}`,
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
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:active {
  transform: translateY(2rpx) scale(0.992);
  box-shadow: 0 8rpx 16rpx rgba(37, 53, 89, 0.12);
}

.kpi-card.blue {
  background: linear-gradient(135deg, #4092ff 0%, #62c3ff 100%);
}

.kpi-card.green {
  background: linear-gradient(135deg, #32bb6e 0%, #4ad58b 100%);
}

.kpi-card.amber {
  background: linear-gradient(135deg, #ffb019 0%, #ffcb53 100%);
}

.kpi-card.purple {
  background: linear-gradient(135deg, #8e6fff 0%, #c172ed 100%);
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
}

.slim-btn {
  height: 52rpx;
  line-height: 52rpx;
  border-radius: 12rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}

.task-list,
.course-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.task-item,
.course-item {
  border-radius: 18rpx;
  background: #f9fbff;
  border: 2rpx solid #e1e7f4;
  padding: 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-item:active,
.course-item:active {
  transform: translateY(2rpx) scale(0.995);
  box-shadow: 0 10rpx 22rpx rgba(33, 56, 98, 0.1);
}

.task-main,
.course-main {
  flex: 1;
  min-width: 0;
}

.task-title,
.course-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2440;
}

.task-meta,
.course-meta {
  margin-top: 6rpx;
  font-size: 23rpx;
  color: rgba(26, 36, 64, 0.55);
}

.course-actions {
  display: flex;
  gap: 10rpx;
}

.action-btn {
  height: 62rpx;
  line-height: 62rpx;
  border-radius: 14rpx;
  padding: 0 18rpx;
  font-size: 23rpx;
}

.ghost-alt {
  background: #fff;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.mini-card {
  border-radius: 16rpx;
  border: 2rpx solid #e1e7f4;
  background: #f9fbff;
  padding: 16rpx;
  transition: transform 0.2s ease;
}

.mini-card:active {
  transform: translateY(1rpx) scale(0.996);
}

.task-list .task-item:nth-child(1),
.course-list .course-item:nth-child(1) {
  animation-delay: 0.04s;
}

.task-list .task-item:nth-child(2),
.course-list .course-item:nth-child(2) {
  animation-delay: 0.08s;
}

.task-list .task-item:nth-child(3),
.course-list .course-item:nth-child(3) {
  animation-delay: 0.12s;
}

.task-list .task-item:nth-child(4),
.course-list .course-item:nth-child(4) {
  animation-delay: 0.16s;
}

.mini-label {
  font-size: 22rpx;
  color: rgba(26, 36, 64, 0.56);
}

.mini-value {
  margin-top: 8rpx;
  font-size: 40rpx;
  line-height: 1.1;
  font-weight: 700;
  color: #1a2440;
}

.mini-value.good {
  color: #1f9f53;
}

.mini-value.warn {
  color: #eb9a11;
}
</style>
