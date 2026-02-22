<template>
  <TeacherLayout
    title="题目详情"
    subtitle="完整题干与答案"
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

    <section class="panel glass qb-detail">
      <div class="panel-title panel-title-row">
        <div>题目</div>
        <button class="ghost-action" @click="goBack">返回</button>
      </div>
      <div v-if="question" class="detail-body">
        <div class="detail-row" />

        <div v-if="question.nodeType === 'GROUP'" class="detail-block">
          <div class="detail-label">题干</div>
          <div
            :key="`${questionKey}-stem`"
            class="detail-text"
            v-mathjax
            v-html="renderTextHtml(question.stem)"
          />
          <div v-if="renderMedia(question.stem).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.stem)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>
        </div>

        <div v-else class="detail-block">
          <div class="detail-label">题干</div>
          <div
            :key="`${questionKey}-prompt`"
            class="detail-text"
            v-mathjax
            v-html="renderTextHtml(question.prompt)"
          />
          <div v-if="renderMedia(question.prompt).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.prompt)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>

          <div class="detail-label">答案</div>
          <div
            :key="`${questionKey}-answer`"
            class="detail-text"
            v-mathjax
            v-html="renderTextHtml(question.standardAnswer)"
          />
          <div v-if="renderMedia(question.standardAnswer).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.standardAnswer)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ loadError || '加载中...' }}
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getQuestionBankQuestion } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const loadError = ref('')
const question = ref(null)
const questionKey = computed(() => String(route.params.questionId ?? ''))

onMounted(async () => {
  await refreshProfile()
  await fetchQuestion()
})

watch(
  () => route.params.questionId,
  async () => {
    await fetchQuestion()
  },
)

const fetchQuestion = async () => {
  loadError.value = ''
  try {
    question.value = await getQuestionBankQuestion(String(route.params.questionId))
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载题目失败'
  }
}

const normalizeTextBlock = (value) => {
  if (!value) return { text: '', media: [] }
  if (typeof value === 'string') return { text: value, media: [] }
  const text = value.text ?? ''
  const media = Array.isArray(value.media) ? value.media : []
  return { text, media }
}

const renderTextHtml = (value) => {
  const text = normalizeTextBlock(value).text || ''
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const renderMedia = (value) => normalizeTextBlock(value).media

const goBack = () => {
  if (route.query.from === 'publish') {
    router.push({
      path: '/teacher/assignments/publish',
      query: {
        step: route.query.step,
        courseId: route.query.courseId,
        textbookId: route.query.textbookId,
        chapterId: route.query.chapterId,
      },
    })
    return
  }
  router.back()
}
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
</style>
