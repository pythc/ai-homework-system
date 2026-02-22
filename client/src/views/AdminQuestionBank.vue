<template>
  <AdminLayout
    title="上传题库"
    subtitle="无需绑定课程，上传后配置可见学校"
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
      <div class="panel-title">题库导入</div>
      <div class="upload-box">
        <label>题库 JSON 文件</label>
        <input type="file" accept=".json" @change="handleFileChange" />
        <button class="upload-btn" :disabled="uploadLoading" @click="handleUpload">
          {{ uploadLoading ? '上传中...' : '上传题库' }}
        </button>
      </div>
      <div v-if="uploadError" class="upload-error">{{ uploadError }}</div>
      <div v-if="uploadSuccess" class="upload-success">{{ uploadSuccess }}</div>
    </section>

    <section class="panel glass">
      <div class="panel-title">可见学校设置</div>
      <div class="panel-sub">导入完成后，勾选可以查询并用于作业布置的学校</div>
      <div class="schools-grid">
        <label
          v-for="school in schoolItems"
          :key="school.schoolId"
          class="school-item"
        >
          <input
            type="checkbox"
            :value="school.schoolId"
            v-model="selectedSchoolIds"
          />
          <span>{{ school.schoolId }}</span>
        </label>
      </div>
      <div class="visibility-actions">
        <button
          class="upload-btn"
          :disabled="savingVisibility || !lastTextbookId || selectedSchoolIds.length === 0"
          @click="handleSaveVisibility"
        >
          {{ savingVisibility ? '保存中...' : '保存可见学校' }}
        </button>
      </div>
      <div v-if="visibilityMessage" class="upload-success">{{ visibilityMessage }}</div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import {
  importQuestionBank,
  listQuestionBankSchools,
  updateTextbookVisibility,
} from '../api/questionBank'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const selectedFile = ref(null)
const uploadError = ref('')
const uploadSuccess = ref('')
const uploadLoading = ref(false)
const visibilityMessage = ref('')
const savingVisibility = ref(false)
const schoolItems = ref([])
const selectedSchoolIds = ref([])
const lastTextbookId = ref('')

const fallbackCurrentSchoolId = computed(() => {
  const raw = localStorage.getItem('ai_homework_user')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    return String(parsed?.schoolId ?? '')
  } catch {
    return ''
  }
})

onMounted(async () => {
  await refreshProfile()
  await fetchSchools()
})

const fetchSchools = async () => {
  try {
    const response = await listQuestionBankSchools()
    schoolItems.value = response.items ?? []
    const current = fallbackCurrentSchoolId.value
    if (current && !selectedSchoolIds.value.includes(current)) {
      selectedSchoolIds.value = [current]
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '加载学校列表失败'
  }
}

const handleFileChange = (event) => {
  const input = event.target
  selectedFile.value = input?.files?.[0] ?? null
}

const handleUpload = async () => {
  uploadError.value = ''
  uploadSuccess.value = ''
  visibilityMessage.value = ''
  if (!selectedFile.value) {
    uploadError.value = '请先选择题库 JSON 文件'
    return
  }

  uploadLoading.value = true
  try {
    const text = await selectedFile.value.text()
    const payload = JSON.parse(text)
    payload.visibleSchoolIds = selectedSchoolIds.value
    const response = await importQuestionBank(payload)
    const data = response?.data ?? response
    lastTextbookId.value = data?.textbookId ?? ''
    uploadSuccess.value = '题库上传成功'
    if (lastTextbookId.value && selectedSchoolIds.value.length) {
      await updateTextbookVisibility(lastTextbookId.value, selectedSchoolIds.value)
      visibilityMessage.value = '可见学校已保存'
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploadLoading.value = false
  }
}

const handleSaveVisibility = async () => {
  if (!lastTextbookId.value) {
    uploadError.value = '请先导入题库'
    return
  }
  if (!selectedSchoolIds.value.length) {
    uploadError.value = '请至少选择一个可见学校'
    return
  }
  savingVisibility.value = true
  uploadError.value = ''
  visibilityMessage.value = ''
  try {
    await updateTextbookVisibility(lastTextbookId.value, selectedSchoolIds.value)
    visibilityMessage.value = '可见学校已更新'
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    savingVisibility.value = false
  }
}
</script>

<style scoped>
.panel {
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 14px;
}

.panel-title {
  font-size: 22px;
  font-weight: 800;
  color: #232c42;
  margin-bottom: 10px;
}

.panel-sub {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.62);
  margin-bottom: 10px;
}

.upload-box {
  display: grid;
  gap: 10px;
  border-radius: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.58);
}

.upload-box label {
  font-size: 14px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.78);
}

.upload-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  background: linear-gradient(135deg, #4c9fff, #72d5df);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  width: fit-content;
}

.upload-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.upload-error {
  color: #d64b4b;
  font-size: 12px;
  margin-top: 8px;
}

.upload-success {
  color: #288b52;
  font-size: 12px;
  margin-top: 8px;
}

.schools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.school-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.86);
  font-size: 13px;
  color: rgba(26, 29, 51, 0.82);
}

.visibility-actions {
  margin-top: 12px;
}
</style>

