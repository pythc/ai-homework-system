<template>
  <StudentLayout
    title="个人主页"
    subtitle="今天也要保持节奏～"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="学习面板"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }} </div>
          <div class="topbar-id">学号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="overview">
      <div class="stat-card glass stat-card-wide">
        <div class="stat-main">
          <div class="stat-label">未截止作业</div>
          <div class="stat-value">{{ openAssignmentCount }}</div>
        </div>
        <div class="stat-side">
          <div class="stat-side-item">
            <div class="stat-side-label">已提交</div>
            <div class="stat-side-value">{{ submittedTasks.length }}</div>
          </div>
          <div class="stat-side-item">
            <div class="stat-side-label">未提交</div>
            <div class="stat-side-value">{{ pendingTasks.length }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel glass">
        <div class="panel-title">
          未提交作业
          <span class="badge">{{ pendingTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in pendingTasks" :key="task.title" class="task-card">
            <div class="task-head">
              <div>
                <div class="task-title">{{ task.title }}</div>
                <div class="task-sub">{{ task.course }}</div>
              </div>
              <div class="task-deadline">{{ task.deadline }}</div>
            </div>
            <div class="task-progress">
              <div class="progress-meta">
                <span>{{ task.level }}</span>
              </div>
            </div>
            <button class="task-action">继续作业</button>
          </div>
          <div v-if="!pendingTasks.length" class="task-empty">
            {{ assignmentError || '暂无未提交作业' }}
          </div>
        </div>
      </div>

      <div class="panel glass">
        <div class="panel-title">
          已提交作业
          <span class="badge">{{ submittedTasks.length }} 份</span>
        </div>
        <div class="task-list">
          <div v-for="task in submittedTasks" :key="task.title" class="task-card">
            <div class="task-head">
              <div>
                <div class="task-title">{{ task.title }}</div>
                <div class="task-sub">{{ task.course }}</div>
              </div>
              <div class="task-deadline">{{ task.deadline }}</div>
            </div>
            <div class="task-progress">
              <div class="progress-meta">
                <span>{{ task.level }}</span>
              </div>
            </div>
          </div>
          <div v-if="!submittedTasks.length" class="task-empty">
            {{ assignmentError || '暂无已提交作业' }}
          </div>
        </div>
      </div>
    </section>

    <RouterLink to="/student/assistant" class="floating-ai" aria-label="AI assistant">
      <span>AI</span>
    </RouterLink>
  </StudentLayout>

  <div v-if="showPasswordModal" class="password-modal">
    <div class="password-card glass">
      <div class="password-title">首次登录请修改密码</div>
      <div class="password-subtitle">为保障账号安全，请先设置新密码。</div>
      <div class="password-form">
        <input
          v-model="currentPassword"
          type="password"
          placeholder="当前密码"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="新密码（至少 6 位）"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="确认新密码"
        />
      </div>
      <div v-if="passwordError" class="password-error">{{ passwordError }}</div>
      <button
        class="password-submit"
        :disabled="passwordLoading"
        @click="submitPasswordChange"
      >
        {{ passwordLoading ? '提交中...' : '确认修改' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import StudentLayout from '../components/StudentLayout.vue'
import { changePassword } from '../api/auth'
import { listOpenAssignments } from '../api/assignment'
import { getAccessToken, getStoredUser, updateStoredUser } from '../auth/storage'
import { useStudentProfile } from '../composables/useStudentProfile'

const { storedUser, profileName, profileAccount, refreshProfile } =
  useStudentProfile()

const showPasswordModal = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const assignmentItems = ref([])
const assignmentError = ref('')

const requiresPasswordChange = computed(() => {
  const user = storedUser.value
  if (!user || user.role !== 'STUDENT') return false
  if (!user.createdAt || !user.updatedAt) return false
  return user.createdAt === user.updatedAt
})

const submitPasswordChange = async () => {
  passwordError.value = ''
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = '请完整填写所有字段'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  if (passwordLoading.value) return
  passwordLoading.value = true
  try {
    await changePassword(
      {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value,
      },
      getAccessToken(),
    )

    updateStoredUser({ updatedAt: new Date().toISOString() })
    storedUser.value = getStoredUser()
    showPasswordModal.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    passwordError.value = err instanceof Error ? err.message : '修改失败'
  } finally {
    passwordLoading.value = false
  }
}

const formatDeadline = (deadline) => {
  if (!deadline) return '未设置截止时间'
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return '未设置截止时间'
  return `截止 ${date.toLocaleDateString('zh-CN')}`
}

const taskList = computed(() =>
  assignmentItems.value.map((item) => ({
    title: item.title,
    course: item.courseName ?? item.courseId,
    deadline: formatDeadline(item.deadline),
    submitted: Boolean(item.submitted),
    level: item.submitted ? '已提交' : '未提交',
  })),
)

const pendingTasks = computed(() =>
  taskList.value.filter((task) => !task.submitted),
)

const submittedTasks = computed(() =>
  taskList.value.filter((task) => task.submitted),
)

const openAssignmentCount = computed(() => taskList.value.length)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const forceModal = params.get('forcePasswordModal') === '1'
  const token = getAccessToken()

  if (token) {
    await refreshProfile()
  }

  try {
    const response = await listOpenAssignments()
    assignmentItems.value = response?.items ?? []
  } catch (err) {
    assignmentError.value = err instanceof Error ? err.message : '加载作业失败'
  }

  if (forceModal || requiresPasswordChange.value) {
    showPasswordModal.value = true
  }
})
</script>

<style scoped>
.password-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 20, 40, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 99;
  animation: fadeIn 0.35s ease;
}

.password-card {
  width: min(420px, 86vw);
  padding: 26px 24px 22px;
  border-radius: 22px;
  display: grid;
  gap: 12px;
}

.password-title {
  font-size: 18px;
  font-weight: 700;
}

.password-subtitle {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.password-form {
  display: grid;
  gap: 10px;
  margin-top: 6px;
}

.password-form input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}

.password-form input:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(78, 132, 255, 0.18);
}

.password-error {
  color: #e76464;
  font-size: 12px;
}

.password-submit {
  border: none;
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.9), rgba(129, 228, 194, 0.9));
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.password-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
