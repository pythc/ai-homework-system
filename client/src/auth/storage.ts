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

function setActiveStorage(storage: Storage) {
  const value = storage === localStorage ? 'local' : 'session'
  // Keep active storage selection tab-scoped to avoid cross-tab token mixing.
  sessionStorage.setItem(STORAGE_KEY, value)
}

export function setCurrentAuthScope(scope: AuthScope) {
  // Scope is part of the active tab state and should not leak across tabs.
  sessionStorage.setItem(SCOPE_KEY, scope)
}

export function getCurrentAuthScope(): AuthScope {
  const value = sessionStorage.getItem(SCOPE_KEY)
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
  const scope = resolveScope(payload.user?.role)
  const localKeyAccess = getScopedKey(ACCESS_TOKEN_KEY, scope)
  const localKeyRefresh = getScopedKey(REFRESH_TOKEN_KEY, scope)
  const localKeyUser = getScopedKey(USER_KEY, scope)

  // Always keep a tab-local active copy so each tab can hold a different account.
  sessionStorage.setItem(localKeyAccess, payload.accessToken)
  sessionStorage.setItem(localKeyRefresh, payload.refreshToken)
  sessionStorage.setItem(localKeyUser, JSON.stringify(payload.user))
  setActiveStorage(sessionStorage)
  setCurrentAuthScope(scope)

  // Do not persist auth tokens in localStorage, otherwise same-role accounts
  // (e.g. two teachers) will overwrite each other across tabs.
  localStorage.removeItem(localKeyAccess)
  localStorage.removeItem(localKeyRefresh)
  localStorage.removeItem(localKeyUser)
}

export function getAccessToken(scope = getCurrentAuthScope()) {
  const scopedKey = getScopedKey(ACCESS_TOKEN_KEY, scope)
  return sessionStorage.getItem(scopedKey)
}

export function getRefreshToken(scope = getCurrentAuthScope()) {
  const scopedKey = getScopedKey(REFRESH_TOKEN_KEY, scope)
  return sessionStorage.getItem(scopedKey)
}

export function setTokens(
  tokens: { accessToken: string; refreshToken?: string },
  scope = getCurrentAuthScope(),
) {
  const accessKey = getScopedKey(ACCESS_TOKEN_KEY, scope)
  const refreshKey = getScopedKey(REFRESH_TOKEN_KEY, scope)
  sessionStorage.setItem(accessKey, tokens.accessToken)
  if (tokens.refreshToken) {
    sessionStorage.setItem(refreshKey, tokens.refreshToken)
  }
  setActiveStorage(sessionStorage)
  setCurrentAuthScope(scope)
}

export function getStoredUser(scope = getCurrentAuthScope()): StoredUser | null {
  const scopedKey = getScopedKey(USER_KEY, scope)
  const raw = sessionStorage.getItem(scopedKey)
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
  const scopedKey = getScopedKey(USER_KEY, scope)
  const sessionRaw = sessionStorage.getItem(scopedKey)
  const targetRaw = sessionRaw
  if (!targetRaw) return
  try {
    const user = JSON.parse(targetRaw) as StoredUser
    const next = { ...user, ...patch }
    if (sessionRaw) {
      sessionStorage.setItem(scopedKey, JSON.stringify(next))
    }
  } catch (err) {
    return
  }
}

export function clearCurrentAuth() {
  for (const scope of ['student', 'teacher', 'admin'] as AuthScope[]) {
    sessionStorage.removeItem(getScopedKey(ACCESS_TOKEN_KEY, scope))
    sessionStorage.removeItem(getScopedKey(REFRESH_TOKEN_KEY, scope))
    sessionStorage.removeItem(getScopedKey(USER_KEY, scope))
  }
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(SCOPE_KEY)
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
  sessionStorage.removeItem(SCOPE_KEY)
}

export function ensureDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const deviceId = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}
