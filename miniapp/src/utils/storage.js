import { replacePage } from './navigation'

const ACCESS_TOKEN_KEY = 'miniapp.auth.accessToken'
const REFRESH_TOKEN_KEY = 'miniapp.auth.refreshToken'
const USER_KEY = 'miniapp.auth.user'
const DEVICE_ID_KEY = 'miniapp.auth.deviceId'

export function getAccessToken() {
  return uni.getStorageSync(ACCESS_TOKEN_KEY) || ''
}

export function getRefreshToken() {
  return uni.getStorageSync(REFRESH_TOKEN_KEY) || ''
}

export function getUser() {
  return uni.getStorageSync(USER_KEY) || null
}

export function setAuth(payload) {
  uni.setStorageSync(ACCESS_TOKEN_KEY, payload.accessToken)
  uni.setStorageSync(REFRESH_TOKEN_KEY, payload.refreshToken)
  uni.setStorageSync(USER_KEY, payload.user)
}

export function clearAuth() {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}

export function ensureDeviceId() {
  const existing = uni.getStorageSync(DEVICE_ID_KEY)
  if (existing) return existing
  const id = `wx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  uni.setStorageSync(DEVICE_ID_KEY, id)
  return id
}

export function requireStudent() {
  const token = getAccessToken()
  const user = getUser()
  if (!token || !user) {
    replacePage('/pages/login/index')
    return false
  }
  if (user.role !== 'STUDENT') {
    uni.showToast({ title: '当前仅支持学生端', icon: 'none' })
    return false
  }
  return true
}

export function requireTeacher() {
  const token = getAccessToken()
  const user = getUser()
  if (!token || !user) {
    replacePage('/pages/login/index')
    return false
  }
  if (user.role !== 'TEACHER') {
    uni.showToast({ title: '当前仅支持教师端', icon: 'none' })
    return false
  }
  return true
}
