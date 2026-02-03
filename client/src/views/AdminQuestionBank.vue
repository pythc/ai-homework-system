<template>
  <AdminLayout
    title="上传题库"
    subtitle="按课程上传题库 JSON"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库管理"
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
      <div class="panel-title">课程与导入</div>
      <div class="course-tools">
        <div class="course-select">
          <label>选择课程</label>
          <select v-model="selectedCourseId">
            <option value="">请选择课程</option>
            <option v-for="course in courses" :key="course.id" :value="course.id">
              {{ course.name }}（{{ course.semester }}）
            </option>
          </select>
        </div>
        <div class="upload-box">
          <label>题库 JSON 文件</label>
          <input type="file" accept=".json" @change="handleFileChange" />
          <button class="upload-btn" :disabled="uploadLoading" @click="handleUpload">
            {{ uploadLoading ? '上传中...' : '上传题库' }}
          </button>
          <div v-if="uploadError" class="upload-error">{{ uploadError }}</div>
          <div v-if="uploadSuccess" class="upload-success">{{ uploadSuccess }}</div>
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { importQuestionBank } from '../api/questionBank'
import { listCourses } from '../api/course'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const courses = ref([])
const selectedCourseId = ref('')
const selectedFile = ref(null)
const uploadError = ref('')
const uploadSuccess = ref('')
const uploadLoading = ref(false)

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
})

const fetchCourses = async () => {
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const handleFileChange = (event) => {
  const input = event.target
  selectedFile.value = input?.files?.[0] ?? null
}

const handleUpload = async () => {
  uploadError.value = ''
  uploadSuccess.value = ''

  if (!selectedCourseId.value) {
    uploadError.value = '请先选择课程'
    return
  }
  if (!selectedFile.value) {
    uploadError.value = '请先选择题库 JSON 文件'
    return
  }

  uploadLoading.value = true
  try {
    const text = await selectedFile.value.text()
    const payload = JSON.parse(text)
    payload.courseId = selectedCourseId.value
    await importQuestionBank(payload)
    uploadSuccess.value = '题库上传成功'
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploadLoading.value = false
  }
}
</script>
