<template>
  <view class="page ui-shell no-tab auth-page">
    <view class="auth-bg auth-bg-left" />
    <view class="auth-bg auth-bg-right" />

    <image
      class="auth-ai-logo fx-fade-in"
      src="/static/images/ai-tab.png"
      mode="aspectFit"
      @longpress="onToggleApiConfig"
    />

    <view class="ui-card auth-card fx-scale-in fx-delay-1">
      <view class="ui-title">登录</view>
      <view class="ui-subtitle">使用现有账号登录系统</view>

      <view class="field-group">
        <view class="field-label">学校</view>
        <picker
          class="picker"
          mode="selector"
          :range="schools"
          range-key="name"
          :value="schoolIndex"
          @change="onSchoolChange"
        >
          <view class="ui-input picker-value">
            <text>{{ schools[schoolIndex]?.name || '请选择学校' }}</text>
            <text class="picker-arrow">▾</text>
          </view>
        </picker>
      </view>

      <view class="field-group">
        <view class="field-label">账号</view>
        <input v-model="form.account" class="ui-input" placeholder="请输入学号/工号" />
      </view>

      <view class="field-group">
        <view class="field-label">密码</view>
        <input v-model="form.password" class="ui-input" placeholder="请输入密码" password />
      </view>

      <button class="ui-btn-primary submit-btn fx-pulse-soft" :disabled="loading" @click="onLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <view class="api-hint">当前 API：{{ currentApiBase }}</view>

      <view v-if="showApiConfig" class="api-config">
        <view class="field-label">调试 API 地址</view>
        <input
          v-model="apiBaseInput"
          class="ui-input"
          placeholder="https://your-domain/api/v1"
        />
        <view class="api-actions">
          <button class="ui-btn-ghost api-btn" @click="onResetApiBase">恢复默认</button>
          <button class="ui-btn-primary api-btn" @click="onSaveApiBase">保存并重启</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { login } from '../../api/auth'
import { getAccessToken, getUser } from '../../utils/storage'
import { replacePage } from '../../utils/navigation'
import { getApiBaseUrl, setRuntimeApiBaseUrl } from '../../utils/http'

const loading = ref(false)
const schools = [
  {
    name: '重庆邮电大学',
    value: '重庆邮电大学',
    aliases: ['sch_1'],
  },
]
const schoolIndex = ref(0)
const showApiConfig = ref(false)
const currentApiBase = ref(getApiBaseUrl())
const apiBaseInput = ref(getApiBaseUrl())

const form = reactive({
  account: '',
  password: '',
})

onMounted(() => {
  const token = getAccessToken()
  const user = getUser()
  if (token && user?.role === 'STUDENT') {
    replacePage('/pages/student/courses')
  }
})

function refreshCurrentApiBase() {
  const value = getApiBaseUrl()
  currentApiBase.value = value
  apiBaseInput.value = value
}

function onToggleApiConfig() {
  showApiConfig.value = !showApiConfig.value
}

function onResetApiBase() {
  setRuntimeApiBaseUrl('')
  uni.showToast({ title: '已恢复默认地址', icon: 'none' })
  setTimeout(() => {
    replacePage('/pages/login/index')
  }, 200)
}

function onSaveApiBase() {
  const saved = setRuntimeApiBaseUrl(apiBaseInput.value)
  if (!saved) {
    uni.showToast({ title: 'API 地址格式不正确', icon: 'none' })
    return
  }
  uni.showToast({ title: '已保存，正在重启', icon: 'none' })
  setTimeout(() => {
    replacePage('/pages/login/index')
  }, 200)
}

function onSchoolChange(event) {
  const value = Number(event?.detail?.value ?? 0)
  schoolIndex.value = Number.isFinite(value) ? value : 0
}

async function onLogin() {
  const selectedSchool = schools[schoolIndex.value]
  const schoolCandidates = [
    selectedSchool?.value,
    selectedSchool?.name,
    ...(selectedSchool?.aliases || []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, idx, arr) => arr.indexOf(item) === idx)

  if (!schoolCandidates.length || !form.account || !form.password) {
    uni.showToast({ title: '请完整填写登录信息', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const accountTypes = ['USERNAME', 'STUDENT_ID']
    let user = null
    let lastError = null

    for (const schoolId of schoolCandidates) {
      for (const accountType of accountTypes) {
        try {
          user = await login({
            schoolId,
            accountType,
            account: form.account.trim(),
            password: form.password,
          })
          break
        } catch (err) {
          const message = err?.message || ''
          lastError = err
          if (
            !String(message).includes('账号或密码错误') &&
            !String(message).includes('请求失败(401)')
          ) {
            throw err
          }
        }
      }
      if (user) break
    }

    if (!user) {
      throw lastError || new Error('账号或密码错误')
    }

    if (user.role !== 'STUDENT') {
      uni.showToast({ title: '当前版本仅开放学生功能', icon: 'none' })
      loading.value = false
      return
    }

    replacePage('/pages/student/courses')
  } catch (err) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
    refreshCurrentApiBase()
  }
}
</script>

<style scoped>
.auth-page {
  justify-content: center;
  gap: 0;
  overflow: hidden;
}

.auth-ai-logo {
  width: 290rpx;
  height: 290rpx;
  align-self: center;
  margin-bottom: 34rpx;
  filter: drop-shadow(0 10rpx 20rpx rgba(40, 86, 170, 0.26));
  animation: logoFloat 3.8s ease-in-out infinite;
}

.auth-card {
  width: 92%;
  max-width: 680rpx;
  align-self: center;
  padding: 26rpx 22rpx;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.66));
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 20rpx 40rpx rgba(32, 78, 156, 0.14),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.85);
}

.field-group {
  margin-top: 14rpx;
  animation: fieldEnter 0.52s ease both;
}

.field-group:nth-of-type(1) {
  animation-delay: 0.06s;
}

.field-group:nth-of-type(2) {
  animation-delay: 0.12s;
}

.field-group:nth-of-type(3) {
  animation-delay: 0.18s;
}

.field-label {
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.64);
}

.picker-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.2s ease;
}

.picker:active .picker-value {
  transform: translateY(-1rpx);
}

.picker-arrow {
  color: rgba(26, 36, 64, 0.48);
  font-size: 28rpx;
}

.submit-btn {
  margin-top: 24rpx;
  width: 100%;
  height: 78rpx;
  line-height: 78rpx;
  font-size: 28rpx;
}

.api-hint {
  margin-top: 18rpx;
  font-size: 20rpx;
  color: rgba(26, 36, 64, 0.52);
  word-break: break-all;
}

.api-config {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 2rpx dashed rgba(151, 166, 197, 0.34);
}

.api-actions {
  margin-top: 14rpx;
  display: flex;
  gap: 12rpx;
}

.api-btn {
  flex: 1;
}

.auth-bg {
  position: absolute;
  border-radius: 9999rpx;
  pointer-events: none;
  z-index: 0;
}

.auth-bg-left {
  width: 360rpx;
  height: 360rpx;
  left: -120rpx;
  top: 6%;
  background: radial-gradient(circle, rgba(255, 192, 174, 0.42), rgba(255, 192, 174, 0));
  animation: blobDrift 8.6s ease-in-out infinite;
}

.auth-bg-right {
  width: 420rpx;
  height: 420rpx;
  right: -150rpx;
  bottom: 10%;
  background: radial-gradient(circle, rgba(162, 207, 255, 0.4), rgba(162, 207, 255, 0));
  animation: blobDrift 10.8s ease-in-out infinite reverse;
}

@keyframes fieldEnter {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logoFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5rpx);
  }
}

@keyframes blobDrift {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-14rpx);
  }
}
</style>
