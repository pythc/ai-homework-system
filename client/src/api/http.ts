const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1'

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string | null
}

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export async function httpRequest<T>(path: string, options: RequestOptions = {}) {
  const { body, headers, token, ...rest } = options

  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (token && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
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
    throw new Error(message)
  }

  return payload as T
}
