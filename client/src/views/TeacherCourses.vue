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
          <div class="course-main">
            <div class="course-title">{{ course.name }}</div>
            <div class="course-sub">
              <span>{{ course.semester }}</span>
              <span class="sub-split">·</span>
              <span
                class="status-inline"
                :class="course.status === 'ACTIVE' ? 'active' : 'archived'"
              >
                {{ course.status === 'ACTIVE' ? '开放中' : '已结课' }}
              </span>
            </div>
          </div>
          <div class="course-enter">
            <span>进入课程</span>
            <span class="course-arrow">→</span>
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
  border: 1px solid rgba(169, 187, 218, 0.34);
  background: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(24, 34, 64, 0.12);
}

.course-main {
  min-width: 0;
  flex: 1;
}

.course-title {
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-sub {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sub-split {
  color: rgba(26, 29, 51, 0.4);
}

.status-inline {
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.status-inline.active {
  color: #3b6fe1;
  background: rgba(107, 146, 236, 0.15);
}

.status-inline.archived {
  color: rgba(26, 29, 51, 0.6);
  background: rgba(130, 138, 160, 0.12);
}

.course-enter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(145, 166, 204, 0.34);
  background: rgba(255, 255, 255, 0.66);
  color: rgba(26, 29, 51, 0.66);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.course-arrow {
  font-size: 13px;
  transition: transform 0.2s ease;
}

.course-card:hover .course-enter {
  color: #2953b5;
  border-color: rgba(89, 122, 198, 0.45);
}

.course-card:hover .course-arrow {
  transform: translateX(2px);
}
</style>
