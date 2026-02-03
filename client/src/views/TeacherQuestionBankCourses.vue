<template>
  <TeacherLayout
    title="题库课程"
    subtitle="选择课程查看题库"
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
      <div class="panel-title">课程列表</div>
      <div class="qb-list">
        <button
          v-for="course in courses"
          :key="course.id"
          class="qb-item"
          type="button"
          @click="goTextbooks(course.id)"
        >
          <div class="qb-item-title">{{ course.name }}</div>
          <div class="qb-item-meta">
            <span>{{ course.semester }}</span>
            <span>{{ course.status }}</span>
          </div>
        </button>
        <div v-if="!courses.length" class="empty-box">
          {{ loadError || '暂无课程' }}
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { listCourses } from '../api/course'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()
const courses = ref([])
const loadError = ref('')

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
})

const fetchCourses = async () => {
  loadError.value = ''
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const goTextbooks = (courseId) => {
  router.push(`/teacher/question-bank/courses/${courseId}/textbooks`)
}
</script>
