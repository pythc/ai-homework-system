<template>
  <TeacherLayout
    title="批改作业"
    subtitle="选择学生提交进行批改"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业批改"
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

    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>
          提交列表
          <span class="badge">{{ filteredSubmissions.length }} 条</span>
        </div>
        <button class="ghost-action" @click="goBack">返回作业</button>
      </div>

      <div class="grading-toolbar">
        <div class="grading-tabs">
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'PENDING' }"
            @click="statusFilter = 'PENDING'"
          >
            未批改
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'GRADED' }"
            @click="statusFilter = 'GRADED'"
          >
            已批改
          </button>
          <button
            class="tab-btn"
            :class="{ active: statusFilter === 'ALL' }"
            @click="statusFilter = 'ALL'"
          >
            全部
          </button>
        </div>
        <div class="grading-search">
          <input
            v-model="searchText"
            class="search-input"
            type="text"
            placeholder="搜索学生姓名/学号"
          />
        </div>
      </div>

      <div class="submission-list">
        <div
          v-for="item in pagedSubmissions"
          :key="item.submissionVersionId"
          class="submission-row"
        >
          <div class="submission-main">
            <div class="submission-name">
              {{ item.student.name || item.student.account || '学生' }}
            </div>
            <div class="submission-meta">
              学号 {{ item.student.account || '-' }}
            </div>
            <div class="submission-meta">
              提交 {{ formatTime(item.submittedAt) }}
            </div>
          </div>
          <div class="submission-status" :class="item.isFinal ? 'graded' : 'pending'">
            {{ item.isFinal ? '已批改' : '未批改' }}
          </div>
          <button class="task-action ghost" @click="goGrading(item.submissionVersionId)">
            批改
          </button>
        </div>
        <div v-if="!filteredSubmissions.length" class="task-empty">
          {{ loadError || '暂无提交' }}
        </div>
        <div v-if="totalPages > 1" class="paging">
          <button class="page-btn" :disabled="pageIndex === 1" @click="pageIndex -= 1">
            上一页
          </button>
          <span class="page-text">{{ pageIndex }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="pageIndex === totalPages" @click="pageIndex += 1">
            下一页
          </button>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listSubmissionsByAssignment } from '../api/teacherGrading'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const assignmentId = computed(() => String(route.params.assignmentId ?? ''))
const courseId = computed(() => String(route.query.courseId ?? ''))

const submissions = ref<any[]>([])
const loadError = ref('')
const statusFilter = ref<'PENDING' | 'GRADED' | 'ALL'>('PENDING')
const searchText = ref('')
const pageIndex = ref(1)
const pageSize = ref(20)

const formatTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

const filteredSubmissions = computed(() => {
  const keyword = searchText.value.trim()
  let list = submissions.value
  if (statusFilter.value === 'PENDING') {
    list = list.filter((item: any) => !item.isFinal)
  } else if (statusFilter.value === 'GRADED') {
    list = list.filter((item: any) => item.isFinal)
  }
  if (keyword) {
    list = list.filter((item: any) =>
      `${item.student.name ?? ''}${item.student.account ?? ''}`.includes(keyword),
    )
  }
  return list
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredSubmissions.value.length / pageSize.value)),
)

const pagedSubmissions = computed(() => {
  const start = (pageIndex.value - 1) * pageSize.value
  return filteredSubmissions.value.slice(start, start + pageSize.value)
})

const goGrading = (submissionVersionId: string) => {
  if (!assignmentId.value || !submissionVersionId) return
  router.push({
    path: `/teacher/grading/${assignmentId.value}/submission/${submissionVersionId}`,
    query: courseId.value ? { courseId: courseId.value } : undefined,
  })
}

const goBack = () => {
  if (courseId.value) {
    router.push(`/teacher/grading/course/${courseId.value}`)
  } else {
    router.push('/teacher/grading')
  }
}

const loadData = async () => {
  if (!assignmentId.value) {
    loadError.value = '缺少作业 ID'
    return
  }
  try {
    const response = await listSubmissionsByAssignment(assignmentId.value)
    submissions.value = response?.items ?? []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载提交失败'
  }
}

watch([statusFilter, searchText], () => {
  pageIndex.value = 1
})

onMounted(async () => {
  await refreshProfile()
  await loadData()
})
</script>

<style scoped>
.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.grading-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0;
  flex-wrap: wrap;
}

.grading-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #ffffff;
}

.grading-search {
  flex: 1;
  min-width: 220px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
}

.submission-list {
  display: grid;
  gap: 10px;
}

.submission-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
}

.submission-name {
  font-weight: 600;
}

.submission-meta {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.submission-status {
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
}

.submission-status.pending {
  background: rgba(255, 196, 154, 0.35);
  color: #9a4a12;
}

.submission-status.graded {
  background: rgba(120, 200, 170, 0.3);
  color: #1f7a4b;
}

.task-action.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.8);
  box-shadow: none;
}

.paging {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.page-btn {
  border: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-text {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 900px) {
  .submission-row {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
</style>
