<template>
  <TeacherLayout
    title="章节目录"
    subtitle="先选大章节，再进入小章节"
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

    <section class="panel glass">
      <div class="panel-title">大章节</div>
      <div class="qb-list">
        <button
          v-for="chapter in parentChapters"
          :key="chapter.id"
          class="qb-item"
          type="button"
          @click="handleParentClick(chapter.id)"
        >
          <div class="qb-item-title">{{ chapter.title }}</div>
          <div class="qb-item-meta">
            <span>序号 {{ chapter.orderNo }}</span>
            <span v-if="hasChildren(chapter.id)">含小章节</span>
            <span v-else>无小章节</span>
          </div>
        </button>
        <div v-if="!parentChapters.length" class="empty-box">
          {{ loadError || '暂无大章节' }}
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getQuestionBankStructure } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const chapters = ref([])
const loadError = ref('')

const courseId = String(route.params.courseId)
const textbookId = String(route.params.textbookId)

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

const parentChapters = computed(() =>
  chapters.value
    .filter((item) => !item.parentId)
    .sort((a, b) => a.orderNo - b.orderNo),
)

const hasChildren = (parentId) =>
  chapters.value.some((chapter) => chapter.parentId === parentId)

const handleParentClick = (parentId) => {
  if (hasChildren(parentId)) {
    router.push(
      `/teacher/question-bank/courses/${courseId}/textbooks/${textbookId}/chapters/${parentId}`,
    )
    return
  }
  router.push(
    `/teacher/question-bank/courses/${courseId}/textbooks/${textbookId}/chapters/${parentId}/questions`,
  )
}
</script>
