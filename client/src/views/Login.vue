<template>
  <div class="login-page">
    <div class="login-shell">
      <section class="showcase-pane">
        <div class="brand-corner">
          <img class="brand-logo" src="/ai-tab.png" alt="智评学堂" />
          <span class="brand-text">智评学堂</span>
        </div>

        <div class="showcase-mask" />
        <div class="showcase-glass">
          <p class="showcase-quote">“作业布置、AI批改、学情分析，一套系统完成教学闭环。”</p>
          <div class="showcase-person"></div>
          <p class="showcase-quote secondary">“让批改更高效，让反馈更及时，让教学更有支撑”</p>
          <div class="showcase-stars" aria-hidden="true"></div>
        </div>
      </section>

      <section class="auth-pane">
        <div class="auth-card">
          <h1 class="auth-title">Welcome back</h1>

          <form class="login-form" @submit.prevent="handleLogin">
            <div class="form-item">
              <label class="field-label">学校</label>
              <div class="school-select" :class="{ open: isSchoolOpen }" @click="toggleSchool">
                <div class="school-value" :class="{ placeholder: !schoolId }">
                  {{ schoolId || '请选择学校' }}
                </div>
                <span class="school-arrow" />
                <div v-if="isSchoolOpen" class="school-dropdown" @click.stop>
                  <button
                    v-for="school in schools"
                    :key="school"
                    type="button"
                    class="school-option"
                    :class="{ active: schoolId === school }"
                    @click="selectSchool(school)"
                  >
                    {{ school }}
                  </button>
                </div>
              </div>
            </div>

            <div class="form-item">
              <label class="field-label">学号/工号</label>
              <input
                v-model="username"
                type="text"
                placeholder="请输入学号/工号"
                autocomplete="username"
              />
            </div>

            <div class="form-item">
              <label class="field-label">密码</label>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <span class="eye" @click="showPassword = !showPassword">
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12Z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 5l16 14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                  <path
                    d="M3 12s3.6-6.5 9-6.5c2.6 0 4.8 1 6.5 2.4M21 12s-1.5 2.6-4.2 4.6c-1.4 1-3 1.6-4.8 1.6-5.4 0-9-6.1-9-6.1"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                  <path
                    d="M10.2 9.2a3.5 3.5 0 0 0 4.6 4.6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
            </div>

            <div class="options">
              <label>
                <input type="checkbox" v-model="remember" /> 记住密码
              </label>
              <span class="forgot-tip">忘记密码请联系管理员</span>
            </div>

            <div v-if="errorMessage" class="login-error">
              {{ errorMessage }}
            </div>

            <button class="login-btn" type="submit" :disabled="loading">
              {{ loading ? '登录中...' : '登录' }}
            </button>
          </form>
        </div>
        <div class="support-line">© 2026 重庆邮电大学数学与统计学院110实验室 · All Rights Reserved</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AccountType, login } from '../api/auth'
import { ensureDeviceId, saveAuth } from '../auth/storage'

const username = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const router = useRouter()

const parseSchools = (raw) => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const normalizeSchools = (raw) =>
  raw
    ?.map((item) => {
      if (typeof item === 'string') return item
      return item?.name ?? item?.id ?? null
    })
    .filter(Boolean) ?? null

const fallbackSchoolName = (import.meta.env.VITE_SCHOOL_NAME || '重庆邮电大学').trim()
const schools =
  normalizeSchools(parseSchools(import.meta.env.VITE_SCHOOLS)) ??
  [fallbackSchoolName].filter(Boolean)
const schoolId = ref('')
const isSchoolOpen = ref(false)
const accountType = AccountType.USERNAME
const REMEMBER_FLAG_KEY = 'login.remember.enabled'
const REMEMBER_ACCOUNT_KEY = 'login.remember.account'
const REMEMBER_PASSWORD_KEY = 'login.remember.password'
const REMEMBER_SCHOOL_KEY = 'login.remember.school'

const toggleSchool = () => {
  isSchoolOpen.value = !isSchoolOpen.value
}

const selectSchool = (school) => {
  schoolId.value = school
  isSchoolOpen.value = false
}

const handleOutsideClick = (event) => {
  const target = event.target
  if (target?.closest?.('.school-select')) return
  isSchoolOpen.value = false
}

const clearRememberedLogin = () => {
  try {
    localStorage.removeItem(REMEMBER_ACCOUNT_KEY)
    localStorage.removeItem(REMEMBER_PASSWORD_KEY)
    localStorage.removeItem(REMEMBER_SCHOOL_KEY)
    localStorage.setItem(REMEMBER_FLAG_KEY, '0')
  } catch {
    // ignore
  }
}

const persistRememberedLogin = () => {
  if (!remember.value) {
    clearRememberedLogin()
    return
  }
  try {
    localStorage.setItem(REMEMBER_FLAG_KEY, '1')
    localStorage.setItem(REMEMBER_ACCOUNT_KEY, username.value.trim())
    localStorage.setItem(REMEMBER_PASSWORD_KEY, password.value)
    if (schoolId.value) {
      localStorage.setItem(REMEMBER_SCHOOL_KEY, schoolId.value)
    } else {
      localStorage.removeItem(REMEMBER_SCHOOL_KEY)
    }
  } catch {
    // ignore
  }
}

const loadRememberedLogin = () => {
  if (!schoolId.value && schools.length === 1) {
    schoolId.value = schools[0]
  }
  try {
    const rememberFlag = localStorage.getItem(REMEMBER_FLAG_KEY)
    if (rememberFlag === null) return
    const remembered = rememberFlag === '1'
    remember.value = remembered
    if (!remembered) return

    const savedSchool = localStorage.getItem(REMEMBER_SCHOOL_KEY) || ''
    const savedAccount = localStorage.getItem(REMEMBER_ACCOUNT_KEY) || ''
    const savedPassword = localStorage.getItem(REMEMBER_PASSWORD_KEY) || ''

    if (savedSchool && schools.includes(savedSchool)) {
      schoolId.value = savedSchool
    }
    if (savedAccount) {
      username.value = savedAccount
    }
    if (savedPassword) {
      password.value = savedPassword
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  loadRememberedLogin()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})

watch(remember, (enabled) => {
  if (enabled) return
  clearRememberedLogin()
})

const handleLogin = async () => {
  errorMessage.value = ''
  if (!schoolId.value) {
    errorMessage.value = '请选择学校'
    return
  }
  if (!username.value || !password.value) {
    errorMessage.value = '请输入账号和密码'
    return
  }
  if (loading.value) return

  loading.value = true
  try {
    const deviceId = ensureDeviceId()
    const response = await login({
      schoolId: schoolId.value,
      accountType,
      account: username.value.trim(),
      password: password.value,
      deviceId,
    })

    saveAuth({
      accessToken: response.data.token.accessToken,
      refreshToken: response.data.token.refreshToken,
      user: response.data.user,
      remember: remember.value,
    })
    persistRememberedLogin()

    const role = response.data.user?.role
    if (role === 'ADMIN') {
      router.replace('/admin')
    } else if (role === 'TEACHER') {
      router.replace('/teacher')
    } else {
      router.replace('/student')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败'
    errorMessage.value = message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background: #eaedf2;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  display: flex;
  flex-direction: column;
}

.brand-corner {
  position: absolute;
  top: 26px;
  left: 28px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-text {
  color: #081a3f;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 2px;
  text-shadow: 0 3px 10px rgba(228, 241, 255, 0.8);
}

.brand-logo {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}

.login-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(520px, 1fr) minmax(420px, 540px);
  gap: 18px;
  padding: 18px;
  box-sizing: border-box;
}

.showcase-pane {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(130% 120% at 8% 0%, rgba(238, 247, 255, 0.88), rgba(204, 227, 255, 0.4) 46%, transparent 70%),
    radial-gradient(110% 100% at 88% 82%, rgba(173, 208, 255, 0.42), transparent 66%),
    linear-gradient(138deg, #d4e8ff 0%, #bad9ff 44%, #a7ceff 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.56),
    0 22px 42px rgba(95, 138, 201, 0.28);
}

.showcase-pane::before {
  content: '';
  position: absolute;
  inset: -8% -4% -8% -4%;
  background:
    repeating-linear-gradient(
      110deg,
      rgba(255, 255, 255, 0.28) 0 24px,
      rgba(156, 194, 246, 0.09) 24px 44px
    ),
    linear-gradient(102deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0));
  transform: perspective(900px) rotateY(6deg) scale(1.04);
  transform-origin: left center;
}

.showcase-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 74% 24%, rgba(255, 255, 255, 0.44), transparent 32%),
    radial-gradient(circle at 66% 76%, rgba(210, 232, 255, 0.42), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(128, 171, 231, 0.22));
  backdrop-filter: blur(2.5px);
  -webkit-backdrop-filter: blur(2.5px);
}

.showcase-glass {
  position: absolute;
  left: 52px;
  right: 52px;
  bottom: 52px;
  padding: 34px 30px 28px;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(237, 247, 255, 0.48), rgba(213, 233, 255, 0.3));
  border: 1px solid rgba(238, 247, 255, 0.82);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.36),
    0 16px 34px rgba(92, 136, 198, 0.28);
}

.showcase-quote {
  margin: 0;
  font-size: 42px;
  line-height: 2;
  letter-spacing: 0.3px;
  color: rgba(18, 58, 112, 0.88);
  text-shadow: 0 2px 10px rgba(237, 248, 255, 0.9);
  font-weight: 700;
}

.showcase-quote.secondary {
  margin-top: 22px;
  font-size: 25px;
}

.showcase-person {
  margin-top: 26px;
}

.showcase-name {
  font-size: 23px;
  font-weight: 700;
  color: #2f67b5;
}

.showcase-role {
  margin-top: 4px;
  font-size: 14px;
  color: rgba(62, 105, 168, 0.85);
}

.showcase-stars {
  margin-top: 18px;
  font-size: 20px;
  letter-spacing: 6px;
  color: rgba(80, 122, 184, 0.9);
}

.auth-pane {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 20px 42px;
  border-radius: 24px;
  background: #f7f8fb;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.95),
    0 20px 34px rgba(28, 43, 72, 0.12);
}

.auth-card {
  width: min(410px, 100%);
  animation: authEnter 0.55s ease-out;
}

.auth-title {
  margin: 0 0 28px;
  font-size: 46px;
  line-height: 1.08;
  letter-spacing: -0.5px;
  color: #081a3f;
  font-weight: 750;
  animation: authTitleFloat 4.8s ease-in-out infinite;
}

.form-item {
  position: relative;
  margin-bottom: 20px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  color: #122042;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

.form-item input,
.school-select {
  width: 100%;
  box-sizing: border-box;
  height: 48px;
  border: 1px solid #cdd4e3;
  border-radius: 12px;
  background: #ffffff;
  color: #122042;
  font-size: 15px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-item input {
  padding: 0 14px;
}

.form-item input:focus,
.school-select.open,
.school-select:hover {
  border-color: #5b76be;
  box-shadow: 0 0 0 3px rgba(79, 107, 176, 0.14);
  outline: none;
}

.school-select {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 42px 0 14px;
  cursor: pointer;
}

.school-value {
  color: #1a2b53;
  user-select: none;
}

.school-value.placeholder {
  color: #8190b2;
}

.school-arrow {
  position: absolute;
  right: 16px;
  width: 9px;
  height: 9px;
  border-right: 2px solid #4b5f90;
  border-bottom: 2px solid #4b5f90;
  transform: rotate(45deg);
  transition: transform 0.18s ease;
}

.school-select.open .school-arrow {
  transform: rotate(-135deg);
  top: 22px;
}

.school-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  padding: 8px;
  border-radius: 14px;
  border: 1px solid #d6ddee;
  background: #fff;
  box-shadow: 0 14px 26px rgba(29, 41, 65, 0.15);
  z-index: 10;
}

.school-option {
  width: 100%;
  border: 0;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  padding: 10px 12px;
  color: #1b2a4f;
  cursor: pointer;
  transition: background 0.16s ease;
}

.school-option + .school-option {
  margin-top: 4px;
}

.school-option:hover {
  background: #eef3ff;
}

.school-option.active {
  background: #dde8ff;
  color: #10327a;
}

.eye {
  position: absolute;
  right: 13px;
  bottom: 13px;
  cursor: pointer;
  color: #66759a;
  display: inline-flex;
}

.eye svg {
  width: 20px;
  height: 20px;
}

.form-item input[type='password']::-ms-reveal,
.form-item input[type='password']::-ms-clear {
  display: none;
}

.options {
  margin: 4px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #445173;
  font-size: 13px;
}

.options label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.forgot-tip {
  color: #6978a0;
}

.login-error {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff0f0;
  color: #b12a2a;
  border: 1px solid #f1cccc;
  font-size: 13px;
}

.login-btn {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(110deg, #0b1636 0%, #10244e 52%, #0f1e3f 100%);
  color: #fff;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(11, 22, 54, 0.28);
}

.login-btn:disabled {
  opacity: 0.64;
  cursor: not-allowed;
}

.support-line {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  text-align: center;
  color: #6b7898;
  font-size: 12px;
  letter-spacing: 0.2px;
}

@keyframes authEnter {
  0% {
    opacity: 0;
    transform: translateX(20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes authTitleFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@media (max-width: 1200px) {
  .login-shell {
    grid-template-columns: minmax(420px, 1fr) minmax(380px, 500px);
  }

  .showcase-quote {
    font-size: 30px;
  }

  .showcase-quote.secondary {
    font-size: 24px;
  }
}

@media (max-width: 980px) {
  .brand-corner {
    top: 14px;
    left: 14px;
    gap: 10px;
  }

  .brand-text {
    font-size: 24px;
  }

  .brand-logo {
    width: 44px;
    height: 44px;
  }

  .login-shell {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .showcase-pane {
    min-height: 320px;
  }

  .showcase-glass {
    left: 18px;
    right: 18px;
    bottom: 18px;
    padding: 20px;
  }

  .showcase-quote,
  .showcase-quote.secondary {
    font-size: 20px;
  }

  .auth-pane {
    padding: 24px 16px 42px;
  }

  .auth-title {
    font-size: 36px;
  }
}
</style>
