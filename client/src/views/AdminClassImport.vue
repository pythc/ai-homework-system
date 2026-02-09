<template>
  <AdminLayout
    title="班级导入"
    subtitle="批量注册学生与教师账号"
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
        <div class="hint-item">使用根目录的 "班级导入模板.xls"。</div>
        <div class="hint-item">列顺序：序号｜姓名｜学号/工号｜邮箱（可选）｜身份（学生/教师）。</div>
        <div class="hint-item">默认密码：cqupt + 学号/工号。</div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">导入文件</div>
      <div class="import-grid">
        <div class="upload-box">
          <label>选择 Excel 文件（.xls/.xlsx）</label>
          <input type="file" accept=".xls,.xlsx" @change="handleFileChange" />
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

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const selectedFile = ref(null)
const importError = ref('')
const importSuccess = ref('')
const importLoading = ref(false)
const result = ref(null)

const selectedFileName = computed(() => selectedFile.value?.name ?? '')

onMounted(async () => {
  await refreshProfile()
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

  importLoading.value = true
  try {
    const response = await registerBulkUsers(selectedFile.value)
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
