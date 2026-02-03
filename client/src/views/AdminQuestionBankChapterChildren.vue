<template>
  <AdminLayout
    title="小章节目录"
    subtitle="选择小章节查看题目"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库目录"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">账号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="panel glass">
      <div class="panel-title">小章节</div>
      <div class="qb-list">
        <button
          v-for="chapter in childChapters"
          :key="chapter.id"
          class="qb-item"
          type="button"
          @click="goQuestions(chapter.id)"
        >
          <div class="qb-item-title">{{ chapter.title }}</div>
          <div class="qb-item-meta">
            <span>序号 {{ chapter.orderNo }}</span>
          </div>
        </button>
        <div v-if="!childChapters.length" class="empty-box">
          {{ loadError || '暂无小章节' }}
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { getQuestionBankStructure } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const route = useRoute()
const router = useRouter()
const chapters = ref([])
const loadError = ref('')

const courseId = String(route.params.courseId)
const textbookId = String(route.params.textbookId)
const parentId = String(route.params.chapterId)

onMounted(async () => {
  await refreshProfile()
  await fetchStructure()
})

const fetchStructure = async () => {
  loadError.value = ''
  try {
    const response = await getQuestionBankStructure(courseId)
    chapters.value = (response.chapters ?? []).filter(
      (chapter) => chapter.textbookId === textbookId,
    )
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载章节失败'
  }
}

const childChapters = computed(() =>
  chapters.value
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.orderNo - b.orderNo),
)

const goQuestions = (chapterId) => {
  router.push(
    `/admin/question-bank/courses/${courseId}/textbooks/${textbookId}/chapters/${chapterId}/questions`,
  )
}
</script>
