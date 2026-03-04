<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card fx-fade-in">
      <view class="ui-header-main">
        <view class="ui-title">{{ isCourseMode ? '课程作业' : '我的课程' }}</view>
        <view class="ui-subtitle">
          {{ isCourseMode ? `课程：${selectedCourseName || '--'}` : '查看课程列表与概况' }}
        </view>
      </view>
      <button v-if="isCourseMode" class="ui-btn-ghost back-btn" @click="goBack">返回课程</button>
      <view v-else class="ui-chip orange">{{ courseCards.length }} 门</view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-1" v-if="!isCourseMode">
      <view class="section-head">
        <view class="ui-card-title">课程列表</view>
      </view>
      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseCards.length" class="ui-empty">{{ loadError || '暂无课程' }}</view>
      <view v-else class="course-list">
        <view
          v-for="course in courseCards"
          :key="course.id"
          class="course-item"
          @click="openCourse(course)"
        >
          <view class="course-main">
            <view class="course-name">{{ course.name }}</view>
            <view class="course-meta">
              <text>{{ course.semester || '当前学期' }}</text>
              <text class="split-dot">·</text>
              <text class="status-inline" :class="course.statusClass">{{ course.statusText }}</text>
            </view>
          </view>
          <view class="course-enter">
            <text>进入课程</text>
            <text class="course-arrow">→</text>
          </view>
        </view>
      </view>
    </view>

    <view class="ui-card section-card fx-fade-up fx-delay-2" v-else>
      <view class="section-head">
        <view class="ui-card-title">
          作业列表
          <text class="ui-chip orange task-count">{{ courseAssignments.length }} 份</text>
        </view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseAssignments.length" class="ui-empty">当前课程暂无作业</view>
      <view v-else class="task-list">
        <view v-for="task in courseAssignments" :key="task.id" class="task-card">
          <view class="task-head">
            <view>
              <view class="task-title">{{ task.title }}</view>
              <view class="task-sub">{{ task.courseName }}</view>
            </view>
            <view class="task-deadline">{{ task.deadlineText }}</view>
          </view>

          <view class="progress-meta">
            <text class="summary-item pending">待确认 {{ task.pendingCount }} 份</text>
            <text class="summary-divider">·</text>
            <text class="summary-item graded">已批改 {{ task.gradedCount }} 份</text>
            <text class="summary-divider">·</text>
            <text class="summary-item unsubmitted">未提交 {{ task.unsubmittedCount }} 份</text>
            <text class="summary-divider">·</text>
            <text class="summary-item ai-success">AI批改成功 {{ task.aiSuccessCount }} 份</text>
          </view>

          <view class="task-actions">
            <button class="ui-btn-soft action-btn" @click="goAssistant(task.courseName)">去 AI 助手</button>
          </view>
        </view>
      </view>
    </view>

    <TeacherBottomNav active="courses" />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listTeacherAssignments } from '../../api/assignment'
import { listTeacherCourses } from '../../api/course'
import { requireTeacher } from '../../utils/storage'
import TeacherBottomNav from '../../components/TeacherBottomNav.vue'

const loading = ref(false)
const loadError = ref('')
const courses = ref([])
const assignments = ref([])
const courseId = ref('')
const courseName = ref('')

const isCourseMode = computed(() => Boolean(courseId.value))

function normalizeCourseStatus(status) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'
}

const courseCards = computed(() =>
  (courses.value || []).map((course) => {
    const normalized = normalizeCourseStatus(course.status)
    return {
      id: course.id,
      name: course.name || course.id,
      semester: course.semester || '',
      status: normalized,
      statusText: normalized === 'ACTIVE' ? '开放中' : '已结课',
      statusClass: normalized === 'ACTIVE' ? 'active' : 'archived',
    }
  }),
)

const selectedCourseName = computed(() => {
  if (courseName.value) return courseName.value
  return courseCards.value.find((item) => item.id === courseId.value)?.name || ''
})

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

const courseAssignments = computed(() =>
  (assignments.value || [])
    .filter((item) => item.courseId === courseId.value)
    .map((item) => ({
      id: item.id,
      title: item.title || '未命名作业',
      courseName: item.courseName || selectedCourseName.value || item.courseId || '--',
      deadlineText: formatDeadline(item.deadline),
      gradedCount: Number(item.gradedStudentCount ?? item.gradedCount ?? 0),
      pendingCount: Number(item.pendingStudentCount ?? item.pendingCount ?? 0),
      unsubmittedCount: Number(item.unsubmittedCount ?? 0),
      aiSuccessCount: Number(item.aiSuccessCount ?? 0),
      createdAt: item.createdAt ? new Date(item.createdAt).getTime() : 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt),
)

function readOptions() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  courseId.value = current?.options?.courseId || ''
  courseName.value = decodeURIComponent(current?.options?.courseName || '')
}

onMounted(async () => {
  if (!requireTeacher()) return
  readOptions()
  await fetchData()
})

async function fetchData() {
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
    loadError.value = err?.message || '课程加载失败'
    uni.showToast({ title: loadError.value, icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openCourse(course) {
  uni.navigateTo({
    url: `/pages/teacher/courses?courseId=${course.id}&courseName=${encodeURIComponent(course.name || '')}`,
  })
}

function goAssistant(selectedName = '') {
  const query = selectedName ? `?courseName=${encodeURIComponent(selectedName)}` : ''
  uni.navigateTo({ url: `/pages/teacher/assistant${query}` })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: '/pages/teacher/courses' })
}
</script>

<style scoped>
.section-card {
  padding: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.back-btn {
  margin-left: auto;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
}

.task-count {
  margin-left: 10rpx;
}

.course-list,
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.course-item {
  border-radius: 18rpx;
  border: 2rpx solid rgba(169, 187, 218, 0.34);
  background: rgba(255, 255, 255, 0.75);
  padding: 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.course-main {
  min-width: 0;
  flex: 1;
}

.course-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2440;
}

.course-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(26, 36, 64, 0.6);
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.split-dot {
  color: rgba(26, 36, 64, 0.4);
}

.status-inline {
  height: 34rpx;
  line-height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.status-inline.active {
  color: #3b6fe1;
  background: rgba(107, 146, 236, 0.15);
}

.status-inline.archived {
  color: rgba(26, 36, 64, 0.6);
  background: rgba(130, 138, 160, 0.12);
}

.course-enter {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  border: 2rpx solid rgba(145, 166, 204, 0.34);
  background: rgba(255, 255, 255, 0.66);
  color: rgba(26, 36, 64, 0.66);
  font-size: 21rpx;
  font-weight: 600;
}

.course-arrow {
  font-size: 24rpx;
}

.task-card {
  border-radius: 16rpx;
  border: 2rpx solid #dfe7f6;
  background: #f9fbff;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10rpx;
}

.task-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2440;
}

.task-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(26, 36, 64, 0.58);
}

.task-deadline {
  font-size: 21rpx;
  color: #e77d45;
}

.progress-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
  font-size: 21rpx;
  font-weight: 700;
}

.summary-item.pending {
  color: #de8a2b;
}

.summary-item.graded {
  color: #3b6fe1;
}

.summary-item.unsubmitted {
  color: #7f879b;
}

.summary-item.ai-success {
  color: #2f9a67;
}

.summary-divider {
  color: rgba(26, 36, 64, 0.35);
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 12rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}
</style>
