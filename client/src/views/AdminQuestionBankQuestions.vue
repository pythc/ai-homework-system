<template>
  <AdminLayout
    title="题目列表"
    subtitle="按章节查看题组与小题"
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
      <div class="panel-title">
        题目
        <span class="badge">{{ flattenedQuestions.length }}</span>
      </div>
      <div class="qb-list">
        <button
          v-for="item in flattenedQuestions"
          :key="item.id"
          class="qb-item qb-question"
          :class="{ 'is-child': item.depth > 0 }"
          type="button"
          @click="goQuestionDetail(item.id)"
        >
          <div class="qb-item-title">
            <span v-if="item.depth" class="qb-indent" />
            {{ item.title || '未命名' }}
          </div>
          <div class="qb-item-meta">
            <span>{{ item.nodeType }}</span>
            <span>{{ item.questionType }}</span>
          </div>
        </button>
        <div v-if="!flattenedQuestions.length" class="empty-box">
          {{ loadError || '暂无题目' }}
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
import { listQuestionBank } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const route = useRoute()
const router = useRouter()
const questionList = ref([])
const loadError = ref('')

const courseId = String(route.params.courseId)
const chapterId = String(route.params.chapterId)

onMounted(async () => {
  await refreshProfile()
  await fetchQuestions()
})

const fetchQuestions = async () => {
  loadError.value = ''
  try {
    const all = await listQuestionBank(courseId)
    questionList.value = all.filter((item) => item.chapterId === chapterId)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载题目失败'
  }
}

const flattenedQuestions = computed(() => {
  const byParent = new Map()
  for (const item of questionList.value) {
    const parentId = item.parentId ?? ''
    if (!byParent.has(parentId)) {
      byParent.set(parentId, [])
    }
    byParent.get(parentId).push(item)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
  }

  const result = []
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId) ?? []
    for (const child of children) {
      result.push({ ...child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return result
})

const goQuestionDetail = (questionId) => {
  router.push(`/admin/question-bank/questions/${questionId}`)
}
</script>
