const ACCESS_TOKEN_KEY = 'auth.accessToken'
const REFRESH_TOKEN_KEY = 'auth.refreshToken'
const USER_KEY = 'auth.user'
const DEVICE_ID_KEY = 'auth.deviceId'
const STORAGE_KEY = 'auth.storage'
const SCOPE_KEY = 'auth.scope'

type AuthScope = 'student' | 'teacher' | 'admin'

function resolveScope(role?: string | null): AuthScope {
  if (role === 'ADMIN') return 'admin'
  if (role === 'TEACHER') return 'teacher'
  return 'student'
}

function getScopedKey(base: string, scope: AuthScope) {
  return `${base}.${scope}`
}

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

function setActiveStorage(storage: Storage) {
  const value = storage === localStorage ? 'local' : 'session'
  storage.setItem(STORAGE_KEY, value)
  const otherStorage = storage === localStorage ? sessionStorage : localStorage
  otherStorage.removeItem(STORAGE_KEY)
}

function getActiveStorage(): Storage | null {
  const localValue = localStorage.getItem(STORAGE_KEY)
  if (localValue === 'local') return localStorage
  const sessionValue = sessionStorage.getItem(STORAGE_KEY)
  if (sessionValue === 'session') return sessionStorage
  return null
}

export function setCurrentAuthScope(scope: AuthScope) {
  localStorage.setItem(SCOPE_KEY, scope)
}

export function getCurrentAuthScope(): AuthScope {
  const value = localStorage.getItem(SCOPE_KEY)
  if (value === 'teacher' || value === 'admin' || value === 'student') {
    return value
  }
  return 'student'
}

export function saveAuth(payload: {
  accessToken: string
  refreshToken: string
  user: StoredUser
  remember: boolean
}) {
  const storage = pickStorage(payload.remember)
  const scope = resolveScope(payload.user?.role)

  storage.setItem(getScopedKey(ACCESS_TOKEN_KEY, scope), payload.accessToken)
  storage.setItem(getScopedKey(REFRESH_TOKEN_KEY, scope), payload.refreshToken)
  storage.setItem(getScopedKey(USER_KEY, scope), JSON.stringify(payload.user))
  setActiveStorage(storage)
  setCurrentAuthScope(scope)

  const otherStorage = payload.remember ? sessionStorage : localStorage
  otherStorage.removeItem(getScopedKey(ACCESS_TOKEN_KEY, scope))
  otherStorage.removeItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
  otherStorage.removeItem(getScopedKey(USER_KEY, scope))
}

export function getAccessToken(scope = getCurrentAuthScope()) {
  const storage = getActiveStorage()
  const scopedKey = getScopedKey(ACCESS_TOKEN_KEY, scope)
  if (storage) {
    return storage.getItem(scopedKey)
  }
  return localStorage.getItem(scopedKey) ?? sessionStorage.getItem(scopedKey)
}

export function getRefreshToken(scope = getCurrentAuthScope()) {
  const storage = getActiveStorage()
  const scopedKey = getScopedKey(REFRESH_TOKEN_KEY, scope)
  if (storage) {
    return storage.getItem(scopedKey)
  }
  return localStorage.getItem(scopedKey) ?? sessionStorage.getItem(scopedKey)
}

export function setTokens(
  tokens: { accessToken: string; refreshToken?: string },
  scope = getCurrentAuthScope(),
) {
  const active = getActiveStorage()
  const hasLocal = localStorage.getItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
  const hasSession = sessionStorage.getItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
  const storage =
    active ??
    (hasLocal ? localStorage : hasSession ? sessionStorage : localStorage)

  storage.setItem(getScopedKey(ACCESS_TOKEN_KEY, scope), tokens.accessToken)
  if (tokens.refreshToken) {
    storage.setItem(getScopedKey(REFRESH_TOKEN_KEY, scope), tokens.refreshToken)
  }
  setActiveStorage(storage)
  setCurrentAuthScope(scope)

  const otherStorage = storage === localStorage ? sessionStorage : localStorage
  otherStorage.removeItem(getScopedKey(ACCESS_TOKEN_KEY, scope))
  otherStorage.removeItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
}

export function getStoredUser(scope = getCurrentAuthScope()): StoredUser | null {
  const storage = getActiveStorage()
  const scopedKey = getScopedKey(USER_KEY, scope)
  const raw = storage
    ? storage.getItem(scopedKey)
    : localStorage.getItem(scopedKey) ?? sessionStorage.getItem(scopedKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch (err) {
    return null
  }
}

export function updateStoredUser(
  patch: Partial<StoredUser>,
  scope = getCurrentAuthScope(),
) {
  const storage = getActiveStorage()
  const localRaw = storage ? null : localStorage.getItem(getScopedKey(USER_KEY, scope))
  const sessionRaw = storage ? null : sessionStorage.getItem(getScopedKey(USER_KEY, scope))
  const targetRaw =
    storage?.getItem(getScopedKey(USER_KEY, scope)) ?? localRaw ?? sessionRaw
  if (!targetRaw) return
  try {
    const user = JSON.parse(targetRaw) as StoredUser
    const next = { ...user, ...patch }
    if (storage) {
      storage.setItem(getScopedKey(USER_KEY, scope), JSON.stringify(next))
    } else if (localRaw) {
      localStorage.setItem(getScopedKey(USER_KEY, scope), JSON.stringify(next))
    } else {
      sessionStorage.setItem(getScopedKey(USER_KEY, scope), JSON.stringify(next))
    }
  } catch (err) {
    return
  }
}

export function clearAuth() {
  for (const scope of ['student', 'teacher', 'admin'] as AuthScope[]) {
    localStorage.removeItem(getScopedKey(ACCESS_TOKEN_KEY, scope))
    localStorage.removeItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
    localStorage.removeItem(getScopedKey(USER_KEY, scope))
    sessionStorage.removeItem(getScopedKey(ACCESS_TOKEN_KEY, scope))
    sessionStorage.removeItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
    sessionStorage.removeItem(getScopedKey(USER_KEY, scope))
  }
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SCOPE_KEY)
}

export function ensureDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const deviceId = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}
