<template>
  <TeacherLayout
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
          <div class="topbar-id">工号 {{ profileAccount }}</div>
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
          v-for="item in visibleQuestions"
          :key="item.id"
          class="qb-item qb-question"
          :class="{ 'is-child': item.depth > 0 }"
          type="button"
          @click="item.isExpandable ? toggleExpand(item.id) : goQuestionDetail(item.id)"
        >
          <div class="qb-item-title">
            <span v-if="item.depth" class="qb-indent" />
            <span v-if="item.isExpandable" class="qb-expand">
              {{ expandedIds.has(item.id) ? '▾' : '▸' }}
            </span>
            {{ getItemTitle(item) }}
            <span
              v-if="item.isExpandable && getStemText(item)"
              class="qb-stem"
              v-mathjax
              v-html="renderStemHtml(item)"
            />
          </div>
        </button>
        <div v-if="!visibleQuestions.length" class="empty-box">
          {{ loadError || '暂无题目' }}
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
import { listQuestionBank } from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()
const questionList = ref([])
const loadError = ref('')
const expandedIds = ref(new Set())

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
    for (const [index, child] of children.entries()) {
      const isExpandable = (byParent.get(child.id) ?? []).length > 0
      const displayOrder = child.orderNo ?? index + 1
      result.push({ ...child, depth, isExpandable, displayOrder })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return result
})

const visibleQuestions = computed(() => {
  const byId = new Map(flattenedQuestions.value.map((item) => [item.id, item]))
  return flattenedQuestions.value.filter((item) => {
    let parentId = item.parentId ?? ''
    while (parentId) {
      if (!expandedIds.value.has(parentId)) return false
      const parent = byId.get(parentId)
      if (!parent) break
      parentId = parent.parentId ?? ''
    }
    return true
  })
})

const toggleExpand = (questionId) => {
  const next = new Set(expandedIds.value)
  if (next.has(questionId)) {
    next.delete(questionId)
  } else {
    next.add(questionId)
  }
  expandedIds.value = next
}

const getStemText = (item) => {
  if (!item?.stem) return ''
  if (typeof item.stem === 'string') return item.stem
  return item.stem.text ?? ''
}

const renderStemHtml = (item) => {
  const text = getStemText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const getItemTitle = (item) => {
  if (item?.title) return item.title
  if (item?.depth > 0) return `（${item.displayOrder ?? 1}）`
  return '未命名'
}

const goQuestionDetail = (questionId) => {
  router.push(`/teacher/question-bank/questions/${questionId}`)
}
</script>
