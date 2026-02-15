<template>
  <AdminLayout
    title="课本列表"
    subtitle="选择课本查看章节与题目"
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
      <div class="panel-title">课本</div>
      <div class="qb-list">
        <button
          v-for="book in textbooks"
          :key="book.id"
          class="qb-item"
          type="button"
          @click="goTextbook(book.id)"
        >
          <div class="qb-item-title">{{ book.title }}</div>
          <div class="qb-item-meta">
            <span>{{ book.subject }}</span>
          </div>
        </button>
        <div v-if="!textbooks.length" class="empty-box">
          {{ loadError || '暂无课本' }}
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { getQuestionBankStructure } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const route = useRoute()
const router = useRouter()
const textbooks = ref([])
const loadError = ref('')

const courseId = route.params.courseId

onMounted(async () => {
  await refreshProfile()
  await fetchTextbooks()
})

const fetchTextbooks = async () => {
  loadError.value = ''
  try {
    const response = await getQuestionBankStructure(String(courseId))
    textbooks.value = response.textbooks ?? []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载课本失败'
  }
}

const goTextbook = (textbookId) => {
  router.push(
    `/admin/question-bank/courses/${courseId}/textbooks/${textbookId}/chapters`,
  )
}
</script>
