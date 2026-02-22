import { clearAuth, getAccessToken, getRefreshToken, setTokens } from '../auth/storage'

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1'

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string | null
  skipRefresh?: boolean
}

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

let refreshPromise: Promise<string | null> | null = null

function isAuthPath(path: string) {
  return path.includes('/auth/login') || path.includes('/auth/refresh')
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isExpiringSoon(token: string, thresholdSeconds = 120) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  const now = Math.floor(Date.now() / 1000)
  return payload.exp - now <= thresholdSeconds
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return null

    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch (err) {
      payload = null
    }

    if (!response.ok) {
      clearAuth()
      return null
    }

    const data = (payload as { data?: { accessToken?: string; refreshToken?: string } })
      ?.data
    if (!data?.accessToken) {
      clearAuth()
      return null
    }

    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    return data.accessToken
  })()

  const result = await refreshPromise
  refreshPromise = null
  return result
}

export async function httpRequest<T>(path: string, options: RequestOptions = {}) {
  const { body, headers, token, skipRefresh, ...rest } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  let resolvedToken = token ?? getAccessToken()
  if (!skipRefresh && !isAuthPath(path) && resolvedToken && isExpiringSoon(resolvedToken)) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      resolvedToken = newToken
    }
  }
  if (resolvedToken && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${resolvedToken}`)
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch (err) {
    payload = null
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message ??
      response.statusText ??
      '请求失败'

    const shouldRefresh =
      !skipRefresh &&
      !isAuthPath(path) &&
      (response.status === 401 ||
        (response.status === 403 &&
          (message.includes('无效的访问令牌') ||
            message.includes('缺少访问令牌'))))

    if (shouldRefresh) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        return httpRequest<T>(path, {
          ...options,
          token: newToken,
          skipRefresh: true,
        })
      }
    }
    throw new Error(message)
  }

  return payload as T
}
