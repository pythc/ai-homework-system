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
  createdAt?: string
  updatedAt?: string
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

export function getRefreshToken() {
  return (
    localStorage.getItem(REFRESH_TOKEN_KEY) ??
    sessionStorage.getItem(REFRESH_TOKEN_KEY)
  )
}

export function setTokens(tokens: { accessToken: string; refreshToken?: string }) {
  const hasLocal = localStorage.getItem(REFRESH_TOKEN_KEY)
  const hasSession = sessionStorage.getItem(REFRESH_TOKEN_KEY)
  const storage = hasLocal ? localStorage : hasSession ? sessionStorage : localStorage

  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  if (tokens.refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }

  const otherStorage = storage === localStorage ? sessionStorage : localStorage
  otherStorage.removeItem(ACCESS_TOKEN_KEY)
  otherStorage.removeItem(REFRESH_TOKEN_KEY)
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

export function updateStoredUser(patch: Partial<StoredUser>) {
  const localRaw = localStorage.getItem(USER_KEY)
  const sessionRaw = sessionStorage.getItem(USER_KEY)
  const targetRaw = localRaw ?? sessionRaw
  if (!targetRaw) return
  try {
    const user = JSON.parse(targetRaw) as StoredUser
    const next = { ...user, ...patch }
    if (localRaw) {
      localStorage.setItem(USER_KEY, JSON.stringify(next))
    } else {
      sessionStorage.setItem(USER_KEY, JSON.stringify(next))
    }
  } catch (err) {
    return
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
