<template>
  <TeacherLayout
    title="个人主页"
    subtitle="批改进度一目了然"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
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

    <section class="overview">
      <div class="stat-card glass stat-card-wide" @click="goGradingOverview">
        <div class="stat-main">
          <div class="stat-label">待批改作业</div>
          <div class="stat-value">{{ ungradedTasks.length }}</div>
          <div class="stat-meta">全部作业 {{ gradingTotal }}</div>
        </div>
        <div class="stat-side">
          <div class="stat-side-item">
            <div class="stat-side-label">已批改</div>
            <div class="stat-side-value">{{ gradedTasks.length }}</div>
          </div>
          <div class="stat-side-item">
            <div class="stat-side-label">未批改</div>
            <div class="stat-side-value">{{ ungradedTasks.length }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel glass">
        <div class="panel-title">
          未批改作业
          <span class="badge">{{ ungradedTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in ungradedTasks" :key="task.id" class="task-card">
            <div class="task-head">
              <div>
                <div class="task-title">{{ task.title }}</div>
                <div class="task-sub">{{ task.course }}</div>
              </div>
              <div class="task-deadline">{{ task.deadline }}</div>
            </div>
            <div class="task-progress">
              <div class="progress-meta">
                <span>{{ task.level }}</span>
              </div>
            </div>
            <button class="task-action" @click="goGrading(task.id)">开始批改</button>
          </div>
          <div v-if="!ungradedTasks.length" class="task-empty">
            {{ gradingError || '暂无未批改作业' }}
          </div>
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-title">
          已批改作业
          <span class="badge">{{ gradedTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in gradedTasks" :key="task.id" class="task-card">
            <div class="task-head">
              <div>
                <div class="task-title">{{ task.title }}</div>
                <div class="task-sub">{{ task.course }}</div>
              </div>
              <div class="task-deadline">{{ task.deadline }}</div>
            </div>
            <div class="task-progress">
              <div class="progress-meta">
                <span>{{ task.level }}</span>
              </div>
            </div>
          </div>
          <div v-if="!gradedTasks.length" class="task-empty">
            {{ gradingError || '暂无已批改作业' }}
          </div>
        </div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">AI 批改结果查询</div>
      <div class="ai-query">
        <input
          v-model="querySubmissionId"
          class="ai-input"
          type="text"
          placeholder="输入 submissionVersionId"
        />
        <button class="task-action" :disabled="aiLoading" @click="loadAiResult">
          {{ aiLoading ? '查询中...' : '查询 AI' }}
        </button>
      </div>
      <div v-if="aiError" class="task-empty">{{ aiError }}</div>

      <div v-if="aiPanel" class="ai-panel">
        <div class="preview-title">学生提交内容</div>
        <div class="preview-text">
          {{ aiPanel.submission?.contentText || '未填写文字答案' }}
        </div>
        <div v-if="aiPanel.submission?.fileUrls?.length" class="preview-media">
          <img
            v-for="(img, index) in aiPanel.submission.fileUrls"
            :key="index"
            :src="resolveFileUrl(img)"
            alt="submission image"
          />
        </div>

        <div class="preview-title">AI 批改结果</div>
        <div class="ai-status">状态：{{ aiPanel.statusLabel }}</div>
        <div v-if="aiPanel.error" class="ai-error">{{ aiPanel.error }}</div>
        <div v-if="aiPanel.result" class="ai-result">
          <div class="ai-summary">
            <div class="ai-row">
              <span class="ai-label">总评：</span>
              <span
                class="ai-text"
                v-mathjax
                v-html="renderAiMarkdown(aiPanel.result?.result?.comment)"
              />
            </div>
            <div>总分：{{ aiPanel.result?.result?.totalScore ?? '-' }}</div>
            <div>置信度：{{ aiPanel.result?.result?.confidence ?? '-' }}</div>
            <div>是否存疑：{{ aiPanel.result?.result?.isUncertain ? '是' : '否' }}</div>
          </div>
          <div v-if="aiPanel.result?.result?.items?.length" class="ai-items">
            <div v-for="(item, idx) in aiPanel.result?.result?.items" :key="idx" class="ai-item">
              <div>评分项：{{ item.rubricItemKey || '-' }}</div>
              <div>得分：{{ item.score ?? '-' }} / {{ item.maxScore ?? '-' }}</div>
              <div class="ai-row">
                <span class="ai-label">理由：</span>
                <span
                  class="ai-text"
                  v-mathjax
                  v-html="renderAiMarkdown(item.reason)"
                />
              </div>
            </div>
          </div>
          <div v-if="aiPanel.result?.extracted?.studentMarkdown" class="ai-markdown">
            <div class="preview-title">AI 转写内容</div>
            <div
              class="ai-markdown-content"
              v-mathjax
              v-html="renderAiMarkdown(aiPanel.result?.extracted?.studentMarkdown)"
            />
          </div>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listTeacherAssignments } from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getSubmissionVersion } from '../api/submission'
import { getAiJobStatus, getAiGradingResult } from '../api/aiGrading'
import type { AiGradingResult } from '../api/aiGrading'
import { API_BASE_URL } from '../api/http'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const gradingItems = ref<any[]>([])
const gradingError = ref('')
const router = useRouter()
const querySubmissionId = ref('')
const aiLoading = ref(false)
const aiError = ref('')
const aiPanel = ref(null)

const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const formatDeadline = (deadline: string | null | undefined) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  return `截止 ${date.toLocaleDateString('zh-CN')}`
}

const gradingList = computed(() =>
  gradingItems.value.map((item) => {
    const pendingCount = Number(item.pendingCount ?? 0)
    const graded = pendingCount === 0 && Number(item.submissionCount ?? 0) > 0
    return {
      id: item.id,
      title: item.title,
      course: item.courseName ?? item.courseId ?? '--',
      deadline: formatDeadline(item.deadline),
      graded,
      pendingCount,
      submissionCount: Number(item.submissionCount ?? 0),
      level: graded
        ? `已批改 (${item.gradedCount ?? 0})`
        : pendingCount > 0
          ? `待批改 (${pendingCount})`
          : '暂无提交',
    }
  }),
)

const ungradedTasks = computed(() =>
  gradingList.value.filter(
    (task) => task.pendingCount > 0 || task.submissionCount === 0,
  ),
)
const gradedTasks = computed(() =>
  gradingList.value.filter((task) => task.pendingCount === 0 && task.submissionCount > 0),
)
const gradingTotal = computed(() => gradingList.value.length)

const goGrading = (assignmentId: string) => {
  router.push(`/teacher/grading/${assignmentId}`)
}

const goGradingOverview = () => {
  router.push('/teacher/grading')
}

const resolveFileUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${apiBaseOrigin}${url}`
  }
  return url
}

const renderAiMarkdown = (text?: string) => {
  if (!text) return '未提供转写内容'
  return text.replace(/\n/g, '<br />')
}

const pollAiResult = async (submissionVersionId: string) => {
  const maxAttempts = 30
  const delayMs = 2000
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const job = await getAiJobStatus(submissionVersionId)
      if (job.status === 'FAILED') {
        aiPanel.value = {
          ...aiPanel.value,
          statusLabel: '失败',
          error: job.error ?? 'AI 批改失败',
        }
        return
      }
      if (job.status === 'SUCCEEDED') {
        const result = await getAiGradingResult(submissionVersionId)
        aiPanel.value = {
          ...aiPanel.value,
          statusLabel: '完成',
          result,
        }
        return
      }
      aiPanel.value = {
        ...aiPanel.value,
        statusLabel: job.status === 'RUNNING' ? '批改中' : '排队中',
      }
    } catch (err) {
      aiPanel.value = {
        ...aiPanel.value,
        statusLabel: '失败',
        error: err instanceof Error ? err.message : 'AI 批改失败',
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  aiPanel.value = {
    ...aiPanel.value,
    statusLabel: '超时',
    error: 'AI 批改超时，请稍后重试',
  }
}

const loadAiResult = async () => {
  const id = querySubmissionId.value.trim()
  if (!id) {
    aiError.value = '请先输入 submissionVersionId'
    return
  }
  aiError.value = ''
  aiLoading.value = true
  aiPanel.value = {
    statusLabel: '加载中',
    error: '',
    result: null,
    submission: null,
  }
  try {
    const submission = await getSubmissionVersion(id)
    aiPanel.value = {
      ...aiPanel.value,
      submission: {
        contentText: submission.contentText ?? '',
        fileUrls: submission.fileUrls ?? [],
      },
    }
    void pollAiResult(id)
  } catch (err) {
    aiError.value = err instanceof Error ? err.message : '查询失败'
    aiPanel.value = null
  } finally {
    aiLoading.value = false
  }
}

onMounted(async () => {
  await refreshProfile()

  try {
    const response = await listTeacherAssignments()
    gradingItems.value = response?.items ?? []
  } catch (err) {
    gradingError.value = err instanceof Error ? err.message : '加载作业失败'
  }
})
</script>

<style scoped>
.ai-query {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.ai-input {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}

.ai-panel {
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(250, 243, 230, 0.6);
  display: grid;
  gap: 10px;
}

.preview-title {
  font-weight: 600;
  font-size: 13px;
}

.preview-text {
  font-size: 13px;
  white-space: pre-wrap;
}

.preview-media {
  display: grid;
  gap: 8px;
}

.preview-media img {
  max-width: 100%;
  border-radius: 8px;
  background: #ffffff;
}

.ai-status {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.ai-error {
  font-size: 12px;
  color: #c84c4c;
}

.ai-summary {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.ai-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: start;
}

.ai-label {
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
}

.ai-text {
  white-space: pre-wrap;
}

.ai-items {
  display: grid;
  gap: 8px;
}

.ai-item {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: grid;
  gap: 4px;
}

.ai-markdown-content {
  white-space: pre-wrap;
  font-size: 12px;
}
</style>
