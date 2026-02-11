<template>
  <StudentLayout
    title="成绩详情"
    subtitle="最终成绩与评分明细"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="成绩看板"
  >
    <section class="panel glass">
      <div class="panel-title">作业信息</div>
      <div class="detail-row">
        <div class="detail-label">作业</div>
        <div class="detail-value">{{ result?.assignmentTitle || '—' }}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">课程</div>
        <div class="detail-value">{{ result?.courseName || result?.courseId || '—' }}</div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">最终成绩</div>
      <div v-if="loading" class="grade-empty">加载中...</div>
      <div v-else-if="error" class="grade-empty">{{ error }}</div>
      <div v-else class="detail-body">
        <div class="detail-row">
          <div class="detail-label">总分</div>
          <div class="detail-value">{{ result?.weightedScore ?? '-' }} / {{ result?.totalScore ?? '-' }}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">题目明细</div>
          <div v-if="!result?.questions?.length" class="empty-box">暂无明细</div>
          <div v-else class="detail-items">
            <div v-for="(item, idx) in result.questions" :key="idx" class="detail-item">
              <div class="detail-item-title">
                第 {{ item.questionIndex }} 题（权重 {{ item.weight }}%）
              </div>
              <div class="detail-item-meta">
                得分 {{ item.score ?? '-' }} / {{ item.maxScore ?? '-' }}
              </div>
              <div v-if="item.promptText" class="detail-text" v-mathjax v-html="renderMath(item.promptText)" />
              <div v-if="item.items?.length" class="detail-sub">
                <div v-for="(sub, subIdx) in item.items" :key="subIdx" class="detail-sub-item">
                  <div>评分项 {{ sub.rubricItemKey || '-' }}</div>
                  <div>得分 {{ sub.score ?? '-' }}</div>
                  <div v-if="sub.reason" class="detail-text" v-mathjax v-html="renderMath(sub.reason)" />
                </div>
              </div>
              <div v-if="item.finalComment" class="detail-text" v-mathjax v-html="renderMath(item.finalComment)" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </StudentLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StudentLayout from '../components/StudentLayout.vue'
import { useStudentProfile } from '../composables/useStudentProfile'
import { getAssignmentScoreDetail } from '../api/score'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()
const route = useRoute()

const loading = ref(true)
const error = ref('')
const result = ref<any | null>(null)

const assignmentId = computed(() => String(route.params.assignmentId ?? ''))

const renderMath = (text?: string | null) => {
  if (!text) return '—'
  return text.replace(/\n/g, '<br />')
}

onMounted(async () => {
  await refreshProfile()
  if (!assignmentId.value) {
    error.value = '缺少提交信息'
    loading.value = false
    return
  }
  try {
    result.value = await getAssignmentScoreDetail(assignmentId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-body {
  display: grid;
  gap: 16px;
}

.detail-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
}

.detail-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.detail-value {
  font-weight: 600;
}

.detail-block {
  display: grid;
  gap: 8px;
}

.detail-text {
  white-space: pre-wrap;
  font-size: 13px;
}

.detail-items {
  display: grid;
  gap: 10px;
}

.detail-sub {
  display: grid;
  gap: 8px;
}

.detail-sub-item {
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.detail-item {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: grid;
  gap: 6px;
}

.detail-item-title {
  font-weight: 600;
}

.detail-item-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.empty-box {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  color: rgba(26, 29, 51, 0.6);
}
</style>
