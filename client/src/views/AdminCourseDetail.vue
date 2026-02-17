<template>
  <AdminLayout
    title="课程管理"
    subtitle="查看课程详情与学生名单"
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
      <div class="detail-header">
        <div>
          <div class="detail-title">{{ course?.name || '课程详情' }}</div>
          <div class="detail-sub">
            {{ course?.semester || '-' }}
            <span class="status-pill" :class="course?.status?.toLowerCase()">
              {{ course?.status || '-' }}
            </span>
          </div>
        </div>
        <div class="header-actions">
          <button class="ghost-btn" type="button" @click="backToList">返回课程总览</button>
        </div>
      </div>

      <div v-if="loadError" class="empty-box">{{ loadError }}</div>

      <div v-else class="detail-card">
        <div class="info-section">
          <div class="panel-title">基本信息</div>
          <div class="info-bar">
            <div class="detail-info">
              <div class="detail-item">
                <span>教师</span>
                <span>{{ course?.teacherName || '—' }}</span>
              </div>
              <div class="detail-item">
                <span>教师账号</span>
                <span>{{ course?.teacherAccount || '—' }}</span>
              </div>
              <div class="detail-item">
                <span>学校</span>
                <span>{{ course?.schoolId || '—' }}</span>
              </div>
            </div>

          <div class="status-field">
            <div class="status-label">课程状态</div>
            <div class="status-edit inline">
              <select v-model="statusDraft">
                <option value="ACTIVE">ACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              <button
                class="save-btn"
                type="button"
                :disabled="saving || statusDraft === course?.status"
                @click="updateStatus"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
          </div>
        </div>

        <div v-if="actionMessage" class="action-message success">
          {{ actionMessage }}
        </div>
        <div v-if="actionError" class="action-message error">
          {{ actionError }}
        </div>

        <div class="students-section">
          <div class="student-header">
            <div class="panel-title">学生列表（{{ filteredStudents.length }}）</div>
            <div class="student-tools">
              <input
                v-model.trim="studentQuery"
                type="search"
                placeholder="搜索学生姓名/学号"
              />
              <select v-model.number="pageSize">
                <option :value="10">10 条/页</option>
                <option :value="20">20 条/页</option>
                <option :value="50">50 条/页</option>
              </select>
            </div>
          </div>
          <div v-if="studentsLoading" class="empty-box">加载中...</div>
          <div v-else-if="studentsError" class="empty-box">{{ studentsError }}</div>
          <div v-else-if="!students.length" class="empty-box">暂无学生</div>
          <table v-else class="student-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>学号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in pagedStudents" :key="student.studentId">
                <td>{{ student.name || '-' }}</td>
                <td>{{ student.account || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="filteredStudents.length > pageSize" class="pagination">
            <button
              type="button"
              class="page-btn"
              :disabled="studentPage === 1"
              @click="studentPage -= 1"
            >
              上一页
            </button>
            <span>第 {{ studentPage }} / {{ studentTotalPages }} 页</span>
            <button
              type="button"
              class="page-btn"
              :disabled="studentPage === studentTotalPages"
              @click="studentPage += 1"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { getCourse, listCourseStudents, updateCourse } from '../api/course'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const route = useRoute()
const router = useRouter()
const courseId = computed(() => String(route.params.courseId ?? ''))

const course = ref(null)
const loadError = ref('')
const statusDraft = ref('ACTIVE')
const saving = ref(false)
const actionMessage = ref('')
const actionError = ref('')

const students = ref([])
const studentsLoading = ref(false)
const studentsError = ref('')
const studentQuery = ref('')
const studentPage = ref(1)
const pageSize = ref(20)

const filteredStudents = computed(() => {
  const keyword = studentQuery.value.trim().toLowerCase()
  if (!keyword) return students.value
  return students.value.filter((student) => {
    const name = (student.name || '').toLowerCase()
    const account = (student.account || '').toLowerCase()
    return name.includes(keyword) || account.includes(keyword)
  })
})

const studentTotalPages = computed(() => {
  const total = filteredStudents.value.length
  return total ? Math.ceil(total / pageSize.value) : 1
})

const pagedStudents = computed(() => {
  const start = (studentPage.value - 1) * pageSize.value
  return filteredStudents.value.slice(start, start + pageSize.value)
})

watch([filteredStudents, pageSize], () => {
  if (studentPage.value > studentTotalPages.value) {
    studentPage.value = studentTotalPages.value
  }
})

const loadCourse = async () => {
  if (!courseId.value) return
  loadError.value = ''
  try {
    const response = await getCourse(courseId.value)
    course.value = response
    statusDraft.value = response.status
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const fetchStudents = async () => {
  if (!courseId.value) return
  studentsLoading.value = true
  studentsError.value = ''
  students.value = []
  try {
    const response = await listCourseStudents(courseId.value)
    students.value = response.items ?? []
    studentPage.value = 1
  } catch (err) {
    studentsError.value = err instanceof Error ? err.message : '加载学生失败'
  } finally {
    studentsLoading.value = false
  }
}

const updateStatus = async () => {
  if (!course.value || statusDraft.value === course.value.status) return
  saving.value = true
  actionMessage.value = ''
  actionError.value = ''
  try {
    const response = await updateCourse(course.value.id, {
      status: statusDraft.value,
    })
    course.value = { ...course.value, ...response }
    actionMessage.value = '课程状态已更新'
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '更新课程状态失败'
  } finally {
    saving.value = false
  }
}

const backToList = () => {
  router.push('/admin/courses')
}

onMounted(async () => {
  await refreshProfile()
  await loadCourse()
  await fetchStudents()
})
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.detail-sub {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.6);
}

.detail-card {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 20px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.info-section {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.7);
  margin-bottom: 22px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.detail-info {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: center;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: rgba(26, 29, 51, 0.85);
  min-width: 0;
}

.detail-item span:first-child {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
}

.info-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: start;
  margin-bottom: 12px;
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

.status-edit {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.status-edit.inline {
  justify-content: flex-start;
  margin-bottom: 0;
}

.status-edit.inline select {
  min-width: 120px;
}

.status-field {
  display: grid;
  gap: 6px;
}

.status-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  font-weight: 600;
  line-height: 1.2;
}
.status-edit select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}

.save-btn {
  border: none;
  border-radius: 10px;
  padding: 6px 12px;
  background: rgba(86, 101, 255, 0.9);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-message {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.action-message.success {
  background: rgba(42, 190, 125, 0.12);
  color: rgba(26, 120, 70, 0.9);
}

.action-message.error {
  background: rgba(240, 90, 90, 0.12);
  color: rgba(170, 35, 35, 0.9);
}

.students-section {
  margin-top: 0;
  padding: 12px 14px;
}

.student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.student-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-tools input,
.student-tools select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  color: rgba(26, 29, 51, 0.8);
}

.student-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  overflow: hidden;
}

.student-table th,
.student-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
}

.student-table th {
  color: rgba(26, 29, 51, 0.65);
  font-weight: 600;
}

.pagination {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.page-btn {
  border: none;
  border-radius: 10px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.8);
  color: rgba(26, 29, 51, 0.8);
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-box {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
  color: rgba(26, 29, 51, 0.6);
  text-align: center;
  font-size: 12px;
}

.ghost-btn {
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
}

@media (max-width: 960px) {
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .student-tools {
    width: 100%;
    flex-wrap: wrap;
  }

  .info-bar {
    grid-template-columns: 1fr;
  }

  .detail-info {
    grid-template-columns: 1fr;
  }

  .detail-item {
    align-items: flex-start;
  }
}
</style>
