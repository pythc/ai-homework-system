<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card">
      <view class="ui-header-main">
        <view class="ui-title">作业库</view>
        <view class="ui-subtitle">{{ isCourseMode ? `课程：${courseName}` : '按课程查看作业' }}</view>
      </view>
      <button v-if="isCourseMode" class="ui-btn-ghost back-btn" @click="goBack">返回</button>
      <view v-else class="ui-chip orange count-chip">{{ courseCards.length }} 门</view>
    </view>

    <view class="ui-card section-card" v-if="!isCourseMode">
      <view class="section-head">
        <view class="ui-card-title">课程列表</view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseCards.length" class="ui-empty">暂无作业</view>
      <view v-else class="course-list">
        <view v-for="course in courseCards" :key="course.id" class="course-item">
          <view class="course-main">
            <view class="course-name">{{ course.name }}</view>
            <view class="course-meta">作业 {{ course.total }} 份</view>
            <view class="chip-row">
              <text class="ui-chip blue">进行中 {{ course.open }}</text>
              <text class="ui-chip orange">已截止 {{ course.closed }}</text>
              <text class="ui-chip gray">已归档 {{ course.archived }}</text>
            </view>
          </view>
          <button class="ui-btn-primary action-btn" @click="openCourse(course)">进入作业</button>
        </view>
      </view>
    </view>

    <view class="ui-card section-card" v-else>
      <view class="section-head">
        <view class="ui-card-title">课程作业</view>
        <view class="ui-chip orange">{{ assignments.length }} 份</view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!assignments.length" class="ui-empty">暂无作业</view>
      <view v-else class="assignment-list">
        <view v-for="item in assignments" :key="item.id || item.assignmentId" class="assignment-item">
          <view class="assignment-main">
            <view class="assignment-name">{{ item.title }}</view>
            <view class="assignment-meta">状态：{{ statusLabel(item) }}</view>
            <view class="assignment-deadline">截止 {{ formatDateTime(item.deadline) }}</view>
          </view>
          <button
            class="ui-btn-primary action-btn"
            :class="{ disabled: isDisabled(item) }"
            :disabled="isDisabled(item)"
            @click="openAssignment(item)"
          >
            {{ actionLabel(item) }}
          </button>
        </view>
      </view>
    </view>

    <StudentBottomNav active="assignments" />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listAllAssignments } from '../../api/assignment'
import { formatDateTime } from '../../utils/time'
import { requireStudent } from '../../utils/storage'
import StudentBottomNav from '../../components/StudentBottomNav.vue'

const loading = ref(false)
const assignments = ref([])
const allAssignments = ref([])
const courseId = ref('')
const courseName = ref('')

const isCourseMode = computed(() => Boolean(courseId.value))

const courseCards = computed(() => {
  const map = new Map()
  ;(allAssignments.value || []).forEach((item) => {
    const id = item.courseId
    if (!id) return
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: item.courseName || id,
        total: 0,
        open: 0,
        closed: 0,
        archived: 0,
      })
    }
    const row = map.get(id)
    row.total += 1
    if (item.status === 'OPEN') row.open += 1
    else if (item.status === 'CLOSED') row.closed += 1
    else row.archived += 1
  })
  return Array.from(map.values())
})

onMounted(async () => {
  if (!requireStudent()) return
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  courseId.value = current?.options?.courseId || ''
  courseName.value = decodeURIComponent(current?.options?.courseName || '')
  await fetchAssignments()
})

async function fetchAssignments() {
  loading.value = true
  try {
    const items = await listAllAssignments()
    allAssignments.value = items || []
    assignments.value = (items || [])
      .filter((it) => !courseId.value || it.courseId === courseId.value)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  } catch (err) {
    uni.showToast({ title: err.message || '作业加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openCourse(course) {
  uni.navigateTo({
    url: `/pages/student/assignments?courseId=${course.id}&courseName=${encodeURIComponent(course.name)}`,
  })
}

function actionLabel(item) {
  return item.submitted ? '查看/修改作业' : '去提交作业'
}

function statusLabel(item) {
  if (item.status === 'HIDDEN') return '教师设置暂不可见'
  if (item.submitted) return '已提交'
  if (item.status === 'OPEN') return '待提交'
  if (item.status === 'CLOSED') return '已截止'
  return '已归档'
}

function isDisabled(item) {
  return item.status === 'HIDDEN'
}

function openAssignment(item) {
  const id = item.id || item.assignmentId
  uni.navigateTo({
    url: `/pages/student/submit?assignmentId=${id}&courseName=${encodeURIComponent(courseName.value || item.courseName || '')}`,
  })
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

.count-chip {
  margin-left: auto;
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

.course-list,
.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.course-item,
.assignment-item {
  border-radius: 18rpx;
  border: 2rpx solid #e1e7f4;
  background: #f9fbff;
  padding: 18rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12rpx;
}

.course-main,
.assignment-main {
  flex: 1;
  min-width: 0;
}

.course-name,
.assignment-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2440;
}

.course-meta,
.assignment-meta {
  margin-top: 6rpx;
  font-size: 23rpx;
  color: rgba(26, 36, 64, 0.56);
}

.chip-row {
  margin-top: 10rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.assignment-deadline {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #e77d45;
}

.action-btn {
  height: 62rpx;
  line-height: 62rpx;
  border-radius: 14rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}

.action-btn.disabled {
  background: #b8c5df;
  color: rgba(255, 255, 255, 0.82);
  box-shadow: none;
}
</style>
