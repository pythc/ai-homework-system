<template>
  <div class="login-page">
    <!-- 顶部学校信息
    <div class="header">
      <img class="logo" src="" alt="logo" />
      <div class="title-box">
        <div class="title-cn">重庆邮电大学数学与统计学院</div>
        <div class="title-en">
          School of Mathematics and Statistics, Chongqing University of Posts and Telecommunications
        </div>
      </div>
    </div> -->

    <!-- 主体区域 -->
    <div class="main">
      <!-- 左侧欢迎区 -->
    <div class="welcome">
      <h1 class="welcome-hi">Hi，你好！</h1>
      <h2 class="welcome-title">欢迎进入作业管理系统</h2>
      <p class="welcome-sub">
        Hi, Welcome to the Homework management system
      </p>
    </div>


      <!-- 右侧登录卡片 -->
      <div class="login-card">
        <h2 class="login-title">登录</h2>

        <div class="form-item">
          <input
            v-model="username"
            type="text"
            placeholder="请输入统一认证号"
          />
        </div>

        <div class="form-item">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码(6-16位字母和数字)"
          />
        </div>

        <div class="options">
          <label>
            <input type="checkbox" v-model="remember" /> 记住密码
          </label>
        </div>

        <button class="login-btn" @click="handleLogin">登录</button>

        <!-- <div class="first-login" @click="goToResetPassword">
          第一次登录请点击此处修改密码
        </div> -->
      </div>
    </div>

    <!-- 底部 -->
    <div class="footer">
      技术支持：重庆邮电大学数学与统计学院SL110
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AccountType, login } from '../api/auth'
import { ensureDeviceId, saveAuth } from '../auth/storage'

const username = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const router = useRouter()

// 当前后端登录接口需要 schoolId 和 accountType。
// 为了匹配本地测试种子用户，默认使用 test-school + USERNAME。
const schoolId = import.meta.env.VITE_SCHOOL_ID ?? 'test-school'
const accountType = AccountType.USERNAME

const handleLogin = async () => {
  if (!username.value || !password.value) {
    window.alert('请输入账号和密码')
    return
  }
  if (loading.value) return

  loading.value = true
  try {
    const deviceId = ensureDeviceId()
    const response = await login({
      schoolId,
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

    window.alert('登录成功')
    // 目前还没有首页路由，先停留在登录页。
    // 后续可根据角色跳转到不同页面。
    router.replace('/login')
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败'
    window.alert(message)
  } finally {
    loading.value = false
  }
}

const goToResetPassword = () => {
  router.push('/reset-password')
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

/* 顶部 */
.header {
  position: absolute;
  top: 20px;
  left: 30px;
  display: flex;
  align-items: center;
  gap: 12px;
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

/* Hi, 你好！ */
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

/* 中文主标题 */
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

/* 英文副标题 */
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


/* 主体 */
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

/* 左侧欢迎 */
.welcome h1 {
  font-size: 64px;
  color: #ffffff;
  margin-bottom: 20px;
}

.welcome h2 {
  font-size: 40px;
  color: #ffffff;
  margin-bottom: 10px;
}

.welcome p {
  font-size: 20px;
  color: #f0f0f0;
}

/* 登录卡片 */
.login-card {
  width: 420px;
  padding: 40px 36px 36px;

  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));
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
  box-sizing: border-box;
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
}

.form-item input:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow:
    0 0 0 4px rgba(78, 132, 255, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.eye {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.options {
  margin-bottom: 26px;
  font-size: 14px;
  color: rgba(16, 53, 112, 0.8);
}

.login-btn {
  width: 100%;
  height: 48px;
  background:
    linear-gradient(135deg, rgba(74, 128, 255, 0.9), rgba(43, 108, 255, 0.75));
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

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 22px 38px rgba(38, 92, 214, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  filter: brightness(1.03);
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

.first-login {
  margin-top: 18px;
  text-align: center;
  color: #ff8c42;
  font-size: 14px;
  cursor: pointer;
}

/* 底部 */
.footer {
  position: absolute;
  bottom: 12px;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-size: 12px;
}
</style>
