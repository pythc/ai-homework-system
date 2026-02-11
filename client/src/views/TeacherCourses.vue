<template>
  <TeacherLayout
    title="我的课程"
    subtitle="查看课程列表与概况"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="课程中心"
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
        课程列表
        <span class="badge">{{ courses.length }} 门</span>
      </div>
      <div class="course-grid">
        <div
          v-for="course in courses"
          :key="course.id"
          class="course-card"
          @click="goCourse(course.id)"
        >
          <div class="course-title">{{ course.name }}</div>
          <div class="course-sub">{{ course.semester }}</div>
          <div class="course-meta">
            <span class="status-tag" :class="course.status === 'ACTIVE' ? 'active' : 'archived'">
              {{ course.status === 'ACTIVE' ? '开放中' : '已归档' }}
            </span>
          </div>
        </div>
        <div v-if="!courses.length" class="task-empty">
          {{ loadError || '暂无课程' }}
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { listCourses } from '../api/course'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()
const courses = ref<any[]>([])
const loadError = ref('')

const goCourse = (courseId: string) => {
  router.push(`/teacher/courses/${courseId}`)
}

onMounted(async () => {
  await refreshProfile()
  try {
    const response = await listCourses()
    courses.value = response?.items ?? []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载课程失败'
  }
})
</script>

<style scoped>
.course-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.course-card {
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(24, 34, 64, 0.12);
}

.course-title {
  font-size: 16px;
  font-weight: 700;
}

.course-sub {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.course-meta {
  margin-top: 10px;
}

.status-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.status-tag.active {
  background: rgba(90, 140, 255, 0.15);
  color: #3b6fe1;
}

.status-tag.archived {
  background: rgba(26, 29, 51, 0.12);
  color: rgba(26, 29, 51, 0.6);
}
</style>
