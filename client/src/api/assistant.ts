import { httpRequest, API_BASE_URL } from './http'
import { getAccessToken } from '../auth/storage'

export type AssistantResponse = {
  answer: string
  stats?: Record<string, unknown>
  scope?: Record<string, unknown>
  actions?: AssistantActionCall[]
  cards?: AssistantActionCard[]
}

export type AssistantActionCall = {
  type: 'ASSIGNMENT_PUBLISH'
  confidence?: number
  args?: {
    originalText?: string
    courseId?: string
    courseName?: string
    textbookTitle?: string
    chapterTitle?: string
    exerciseRef?: string
    questionRef?: string
    questionNo?: number
  }
}

export type AssistantActionCard = {
  type: 'assignment_publish_confirm'
  actionId: string
  status: string
  canConfirm: boolean
  title: string
  summary: string
  fields?: Array<{ label: string; value: string }>
  warnings?: string[]
  actions?: {
    confirmLabel?: string
    cancelLabel?: string
  }
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
  onDelta?: (delta: string) => void
  onDone?: (payload: {
    answer: string
    actions?: AssistantActionCall[]
    cards?: AssistantActionCard[]
    raw?: Record<string, unknown>
  }) => void | Promise<void>
  onError?: (error: Error) => void
}

export type AssistantUsage = {
  allowed: boolean
  usedTokens: number
  limitTokens: number
  weekStart?: string
}

export type ProposeAssignmentActionPayload = {
  originalText?: string
  courseId?: string
  courseName?: string
  textbookTitle?: string
  chapterTitle?: string
  exerciseRef?: string
  questionRef?: string
  questionNo?: number
  assignmentTitle?: string
  description?: string
  deadline?: string
  confidence?: number
}

export async function proposeAssignmentAction(payload: ProposeAssignmentActionPayload) {
  return httpRequest<{
    actionId: string
    status: string
    card?: AssistantActionCard
  }>('/assistant/actions/assignment/propose', {
    method: 'POST',
    body: payload,
  })
}

export async function confirmAssistantAction(actionId: string) {
  return httpRequest<{
    actionId: string
    status: string
    assignmentId?: string
    snapshotId?: string
    message?: string
  }>(`/assistant/actions/${actionId}/confirm`, {
    method: 'POST',
  })
}

export async function cancelAssistantAction(actionId: string) {
  return httpRequest<{
    actionId: string
    status: string
  }>(`/assistant/actions/${actionId}/cancel`, {
    method: 'POST',
  })
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
          await handlers.onDone?.({ answer: fullText })
          return
        }
        try {
          const payloadJson = JSON.parse(data)
          if (payloadJson?.delta) {
            fullText += payloadJson.delta
            handlers.onDelta?.(payloadJson.delta)
          } else if (event === 'done' && payloadJson?.answer !== undefined) {
            fullText = String(payloadJson.answer || '')
            await handlers.onDone?.({
              answer: fullText,
              actions: Array.isArray(payloadJson.actions)
                ? (payloadJson.actions as AssistantActionCall[])
                : [],
              cards: Array.isArray(payloadJson.cards)
                ? (payloadJson.cards as AssistantActionCard[])
                : [],
              raw: payloadJson as Record<string, unknown>,
            })
            return
          }
        } catch {
          fullText += data
          handlers.onDelta?.(data)
        }
      }
    }
    await handlers.onDone?.({ answer: fullText })
  } catch (err) {
    const error = err instanceof Error ? err : new Error('AI 请求失败')
    handlers.onError?.(error)
    throw error
  }
}
