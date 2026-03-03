<template>
  <view class="page ui-shell no-tab auth-page">
    <view class="ui-card brand-card" @longpress="onToggleApiConfig">
      <view class="brand-badge">S</view>
      <view class="brand-text">
        <view class="brand-title">STUDENT</view>
        <view class="brand-sub">作业管理中心</view>
      </view>
    </view>

    <view class="ui-card auth-card">
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

      <button class="ui-btn-primary submit-btn" :disabled="loading" @click="onLogin">
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
  gap: 24rpx;
}

.brand-card {
  padding: 26rpx 28rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.brand-card:active {
  opacity: 0.92;
}

.brand-badge {
  width: 70rpx;
  height: 70rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #ffb585 0%, #f5a365 100%);
  color: #fff;
  font-size: 34rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 20rpx rgba(241, 167, 101, 0.34);
}

.brand-title {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #1a2440;
}

.brand-sub {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.54);
}

.auth-card {
  padding: 32rpx 28rpx;
}

.field-group {
  margin-top: 16rpx;
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
}

.picker-arrow {
  color: rgba(26, 36, 64, 0.48);
  font-size: 28rpx;
}

.submit-btn {
  margin-top: 28rpx;
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  font-size: 30rpx;
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
</style>
