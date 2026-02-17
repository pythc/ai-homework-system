<template>
  <AdminLayout
    title="课程管理"
    subtitle="查看课程、教师与学生，并调整课程状态"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="课程管理"
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
      <div class="course-grid">
        <div class="course-list">
          <div class="list-header">
            <div class="panel-title">课程列表</div>
            <div class="list-count">{{ filteredCourses.length }}</div>
          </div>
          <div class="list-filters">
            <input
              v-model.trim="courseQuery"
              type="search"
              placeholder="搜索课程/教师/学期"
            />
            <select v-model="statusFilter">
              <option value="ALL">全部状态</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <div class="list-scroll">
            <button
              v-for="course in filteredCourses"
              :key="course.id"
              class="course-item"
              type="button"
              @click="goDetail(course.id)"
            >
              <div class="course-name">{{ course.name }}</div>
              <div class="course-meta">
                <span>{{ course.semester }}</span>
                <span class="status-pill" :class="course.status?.toLowerCase()">
                  {{ course.status }}
                </span>
              </div>
              <div class="course-teacher">
                教师：{{ course.teacherName || course.teacherAccount || '—' }}
              </div>
            </button>
            <div v-if="!filteredCourses.length" class="empty-box">
              {{ loadError || '暂无课程' }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { listCourses } from '../api/course'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const router = useRouter()
const courses = ref([])
const loadError = ref('')
const courseQuery = ref('')
const statusFilter = ref('ALL')

const filteredCourses = computed(() => {
  const keyword = courseQuery.value.trim().toLowerCase()
  return courses.value.filter((course) => {
    if (statusFilter.value !== 'ALL' && course.status !== statusFilter.value) {
      return false
    }
    if (!keyword) return true
    const teacher = `${course.teacherName || ''} ${course.teacherAccount || ''}`.toLowerCase()
    return (
      course.name?.toLowerCase().includes(keyword) ||
      course.semester?.toLowerCase().includes(keyword) ||
      teacher.includes(keyword)
    )
  })
})

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
})

const fetchCourses = async () => {
  loadError.value = ''
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
    if (courses.value.length) {
      const nextId =
        courses.value.find((item) => item.id === selectedCourseId.value)?.id ??
        courses.value[0].id
      selectCourse(courses.value.find((item) => item.id === nextId) ?? courses.value[0])
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const goDetail = (courseId) => {
  router.push(`/admin/courses/${courseId}`)
}
</script>

<style scoped>
.course-grid {
  display: grid;
  grid-template-columns: minmax(240px, 340px) minmax(360px, 1fr);
  gap: 20px;
}

.course-list {
  display: grid;
  gap: 12px;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 20px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-filters {
  display: grid;
  gap: 8px;
}

.list-filters input,
.list-filters select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  color: rgba(26, 29, 51, 0.8);
}

.list-filters input:focus,
.list-filters select:focus,
.student-tools input:focus,
.student-tools select:focus {
  outline: none;
  border-color: rgba(86, 101, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(86, 101, 255, 0.12);
}

.list-count {
  min-width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(86, 101, 255, 0.14);
  color: rgba(86, 101, 255, 0.9);
  font-weight: 700;
  display: grid;
  place-items: center;
  font-size: 12px;
}

.list-scroll {
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 320px);
  overflow: auto;
  padding-right: 6px;
}

.course-item {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.85);
  border-radius: 14px;
  padding: 12px 14px;
  text-align: left;
  display: grid;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.course-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 20, 45, 0.08);
}

.course-item.active {
  border-color: rgba(86, 101, 255, 0.55);
  box-shadow: 0 0 0 2px rgba(86, 101, 255, 0.2);
}

.course-name {
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.course-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  align-items: center;
}

.course-teacher {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
}

.status-pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(120, 200, 170, 0.2);
  color: #1f7a4b;
}

.status-pill.archived {
  background: rgba(200, 200, 210, 0.35);
  color: rgba(26, 29, 51, 0.55);
}



.empty-box {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
  color: rgba(26, 29, 51, 0.6);
  text-align: center;
  font-size: 12px;
}

@media (max-width: 960px) {
  .course-grid {
    grid-template-columns: 1fr;
  }

  .list-scroll {
    max-height: none;
  }
}
</style>
