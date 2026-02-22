<template>
  <TeacherLayout
    title="班级导入"
    subtitle="按模板一次导入整班学生，自动创建课程并完成选课关系"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
  >
    <section class="panel glass">
      <div class="panel-head">
        <div class="panel-title">导入流程</div>
        <div class="panel-sub">3 步完成班级导入</div>
      </div>
      <div class="flow-row">
        <div class="flow-item">
          <div class="flow-index">1</div>
          <div class="flow-text">填写课程与班级信息</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-item">
          <div class="flow-index">2</div>
          <div class="flow-text">上传班级 Excel</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-item">
          <div class="flow-index">3</div>
          <div class="flow-text">系统创建课程并导入名单</div>
        </div>
      </div>
    </section>

    <section class="import-layout">
      <article class="panel glass">
        <div class="panel-title">课程配置</div>
        <div class="form-grid">
          <div class="form-item">
            <label>学校</label>
            <input :value="schoolId" type="text" readonly />
          </div>
          <div class="form-item">
            <label>课程名称</label>
            <input v-model.trim="courseName" type="text" placeholder="例如：高等数学A" />
          </div>
          <div class="form-item">
            <label>班级名称</label>
            <input v-model.trim="className" type="text" placeholder="例如：2023级1班" />
          </div>
          <div class="form-item">
            <label>学期</label>
            <select v-model="semester">
              <option value="上学期">上学期</option>
              <option value="下学期">下学期</option>
            </select>
          </div>
        </div>
        <div class="course-preview">
          <span class="preview-label">课程名预览</span>
          <span class="preview-value">{{ fullCourseName || '请先填写课程名称与班级名称' }}</span>
        </div>
        <div class="password-tip">导入学生初始密码：123456</div>
      </article>
    </section>

    <section class="panel glass">
      <div class="panel-title">上传并导入</div>
      <div class="import-grid">
        <div class="upload-box">
          <label>Excel 文件（.xlsx）</label>
          <div class="action-row">
            <a class="download-btn" href="/班级导入模板.xlsx" download>下载附件</a>
            <button class="picker-btn" type="button" @click="openFilePicker">选择文件</button>
            <button class="upload-btn" :disabled="importLoading || !canSubmit" @click="handleImport">
              {{ importLoading ? '导入中...' : '开始导入' }}
            </button>
          </div>
          <input
            ref="fileInputRef"
            class="hidden-file-input"
            type="file"
            accept=".xlsx"
            @change="handleFileChange"
          />
          <div class="file-display">
            <span class="file-tag">当前文件</span>
            <span class="file-name">{{ selectedFileName || '尚未选择文件' }}</span>
          </div>
          <div v-if="importError" class="upload-error">{{ importError }}</div>
          <div v-if="importSuccess" class="upload-success">{{ importSuccess }}</div>
        </div>

        <div class="import-summary">
          <template v-if="result">
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">总计</div>
                <div class="summary-value">{{ result.total }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">新增</div>
                <div class="summary-value success">{{ result.created }}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">跳过</div>
                <div class="summary-value warn">{{ result.skipped }}</div>
              </div>
            </div>
            <div v-if="result.course" class="summary-meta">
              课程：{{ result.course.name }}（{{ result.course.semester }}） · 选课人数：{{ result.enrolled || 0 }}
            </div>
          </template>
          <template v-else>
            <div class="empty-summary">导入完成后，这里会显示统计结果。</div>
          </template>
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
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TeacherLayout from '../components/TeacherLayout.vue'
import { registerBulkUsers } from '../api/auth'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile, storedUser } = useTeacherProfile()
const selectedFile = ref<File | null>(null)
const importError = ref('')
const importSuccess = ref('')
const importLoading = ref(false)
const result = ref<any | null>(null)
const courseName = ref('')
const className = ref('')
const semester = ref('上学期')
const fileInputRef = ref<HTMLInputElement | null>(null)
const schoolId = computed(() => String(storedUser.value?.schoolId ?? '').trim())
const selectedFileName = computed(() => selectedFile.value?.name ?? '')
const fullCourseName = computed(() => {
  const c = courseName.value.trim()
  const g = className.value.trim()
  if (!c || !g) return ''
  return `${c}（${g}）`
})
const canSubmit = computed(
  () =>
    Boolean(selectedFile.value) &&
    Boolean(schoolId.value) &&
    Boolean(courseName.value.trim()) &&
    Boolean(className.value.trim()) &&
    Boolean(semester.value),
)

onMounted(async () => {
  await refreshProfile()
})

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  selectedFile.value = input?.files?.[0] ?? null
  importError.value = ''
  importSuccess.value = ''
  result.value = null
}

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const handleImport = async () => {
  importError.value = ''
  importSuccess.value = ''

  if (!selectedFile.value) {
    importError.value = '请先选择 Excel 文件'
    return
  }
  if (!schoolId.value) {
    importError.value = '当前账号缺少学校信息'
    return
  }
  if (!courseName.value.trim()) {
    importError.value = '请输入课程名称'
    return
  }
  if (!className.value.trim()) {
    importError.value = '请输入班级名称'
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
      className: className.value.trim(),
      semester: semester.value,
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
.import-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.panel {
  border-radius: 24px;
  padding: 16px;
  margin-bottom: 10px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.panel-title {
  font-size: 22px;
  font-weight: 800;
  color: #232c42;
  margin-bottom: 8px;
}

.panel-sub {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.58);
  font-weight: 700;
}

.flow-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.flow-item {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.88);
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
}

.flow-index {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(76, 159, 255, 0.16);
  color: #2f7ddd;
  display: inline-grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
}

.flow-text {
  font-size: 13px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.78);
}

.flow-arrow {
  color: rgba(26, 29, 51, 0.4);
  font-size: 20px;
  font-weight: 700;
}

.hint-list {
  display: grid;
  gap: 8px;
}

.hint-item {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.72);
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-index {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: rgba(76, 159, 255, 0.16);
  color: #2f7ddd;
  font-size: 11px;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.form-item {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.7);
}

.form-item label {
  font-weight: 700;
}

.form-item input,
.form-item select {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.9);
  font-size: 13px;
  outline: none;
}

.form-item input[readonly] {
  color: rgba(26, 29, 51, 0.55);
}

.course-preview {
  margin-top: 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.password-tip {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #2f7ddd;
}

.preview-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
}

.preview-value {
  font-size: 13px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.82);
}

.import-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.upload-box {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  display: grid;
  gap: 12px;
}

.upload-box label {
  font-size: 14px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.75);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hidden-file-input {
  display: none;
}

.download-btn {
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
  padding: 9px 12px;
  background: rgba(76, 159, 255, 0.16);
  color: #2f7ddd;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.picker-btn {
  border: 1px solid rgba(76, 159, 255, 0.35);
  border-radius: 10px;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #2f7ddd;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.upload-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  background: linear-gradient(135deg, #4c9fff, #72d5df);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.upload-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.file-name {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
}

.file-display {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.88);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-tag {
  border-radius: 999px;
  background: rgba(47, 125, 221, 0.12);
  color: #2f7ddd;
  font-size: 11px;
  padding: 3px 8px;
  font-weight: 700;
}

.upload-error {
  color: #d64b4b;
  font-size: 12px;
}

.upload-success {
  color: #288b52;
  font-size: 12px;
}

.import-summary {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.88);
  padding: 10px;
}

.summary-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.summary-value {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 800;
  color: #28314b;
}

.summary-value.success {
  color: #1f9954;
}

.summary-value.warn {
  color: #d36c18;
}

.summary-meta {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.76);
  font-weight: 700;
}

.empty-summary {
  min-height: 86px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px dashed rgba(76, 159, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(26, 29, 51, 0.56);
  font-size: 13px;
  font-weight: 700;
}

.import-errors {
  margin-top: 12px;
}

.import-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.62);
}

.import-table th,
.import-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.72);
  font-size: 13px;
}

.import-table th {
  color: rgba(26, 29, 51, 0.7);
  font-weight: 700;
}

.import-table tr:last-child td {
  border-bottom: none;
}

@media (max-width: 980px) {
  .import-layout {
    grid-template-columns: 1fr;
  }
  .flow-row {
    grid-template-columns: 1fr;
  }
  .flow-arrow {
    display: none;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
