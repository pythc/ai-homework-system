const ACCESS_TOKEN_KEY = 'auth.accessToken'
const REFRESH_TOKEN_KEY = 'auth.refreshToken'
const USER_KEY = 'auth.user'
const DEVICE_ID_KEY = 'auth.deviceId'

export type StoredUser = {
  userId: string
  role: string
  schoolId: string
  accountType: string
  account: string
  name?: string | null
}

function pickStorage(remember: boolean) {
  return remember ? localStorage : sessionStorage
}

export function saveAuth(payload: {
  accessToken: string
  refreshToken: string
  user: StoredUser
  remember: boolean
}) {
  const storage = pickStorage(payload.remember)

  storage.setItem(ACCESS_TOKEN_KEY, payload.accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(payload.user))

  const otherStorage = payload.remember ? sessionStorage : localStorage
  otherStorage.removeItem(ACCESS_TOKEN_KEY)
  otherStorage.removeItem(REFRESH_TOKEN_KEY)
  otherStorage.removeItem(USER_KEY)
}

export function getAccessToken() {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ??
    sessionStorage.getItem(ACCESS_TOKEN_KEY)
  )
}

export function getStoredUser(): StoredUser | null {
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch (err) {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export function ensureDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const deviceId = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}
