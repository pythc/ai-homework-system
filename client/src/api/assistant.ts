const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat'

export type AssistantRole = 'system' | 'user' | 'assistant'

export type AssistantMessage = {
  role: AssistantRole
  content: string
}

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export async function sendAssistantMessage(messages: AssistantMessage[]) {
  // const apiKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim()
  const apiKey = 'sk-780356b79cc1468b807b983a2e6cdaa8'
  if (!apiKey) {
    throw new Error('未配置 DeepSeek API Key')
  }

  const baseUrl =
    (import.meta.env.VITE_DEEPSEEK_API_BASE_URL as string | undefined) ??
    DEFAULT_DEEPSEEK_BASE_URL
  const model =
    (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined) ??
    DEFAULT_DEEPSEEK_MODEL

  const normalizedBaseUrl = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl

  const response = await fetch(
    `${normalizedBaseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    },
  )

  let payload: DeepSeekResponse | null = null
  try {
    payload = await response.json()
  } catch (err) {
    payload = null
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? 'AI 请求失败'
    throw new Error(message)
  }

  const content = payload?.choices?.[0]?.message?.content ?? ''
  return { content, raw: payload }
}
