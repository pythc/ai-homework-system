<template>
  <AdminLayout
    title="班级导入"
    subtitle="批量注册学生与教师账号并创建课程"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="班级导入"
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
      <div class="panel-title">模板说明</div>
      <div class="hint-list">
        <div class="hint-item">使用根目录的 "班级导入模板.xlsx" 或导出的 .xlsx 文件。</div>
        <div class="hint-item">列顺序：序号｜姓名｜学号/工号｜邮箱（可选）｜身份（学生/教师）。</div>
        <div class="hint-item">模板中需包含且仅包含一位教师账号。</div>
        <div class="hint-item">默认密码：cqupt + 学号/工号。</div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">课程信息</div>
      <div class="form-grid">
        <div class="form-item">
          <label>学校</label>
          <select v-model="schoolId">
            <option v-for="item in schoolOptions" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </div>
        <div class="form-item">
          <label>课程名称</label>
          <input v-model.trim="courseName" type="text" placeholder="请输入课程名称" />
        </div>
        <div class="form-item">
          <label>学期</label>
          <select v-model="semester">
            <option value="上学期">上学期</option>
            <option value="下学期">下学期</option>
          </select>
        </div>
        <div class="form-item">
          <label>课程状态</label>
          <select v-model="courseStatus">
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">导入文件</div>
      <div class="import-grid">
        <div class="upload-box">
          <label>选择 Excel 文件（.xlsx）</label>
          <input type="file" accept=".xlsx" @change="handleFileChange" />
          <button class="upload-btn" :disabled="importLoading" @click="handleImport">
            {{ importLoading ? '导入中...' : '开始导入' }}
          </button>
          <div v-if="selectedFileName" class="file-name">已选择：{{ selectedFileName }}</div>
          <div v-if="importError" class="upload-error">{{ importError }}</div>
          <div v-if="importSuccess" class="upload-success">{{ importSuccess }}</div>
        </div>

        <div v-if="result" class="import-summary">
          <div class="summary-item">总计：{{ result.total }}</div>
          <div class="summary-item">新增：{{ result.created }}</div>
          <div class="summary-item">跳过：{{ result.skipped }}</div>
          <div v-if="result.course" class="summary-item">
            课程：{{ result.course.name }}（{{ result.course.semester }}）
          </div>
          <div v-if="result.course" class="summary-item">
            选课人数：{{ result.enrolled || 0 }}
          </div>
        </div>
      </div>

      <div v-if="result?.errors?.length" class="import-errors">
        <div class="panel-title">未导入记录</div>
        <table class="import-table">
          <thead>
            <tr>
              <th>行号</th>
              <th>账号</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in result.errors" :key="`${item.row}-${item.account || ''}`">
              <td>{{ item.row }}</td>
              <td>{{ item.account || '-' }}</td>
              <td>{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { registerBulkUsers } from '../api/auth'

const { profileName, profileAccount, refreshProfile, storedUser } = useAdminProfile()
const selectedFile = ref(null)
const importError = ref('')
const importSuccess = ref('')
const importLoading = ref(false)
const result = ref(null)
const courseName = ref('')
const semester = ref('上学期')
const courseStatus = ref('ACTIVE')
const schoolId = ref('')
const schoolOptions = computed(() => {
  const raw = (import.meta.env.VITE_SCHOOLS || import.meta.env.VITE_SCHOOL_NAME || '重庆邮电大学')
    .toString()
    .trim()
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') return item
          return item?.name ?? item?.id ?? null
        })
        .filter(Boolean)
    }
  } catch {
    // ignore
  }
  return raw ? [raw] : []
})

const selectedFileName = computed(() => selectedFile.value?.name ?? '')

onMounted(async () => {
  await refreshProfile()
  if (!schoolId.value) {
    schoolId.value = storedUser.value?.schoolId || schoolOptions.value[0] || ''
  }
})

const handleFileChange = (event) => {
  const input = event.target
  selectedFile.value = input?.files?.[0] ?? null
  importError.value = ''
  importSuccess.value = ''
  result.value = null
}

const handleImport = async () => {
  importError.value = ''
  importSuccess.value = ''

  if (!selectedFile.value) {
    importError.value = '请先选择 Excel 文件'
    return
  }
  if (!schoolId.value) {
    importError.value = '请选择学校'
    return
  }
  if (!courseName.value.trim()) {
    importError.value = '请输入课程名称'
    return
  }
  if (!semester.value) {
    importError.value = '请选择学期'
    return
  }

  importLoading.value = true
  try {
    const response = await registerBulkUsers(selectedFile.value, {
      schoolId: schoolId.value,
      courseName: courseName.value.trim(),
      semester: semester.value,
      status: courseStatus.value,
    })
    result.value = response.data
    importSuccess.value = `导入完成：新增 ${response.data.created} 条，跳过 ${response.data.skipped} 条`
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败'
  } finally {
    importLoading.value = false
  }
}
</script>

<style scoped>
.import-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.form-item {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.7);
}

.form-item label {
  font-weight: 600;
}

.form-item input,
.form-item select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.9);
  font-size: 13px;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.form-item input:focus,
.form-item select:focus {
  border-color: rgba(86, 101, 255, 0.55);
  box-shadow: 0 0 0 2px rgba(86, 101, 255, 0.15);
}

.file-name {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.import-summary {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  display: grid;
  gap: 10px;
  font-size: 14px;
  color: rgba(26, 29, 51, 0.8);
}

.summary-item {
  font-weight: 600;
}

.import-errors {
  margin-top: 16px;
}

.import-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  overflow: hidden;
  font-size: 13px;
}

.import-table th,
.import-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.7);
}

.import-table th {
  font-weight: 600;
  color: rgba(26, 29, 51, 0.7);
}

.import-table tr:last-child td {
  border-bottom: none;
}
</style>
