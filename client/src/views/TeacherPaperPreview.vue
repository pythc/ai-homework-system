<template>
  <TeacherLayout
    title="试卷预览"
    :subtitle="paperName ? `当前试卷：${paperName}` : '查看组卷题目与标准答案'"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库目录"
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

    <section class="panel glass preview-panel">
      <div class="preview-head">
        <div class="preview-meta">
          <div class="panel-title">{{ paperName || '未命名试卷' }}</div>
          <div class="helper-text">共 {{ previewItems.length }} 题</div>
        </div>
        <div class="preview-actions">
          <button class="primary-btn ghost" type="button" @click="goBack">返回</button>
          <button
            v-if="paperId"
            class="primary-btn"
            type="button"
            @click="goPublish"
          >
            去发布
          </button>
        </div>
      </div>
      <div v-if="loading" class="empty-box">预览加载中...</div>
      <div v-else-if="errorText" class="form-error">{{ errorText }}</div>
      <PaperPreviewList v-else :items="previewItems" empty-text="当前试卷暂无题目" />
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import PaperPreviewList from '../components/PaperPreviewList.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getQuestionBankPaper, listQuestionBank } from '../api/questionBank'
import {
  createBankPreviewItem,
  createCustomPreviewItem,
  normalizeQuestionOrder,
  type PaperPreviewItem,
} from '../utils/paperPreview'

const route = useRoute()
const router = useRouter()
const { profileName, profileAccount, refreshProfile } = useTeacherProfile()

const loading = ref(false)
const errorText = ref('')
const paperName = ref('')
const previewItems = ref<PaperPreviewItem[]>([])

const paperId = computed(() => String(route.query.paperId || '').trim())

const loadPaperPreview = async () => {
  if (!paperId.value) {
    errorText.value = '缺少试卷标识，无法预览'
    previewItems.value = []
    paperName.value = ''
    return
  }

  loading.value = true
  errorText.value = ''
  try {
    const [paper, allQuestions] = await Promise.all([
      getQuestionBankPaper(paperId.value),
      listQuestionBank(),
    ])
    paperName.value = paper.name || '未命名试卷'
    const content = paper.content ?? {}
    const orderedIds = normalizeQuestionOrder(
      content.selectedQuestionIds,
      content.selectedQuestionOrder,
    )
    const questionMap = new Map((allQuestions || []).map((item) => [item.id, item]))

    const bankItems = orderedIds.map((id, index) => {
      const question = questionMap.get(id)
      if (!question) {
        return {
          key: `missing-${id}`,
          questionType: 'SHORT_ANSWER',
          title: '题目不存在或无权限访问',
          promptHtml: `题目 ID：${id}`,
          answerHtml: '',
          source: 'bank' as const,
        }
      }
      return createBankPreviewItem(question, index + 1, id)
    })

    const customItems = Array.isArray(content.customQuestions)
      ? content.customQuestions.map((item, index) =>
          createCustomPreviewItem(item, bankItems.length + index + 1),
        )
      : []

    previewItems.value = [...bankItems, ...customItems]
  } catch (error: unknown) {
    errorText.value = error instanceof Error ? error.message : '加载试卷预览失败'
    previewItems.value = []
  } finally {
    loading.value = false
  }
}

const goPublish = () => {
  if (!paperId.value) return
  router.push({
    path: '/teacher/assignments/publish',
    query: {
      paperId: paperId.value,
      step: '2',
      from: 'preview',
    },
  })
}

const goBack = () => {
  const from = String(route.query.from || '').trim()
  if (from === 'publish') {
    router.push({
      path: '/teacher/assignments/publish',
      query: {
        step: String(route.query.step || '3'),
      },
    })
    return
  }
  router.push('/teacher/question-bank/papers')
}

onMounted(async () => {
  await refreshProfile()
  await loadPaperPreview()
})
</script>

<style scoped>
.preview-panel {
  display: grid;
  gap: 12px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.preview-meta {
  display: grid;
  gap: 2px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
