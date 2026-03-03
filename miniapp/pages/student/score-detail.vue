<template>
  <view class="page ui-shell">
    <view class="ui-card ui-header-card">
      <view class="ui-header-main">
        <view class="ui-title">成绩详情</view>
        <view class="ui-subtitle">{{ detail.assignmentTitle || '作业' }}</view>
      </view>
      <button class="ui-btn-ghost back-btn" @click="goBack">返回</button>
    </view>

    <view class="ui-card section-card" v-if="loading">
      <view class="ui-empty">加载中...</view>
    </view>

    <view class="ui-card section-card" v-else>
      <view class="summary-grid">
        <view class="summary-item">
          <view class="summary-label">总分</view>
          <view class="summary-value">{{ detail.totalScore == null ? '--' : detail.totalScore }}</view>
        </view>
        <view class="summary-item">
          <view class="summary-label">作业满分</view>
          <view class="summary-value">{{ detail.weightedScore == null ? '--' : detail.weightedScore }}</view>
        </view>
      </view>

      <view class="question-list">
        <view v-for="q in detail.questions || []" :key="`${q.questionIndex}-${q.questionId || ''}`" class="question-item">
          <view class="question-top">
            <view class="question-title">第{{ q.questionIndex }}题</view>
            <view class="question-score">{{ q.score == null ? '--' : q.score }} / {{ q.maxScore }}</view>
          </view>
          <view class="question-reason" v-if="q.finalComment || q.reason">{{ q.finalComment || q.reason }}</view>
        </view>
      </view>
    </view>

    <StudentBottomNav active="mine" />
  </view>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getMyScoreDetail } from '../../api/score'
import { requireStudent } from '../../utils/storage'
import StudentBottomNav from '../../components/StudentBottomNav.vue'

const assignmentId = ref('')
const loading = ref(false)
const detail = ref({ questions: [] })

onMounted(async () => {
  if (!requireStudent()) return
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  assignmentId.value = current?.options?.assignmentId || ''
  await fetchDetail()
})

async function fetchDetail() {
  loading.value = true
  try {
    detail.value = await getMyScoreDetail(assignmentId.value)
  } catch (err) {
    uni.showToast({ title: err.message || '详情加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.summary-item {
  border-radius: 16rpx;
  border: 2rpx solid #e1e8f5;
  background: #f9fbff;
  padding: 16rpx;
}

.summary-label {
  color: rgba(26, 36, 64, 0.56);
  font-size: 24rpx;
}

.summary-value {
  margin-top: 6rpx;
  font-size: 42rpx;
  font-weight: 700;
  color: #244a95;
}

.question-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.question-item {
  border-radius: 16rpx;
  border: 2rpx solid #e1e8f5;
  background: #fff;
  padding: 16rpx;
}

.question-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.question-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2440;
}

.question-score {
  font-size: 26rpx;
  font-weight: 700;
  color: #2e5ab5;
}

.question-reason {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.6);
  line-height: 1.52;
}
</style>
