import { clearAuth, getAccessToken, getRefreshToken, setAuth, getUser } from './storage'

const API_BASE_STORAGE_KEY = 'miniapp.runtime.apiBaseUrl'
const DEFAULT_API_BASE_URL_DEVTOOLS = 'http://localhost:3000/api/v1'
const DEFAULT_API_BASE_URL_MOBILE = 'https://110-lab.cn/api/v1'
const ENV_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim()
const ENV_API_BASE_URL_MOBILE = String(import.meta.env.VITE_API_BASE_URL_MOBILE || '').trim()

function normalizeApiBaseUrl(value = '') {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) return ''
  return trimmed.replace(/\/+$/, '')
}

function isLocalhostApiBase(url = '') {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)
}

function getRuntimePlatform() {
  try {
    const info = uni.getSystemInfoSync?.() || {}
    return String(info.platform || '').toLowerCase()
  } catch {
    return ''
  }
}

function resolveApiBaseUrl() {
  const runtimeValue = normalizeApiBaseUrl(uni.getStorageSync(API_BASE_STORAGE_KEY))
  if (runtimeValue) return runtimeValue

  const platform = getRuntimePlatform()
  const envBase = normalizeApiBaseUrl(ENV_API_BASE_URL)
  if (envBase) {
    if (platform && platform !== 'devtools' && isLocalhostApiBase(envBase)) {
      return normalizeApiBaseUrl(ENV_API_BASE_URL_MOBILE) || DEFAULT_API_BASE_URL_MOBILE
    }
    return envBase
  }

  if (platform && platform !== 'devtools') {
    return normalizeApiBaseUrl(ENV_API_BASE_URL_MOBILE) || DEFAULT_API_BASE_URL_MOBILE
  }

  return DEFAULT_API_BASE_URL_DEVTOOLS
}

export const API_BASE_URL = resolveApiBaseUrl()
export function getApiBaseUrl() {
  return resolveApiBaseUrl()
}

export function setRuntimeApiBaseUrl(url) {
  const normalized = normalizeApiBaseUrl(url)
  if (!normalized) {
    uni.removeStorageSync(API_BASE_STORAGE_KEY)
    return ''
  }
  uni.setStorageSync(API_BASE_STORAGE_KEY, normalized)
  return normalized
}

function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalized}`
}

export function toAbsoluteUrl(path = '') {
  const value = String(path || '').trim()
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  const normalized = value.startsWith('/') ? value : `/${value}`
  const base = String(getApiBaseUrl() || '').trim()
  const match = /^(https?:\/\/[^/]+)/i.exec(base)
  if (match?.[1]) {
    return `${match[1]}${normalized}`
  }
  return normalized
}

function requestRaw(path, options = {}) {
  const {
    method = 'GET',
    data,
    headers = {},
  } = options
  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(path),
      method,
      data,
      header: headers,
      success: (res) => resolve(res),
      fail: (err) => {
        const errMsg = String(err?.errMsg || '')
        const platform = getRuntimePlatform()
        const activeBase = getApiBaseUrl()
        const isNameNotResolved = /ERR_NAME_NOT_RESOLVED/i.test(errMsg)
        const localhostHint =
          platform &&
          platform !== 'devtools' &&
          isLocalhostApiBase(activeBase)
            ? '当前 API 地址是 localhost，真机无法访问。请改为可访问的局域网 IP 或 HTTPS 域名。'
            : ''
        const dnsHint = isNameNotResolved
          ? `当前 API 域名无法解析：${activeBase}。请检查 DNS，或配置 VITE_API_BASE_URL_MOBILE 为可访问地址。`
          : ''
        const message = [errMsg || '网络请求失败', localhostHint, dnsHint].filter(Boolean).join(' ')
        reject(new Error(message))
      },
    })
  })
}

let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return ''
    const res = await requestRaw('/auth/refresh', {
      method: 'POST',
      data: { refreshToken },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.statusCode < 200 || res.statusCode >= 300 || !res.data?.data?.accessToken) {
      clearAuth()
      return ''
    }
    const user = getUser()
    setAuth({
      accessToken: res.data.data.accessToken,
      refreshToken: res.data.data.refreshToken || refreshToken,
      user,
    })
    return res.data.data.accessToken
  })()
  const token = await refreshPromise
  refreshPromise = null
  return token
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    data,
    auth = true,
    headers = {},
    skipRefresh = false,
  } = options

  const finalHeaders = { ...headers }
  const token = getAccessToken()
  if (auth && token) {
    finalHeaders.Authorization = `Bearer ${token}`
  }
  if (!finalHeaders['Content-Type'] && method !== 'GET') {
    finalHeaders['Content-Type'] = 'application/json'
  }

  const res = await requestRaw(path, { method, data, headers: finalHeaders })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data
  }

  if (
    auth &&
    !skipRefresh &&
    (res.statusCode === 401 || res.statusCode === 403) &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh')
  ) {
    const nextToken = await refreshAccessToken()
    if (nextToken) {
      return request(path, {
        ...options,
        skipRefresh: true,
        headers: {
          ...headers,
          Authorization: `Bearer ${nextToken}`,
        },
      })
    }
  }

  const message = res?.data?.message || `请求失败(${res.statusCode})`
  throw new Error(Array.isArray(message) ? message.join('；') : message)
}

export function uploadSubmissionMultipart({ assignmentId, answers, fileEntries }) {
  if (!fileEntries.length) {
    return request('/submissions/upload', {
      method: 'POST',
      data: {
        assignmentId,
        answers: JSON.stringify(answers),
      },
    })
  }

  const token = getAccessToken()
  return new Promise((resolve, reject) => {
    const url = buildUrl('/submissions/upload')
    const formData = {
      assignmentId,
      answers: JSON.stringify(answers),
    }

    if (fileEntries.length <= 1) {
      const only = fileEntries[0]
      uni.uploadFile({
        url,
        filePath: only?.path || '',
        name: only ? `files[${only.questionId}]` : 'files',
        formData,
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            resolve(JSON.parse(res.data || '{}'))
          } catch (err) {
            reject(new Error('提交响应解析失败'))
          }
        },
        fail: (err) => reject(err),
      })
      return
    }

    const files = fileEntries.map((entry) => ({
      name: `files[${entry.questionId}]`,
      uri: entry.path,
    }))

    uni.uploadFile({
      url,
      files,
      name: 'files',
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          resolve(JSON.parse(res.data || '{}'))
        } catch (err) {
          reject(new Error('提交响应解析失败'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}
