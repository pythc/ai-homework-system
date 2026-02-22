<template>
  <div class="login-page reset-page">
    <div class="header">
      <img class="logo" src="" alt="logo" />
      <div class="title-box">
        <div class="title-cn">重庆邮电大学数学与统计学院</div>
        <div class="title-en">
          School of Mathematics and Statistics, Chongqing University of Posts and Telecommunications
        </div>
      </div>
    </div>

    <div class="main">
      <div class="welcome">
        <h1 class="welcome-hi">Hi，你好！</h1>
        <h2 class="welcome-title">欢迎进入作业管理系统</h2>
        <p class="welcome-sub">Hi, Welcome to the Homework management system</p>
      </div>

      <div class="login-card reset-card">
        <h2 class="login-title">修改密码</h2>

        <div class="form-item">
          <input v-model="email" type="email" placeholder="请输入邮箱" />
        </div>

        <div class="form-item code-row">
          <input v-model="code" type="text" placeholder="请输入验证码" />
          <button class="code-btn" type="button" :disabled="codeLoading" @click="handleSendCode">
            {{ codeLoading ? '发送中...' : '发送验证码' }}
          </button>
        </div>

        <div class="form-item">
          <input
            v-model="newPassword"
            :type="showNewPassword ? 'text' : 'password'"
            placeholder="请输入新密码(6-16位字母和数字)"
          />
          <span class="eye" @click="showNewPassword = !showNewPassword">
            <svg v-if="showNewPassword" viewBox="0 0 24 24" aria-hidden="true">
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

        <div class="form-item">
          <input
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="确认新密码(6-16位字母和数字)"
          />
          <span class="eye" @click="showConfirmPassword = !showConfirmPassword">
            <svg v-if="showConfirmPassword" viewBox="0 0 24 24" aria-hidden="true">
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
            <input type="checkbox" v-model="agree" /> 记住密码
          </label>
        </div>

        <button class="login-btn" type="button" :disabled="submitLoading" @click="handleResetPassword">
          {{ submitLoading ? '提交中...' : '提交修改' }}
        </button>

        <div class="first-login" @click="goBackToLogin">返回登录</div>
      </div>
    </div>

    <div class="footer">技术支持：重庆邮电大学数学与统计学院SL110</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const agree = ref(true)

const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const codeLoading = ref(false)
const submitLoading = ref(false)

const handleSendCode = async () => {
  if (!email.value) {
    console.warn('请先输入邮箱')
    return
  }

  codeLoading.value = true
  try {
    // TODO: 调用发送验证码接口，例如：
    // await api.auth.sendResetCode({ email: email.value })
    console.log('send code ->', { email: email.value })
  } finally {
    codeLoading.value = false
  }
}

const handleResetPassword = async () => {
  if (!email.value || !code.value || !newPassword.value || !confirmPassword.value) {
    console.warn('请完整填写表单')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    console.warn('两次密码输入不一致')
    return
  }

  submitLoading.value = true
  try {
    // TODO: 调用重置密码接口，例如：
    // await api.auth.resetPassword({
    //   email: email.value,
    //   code: code.value,
    //   newPassword: newPassword.value,
    // })
    console.log('reset password ->', {
      email: email.value,
      code: code.value,
      newPassword: newPassword.value,
      agree: agree.value,
    })

    // 成功后返回登录页
    router.push('/login')
  } finally {
    submitLoading.value = false
  }
}

const goBackToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  background:
    radial-gradient(1200px 600px at -10% -20%, rgba(255, 255, 255, 0.55), transparent 60%),
    radial-gradient(900px 500px at 110% 10%, rgba(180, 205, 255, 0.45), transparent 65%),
    linear-gradient(135deg, #8fb0d8 0%, #a8c3e6 55%, #8eaed6 100%);
  position: relative;
  overflow: hidden;
  font-family: "Microsoft YaHei", Arial, sans-serif;
}

.login-page::before,
.login-page::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.55;
  pointer-events: none;
}

.login-page::before {
  width: 420px;
  height: 420px;
  left: -120px;
  top: 12%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.15));
}

.login-page::after {
  width: 520px;
  height: 520px;
  right: -180px;
  bottom: -120px;
  background: radial-gradient(circle at 40% 40%, rgba(140, 185, 255, 0.85), rgba(255, 255, 255, 0.1));
}

.header {
  position: absolute;
  top: 20px;
  left: 30px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1;
}

.logo {
  width: 48px;
  height: 48px;
}

.title-cn {
  font-size: 18px;
  font-weight: bold;
  color: #0b3a78;
}

.title-en {
  font-size: 12px;
  color: #0b3a78;
}

.welcome {
  color: #ffffff;
  text-align: left;
  position: relative;
  z-index: 1;
  animation: welcomeEnter 0.9s ease-out both;
}

.welcome-hi {
  font-size: 72px;
  font-weight: 800;
  margin-bottom: 20px;
  letter-spacing: 1px;
  line-height: 1.05;
  position: relative;
  display: inline-block;
  padding-right: 6px;
  background: linear-gradient(120deg, #ffffff 0%, #e8f1ff 45%, #ffffff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.6);
  text-shadow:
    0 10px 24px rgba(22, 70, 150, 0.28),
    0 2px 6px rgba(255, 255, 255, 0.45);
  animation: textFloat 4.6s ease-in-out 0.6s infinite;
}

.welcome-title {
  font-size: 42px;
  font-weight: 600;
  margin-bottom: 16px;
  letter-spacing: 2px;
  line-height: 1.25;
  position: relative;
  display: inline-block;
  background: linear-gradient(125deg, #ffffff 0%, #dbe9ff 55%, #ffffff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.58);
  text-shadow:
    0 14px 30px rgba(20, 75, 170, 0.3),
    0 3px 10px rgba(255, 255, 255, 0.45);
  animation: textShimmer 6s ease-in-out 1.1s infinite;
}

.welcome-sub {
  font-size: 20px;
  font-weight: 400;
  letter-spacing: 0.5px;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.92);
  text-shadow:
    0 8px 22px rgba(19, 73, 168, 0.26),
    0 2px 6px rgba(255, 255, 255, 0.35);
  opacity: 0;
  animation: subEnter 0.8s ease-out 0.35s forwards;
}

.main {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.login-card {
  width: 420px;
  padding: 40px 36px 36px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow:
    0 28px 60px rgba(15, 60, 120, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -12px 24px rgba(255, 255, 255, 0.12);
  position: relative;
  overflow: hidden;
  animation: cardEnter 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
}

.login-card::before {
  content: "";
  position: absolute;
  inset: -40% 60% 60% -20%;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0));
  transform: rotate(8deg);
  pointer-events: none;
  opacity: 0.7;
}

.login-title {
  text-align: center;
  font-size: 28px;
  color: #1e4fd6;
  margin-bottom: 30px;
  letter-spacing: 1px;
}

.form-item {
  position: relative;
  margin-bottom: 22px;
}

.form-item input {
  width: 100%;
  height: 46px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 0 14px;
  font-size: 15px;
  outline: none;
  color: #0b2a5b;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 10px 18px rgba(31, 90, 180, 0.08);
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-item input:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow:
    0 0 0 4px rgba(78, 132, 255, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.code-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.code-row input {
  flex: 1;
}

.code-btn {
  height: 46px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.72);
  color: #1e4fd6;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 10px 18px rgba(31, 90, 180, 0.08);
  white-space: nowrap;
}

.code-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.code-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.eye {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  user-select: none;
  color: rgba(16, 53, 112, 0.75);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.eye svg {
  width: 18px;
  height: 18px;
}

.options {
  margin-bottom: 26px;
  font-size: 14px;
  color: rgba(16, 53, 112, 0.8);
}

.login-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, rgba(74, 128, 255, 0.9), rgba(43, 108, 255, 0.75));
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  font-size: 18px;
  cursor: pointer;
  box-shadow:
    0 18px 32px rgba(38, 92, 214, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 22px 38px rgba(38, 92, 214, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  filter: brightness(1.03);
}

.login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.first-login {
  margin-top: 18px;
  text-align: center;
  color: #ff8c42;
  font-size: 14px;
  cursor: pointer;
}

.footer {
  position: absolute;
  bottom: 12px;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-size: 12px;
  z-index: 1;
}

@keyframes welcomeEnter {
  0% {
    opacity: 0;
    transform: translateY(26px) scale(0.98);
    filter: blur(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes subEnter {
  0% {
    opacity: 0;
    transform: translateY(14px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cardEnter {
  0% {
    opacity: 0;
    transform: translateX(36px) scale(0.97);
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
    filter: blur(0);
  }
}

@keyframes textFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes textShimmer {
  0%,
  100% {
    text-shadow:
      0 14px 30px rgba(20, 75, 170, 0.3),
      0 3px 10px rgba(255, 255, 255, 0.45);
    filter: brightness(1);
  }
  50% {
    text-shadow:
      0 18px 36px rgba(36, 98, 205, 0.34),
      0 6px 16px rgba(255, 255, 255, 0.55);
    filter: brightness(1.05);
  }
}
</style>
