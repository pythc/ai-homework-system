import { httpRequest, API_BASE_URL } from './http'
import { getAccessToken } from '../auth/storage'

export type AssistantResponse = {
  answer: string
  stats?: Record<string, unknown>
  scope?: Record<string, unknown>
}

export type AssistantRequest = {
  question: string
  courseId?: string
  assignmentId?: string
  sessionId?: string
  thinking?: 'auto' | 'enabled' | 'disabled'
  images?: Array<{ name: string; dataUrl?: string; url?: string }>
}

export async function sendAssistantMessage(
  question: string,
  options: Omit<AssistantRequest, 'question'> = {},
) {
  const payload: AssistantRequest = { question, ...options }
  return httpRequest<AssistantResponse>('/assistant/chat', {
    method: 'POST',
    body: payload,
  })
}

export type AssistantStreamHandlers = {
  onDelta?: (delta: string, full: string) => void
  onDone?: (full: string) => void
  onError?: (error: Error) => void
}

export type AssistantUsage = {
  allowed: boolean
  usedTokens: number
  limitTokens: number
  weekStart?: string
}

export async function fetchAssistantUsage() {
  return httpRequest<AssistantUsage>('/assistant/usage')
}

export async function uploadAssistantImages(files: File[]) {
  const token = getAccessToken()
  const form = new FormData()
  files.forEach((file) => {
    form.append('files', file)
  })
  const response = await fetch(buildUrl('/assistant/upload'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || response.statusText || '上传失败')
  }
  return response.json() as Promise<{ files: Array<{ name: string; url: string }> }>
}

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export async function streamAssistantMessage(
  question: string,
  options: Omit<AssistantRequest, 'question'> = {},
  handlers: AssistantStreamHandlers = {},
) {
  const payload: AssistantRequest = { question, ...options }
  const token = getAccessToken()

  const response = await fetch(buildUrl('/assistant/chat/stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    const message = text || response.statusText || '请求失败'
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const lines = part.split('\n')
        let event = 'message'
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim())
          }
        }
        const data = dataLines.join('\n')
        if (!data) continue
        if (data === '[DONE]') {
          handlers.onDone?.(fullText)
          return
        }
        try {
          const payloadJson = JSON.parse(data)
          if (payloadJson?.delta) {
            fullText += payloadJson.delta
            handlers.onDelta?.(payloadJson.delta, fullText)
          } else if (event === 'done' && payloadJson?.answer) {
            fullText = payloadJson.answer
            handlers.onDone?.(fullText)
            return
          }
        } catch {
          fullText += data
          handlers.onDelta?.(data, fullText)
        }
      }
    }
    handlers.onDone?.(fullText)
  } catch (err) {
    const error = err instanceof Error ? err : new Error('AI 请求失败')
    handlers.onError?.(error)
    throw error
  }
}
