<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card">
      <view class="ui-header-main">
        <view class="ui-title">成绩看板</view>
        <view class="ui-subtitle">{{ isCourseMode ? `课程：${courseName}` : '按课程查看成绩' }}</view>
      </view>
      <button v-if="isCourseMode" class="ui-btn-ghost back-btn" @click="goBack">返回</button>
      <view v-else class="ui-chip blue">{{ courseCards.length }} 门</view>
    </view>

    <view class="ui-card section-card" v-if="!isCourseMode">
      <view class="section-head">
        <view class="ui-card-title">课程列表</view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!courseCards.length" class="ui-empty">暂无成绩</view>
      <view v-else class="score-list">
        <view v-for="course in courseCards" :key="course.id" class="score-item">
          <view class="left">
            <view class="name">{{ course.name }}</view>
            <view class="meta">作业 {{ course.total }} 份 · 可见成绩 {{ course.viewable }} 份</view>
          </view>
          <button class="ui-btn-primary action-btn" @click="openCourse(course)">查看成绩</button>
        </view>
      </view>
    </view>

    <view class="ui-card section-card" v-else>
      <view class="section-head">
        <view class="ui-card-title">课程成绩</view>
        <view class="ui-chip orange">{{ rows.length }} 份</view>
      </view>

      <view v-if="loading" class="ui-empty">加载中...</view>
      <view v-else-if="!rows.length" class="ui-empty">暂无成绩</view>
      <view v-else class="score-list">
        <view v-for="row in rows" :key="row.assignmentId" class="score-item">
          <view class="left">
            <view class="name">{{ row.assignmentTitle }}</view>
            <view class="meta">状态：{{ row.totalScore == null ? '不可见/待发布' : '已发布' }}</view>
          </view>
          <view class="right">
            <view class="value">{{ row.totalScore == null ? '--' : `${row.totalScore}` }}</view>
            <button
              class="ui-btn-primary action-btn"
              :class="{ disabled: row.totalScore == null }"
              :disabled="row.totalScore == null"
              @click="goDetail(row.assignmentId)"
            >
              查看详情
            </button>
          </view>
        </view>
      </view>
    </view>

    <StudentBottomNav active="mine" />
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listMyScores } from '../../api/score'
import { listAllAssignments } from '../../api/assignment'
import { requireStudent } from '../../utils/storage'
import StudentBottomNav from '../../components/StudentBottomNav.vue'

const loading = ref(false)
const rows = ref([])
const scoreItems = ref([])
const assignmentItems = ref([])
const courseId = ref('')
const courseName = ref('')

const isCourseMode = computed(() => Boolean(courseId.value))

const courseCards = computed(() => {
  const map = new Map()
  ;(assignmentItems.value || []).forEach((item) => {
    const id = item.courseId
    if (!id) return
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: item.courseName || id,
        total: 0,
        viewable: 0,
      })
    }
    const row = map.get(id)
    row.total += 1
    if (item.allowViewScore !== false) {
      row.viewable += 1
    }
  })

  ;(scoreItems.value || []).forEach((item) => {
    const id = item.courseId
    if (!id) return
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: item.courseName || id,
        total: 0,
        viewable: 0,
      })
    }
    const row = map.get(id)
    if (row.total === 0) row.total += 1
    if (item.status === 'GRADED') row.viewable += 1
  })

  return Array.from(map.values())
})

onMounted(async () => {
  if (!requireStudent()) return
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  courseId.value = current?.options?.courseId || ''
  courseName.value = decodeURIComponent(current?.options?.courseName || '')
  await fetchScores()
})

async function fetchScores() {
  loading.value = true
  try {
    const [scoreRows, assignmentRows] = await Promise.all([
      listMyScores(),
      listAllAssignments(),
    ])
    scoreItems.value = scoreRows || []
    assignmentItems.value = assignmentRows || []

    rows.value = (scoreRows || []).filter((it) => !courseId.value || it.courseId === courseId.value)
  } catch (err) {
    uni.showToast({ title: err.message || '成绩加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openCourse(course) {
  uni.navigateTo({
    url: `/pages/student/scores?courseId=${course.id}&courseName=${encodeURIComponent(course.name)}`,
  })
}

function goDetail(assignmentId) {
  uni.navigateTo({ url: `/pages/student/score-detail?assignmentId=${assignmentId}` })
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

.section-card {
  padding: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.score-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.score-item {
  border-radius: 18rpx;
  border: 2rpx solid #e1e7f4;
  background: #f9fbff;
  padding: 18rpx;
  display: flex;
  justify-content: space-between;
  gap: 14rpx;
  align-items: center;
}

.left {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2440;
}

.meta {
  margin-top: 8rpx;
  color: rgba(26, 36, 64, 0.56);
  font-size: 24rpx;
}

.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}

.value {
  font-size: 38rpx;
  font-weight: 700;
  color: #264b97;
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
