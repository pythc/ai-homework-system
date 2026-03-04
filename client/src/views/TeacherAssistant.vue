<template>
  <TeacherLayout
    title="110实验室 AI 助手"
    subtitle="老师您好，随时提问课程、作业与同学成绩"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="学习辅助中心"
  >
    <section class="assistant-wrapper">
      <div class="assistant-panel glass" :class="{ 'has-attachments': attachments.length }">
        <div class="assistant-body">
          <div
            ref="listRef"
            class="assistant-messages"
            :class="{ empty: !messages.length }"
          >
            <div v-if="!messages.length" class="assistant-empty">
              你好，让我们从这里启程
            </div>
            <div
              v-for="(message, index) in messages"
              :key="message.id"
              :class="['assistant-message', message.role]"
            >
              <div v-if="message.role !== 'assistant' && message.images?.length" class="assistant-message-images">
                <button
                  v-for="(image, imageIndex) in message.images"
                  :key="`${message.id}-${imageIndex}`"
                  type="button"
                  class="assistant-message-image-btn"
                  @click="openImagePreview(image)"
                >
                  <img
                    class="assistant-message-image"
                    :src="image.url"
                    :alt="image.name || '已发送图片'"
                  />
                </button>
              </div>
              <div class="assistant-bubble">
                <template v-if="message.role === 'assistant'">
                  <template v-if="!isTypingMessage(message)">
                    <div
                      v-if="isStreamingMessage(message)"
                      class="assistant-text assistant-streaming"
                    >
                      {{ message.content }}
                    </div>
                    <div
                      v-else-if="hasMathContent(message.content)"
                      class="assistant-markdown"
                      v-html="renderAssistantMarkdown(message)"
                      v-mathjax
                    />
                    <div
                      v-else
                      class="assistant-markdown"
                      v-html="renderAssistantMarkdown(message)"
                    />
                  </template>
                  <div v-else class="assistant-bubble typing">
                    <span class="assistant-typing-dot" />
                    <span class="assistant-typing-dot" />
                    <span class="assistant-typing-dot" />
                    <span class="assistant-typing-meta">{{ loadingStatusText }}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="assistant-text">{{ message.content }}</div>
                </template>
              </div>
              <div
                v-if="message.role === 'assistant' && message.content"
                class="assistant-actions"
              >
                <button
                  type="button"
                  class="assistant-action"
                  title="复制"
                  @click="copyMessage(message.content)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M16 1H6a2 2 0 0 0-2 2v10h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="assistant-action"
                  title="重试"
                  @click="retryMessage(index)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 6V3L8 7l4 4V8a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="sending && !streamingMessageId" class="assistant-message assistant">
              <div class="assistant-bubble typing">
                <span class="assistant-typing-dot" />
                <span class="assistant-typing-dot" />
                <span class="assistant-typing-dot" />
              </div>
            </div>
          </div>

          <div class="assistant-prompts-block">
            <div class="assistant-prompts-header">
              <div class="assistant-prompts-title">可尝试的提问</div>
              <div class="assistant-prompts-sub">点击即可填充到输入框</div>
            </div>
            <div class="assistant-prompts">
              <div class="assistant-prompts-tags">
                <button
                  type="button"
                  class="assistant-prompts-tag new-chat"
                  @click="openNewChat"
                >
                  开启新对话
                </button>
                <button
                  v-for="prompt in quickPrompts"
                  :key="prompt"
                  type="button"
                  class="assistant-prompts-tag"
                  @click="applyPrompt(prompt)"
                >
                  {{ prompt }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="assistant-input">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            multiple
            class="assistant-file"
            @change="handleFileChange"
          />
          <div ref="toolsRef" class="assistant-tools">
            <button class="assistant-upload" type="button" @click.stop="toggleTools">
              +
            </button>
            <div v-if="toolsOpen" class="assistant-tools-menu">
              <button class="assistant-tools-item" type="button" @click="openUpload">
                上传图片
              </button>
              <div class="assistant-tools-divider" />
              <div class="assistant-tools-title">深度思考</div>
              <button
                class="assistant-tools-item"
                type="button"
                :class="{ active: thinkingMode === 'enabled' }"
                @click="setThinkingMode('enabled')"
              >
                开启
              </button>
              <button
                class="assistant-tools-item"
                type="button"
                :class="{ active: thinkingMode === 'disabled' }"
                @click="setThinkingMode('disabled')"
              >
                关闭
              </button>
            </div>
          </div>
          <div class="assistant-input-area">
            <textarea
              v-model="input"
              placeholder="输入问题，回车发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="sendMessage"
            />
          </div>
          <button
            class="assistant-send"
            :disabled="sending || (!input.trim() && !attachments.length)"
            @click="sendMessage"
          >
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>
        <div class="assistant-attachments-row" v-if="attachments.length">
          <div v-if="attachments.length" class="assistant-attachments">
            <div
              v-for="(item, idx) in attachments"
              :key="item.url"
              class="assistant-attachment"
            >
              <img :src="item.url" :alt="item.name" />
              <button type="button" @click="removeAttachment(idx)">×</button>
            </div>
          </div>
        </div>

        <div v-if="error" class="assistant-error">{{ error }}</div>
        <div v-if="previewImage" class="assistant-image-preview-backdrop" @click="closeImagePreview">
          <div class="assistant-image-preview-card" @click.stop>
            <img
              class="assistant-image-preview"
              :src="previewImage.url"
              :alt="previewImage.name || '图片预览'"
            />
            <div class="assistant-image-preview-meta">
              <span>{{ previewImage.name || '图片预览' }}</span>
              <button type="button" @click="closeImagePreview">关闭</button>
            </div>
          </div>
        </div>
        <div v-if="showConfirm" class="assistant-modal-backdrop">
          <div class="assistant-modal">
            <div class="assistant-modal-title">开启新对话</div>
            <div class="assistant-modal-desc">
              开启新对话将删除现有对话记录，是否继续？
            </div>
            <div class="assistant-modal-actions">
              <button class="assistant-modal-btn ghost" @click="closeNewChat">取消</button>
              <button class="assistant-modal-btn primary" @click="confirmNewChat">确认开启</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { marked } from 'marked'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TeacherLayout from '../components/TeacherLayout.vue'
import { streamAssistantMessage, uploadAssistantImages } from '../api/assistant'
import { API_BASE_URL } from '../api/http'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getStoredUser } from '../auth/storage'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()

const listRef = ref(null)
const fileInputRef = ref(null)
const toolsRef = ref(null)
const input = ref('')
const sending = ref(false)
const error = ref('')
const messageSeed = ref(1)
const streamingMessageId = ref(null)
const showConfirm = ref(false)
const attachments = ref([])
const toolsOpen = ref(false)
const thinkingMode = ref('disabled')
const previewImage = ref(null)
let persistTimer = null
const apiBaseOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')
const STREAM_UPDATE_THROTTLE_MS = 100
const MAX_CHAT_MESSAGES = 120
const MAX_CHAT_CHARS = 120000
const MARKDOWN_CACHE_LIMIT = 400
const mathPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\(|\\\[|\\begin\{)/m
const markdownCache = new Map()
const activeThinkingMode = ref('disabled')
const loadingElapsedSeconds = ref(0)
let loadingTimer = null
let loadingStartedAt = 0

const resolveMessageImageUrl = (url) => {
  const value = String(url || '').trim()
  if (!value) return ''
  if (value.startsWith('/uploads/') || value.startsWith('/s3/')) {
    return `${apiBaseOrigin}${value}`
  }
  return value
}

const resolveChatKey = () => {
  const user = getStoredUser()
  const role = (user?.role ?? 'teacher').toLowerCase()
  const userId = user?.userId ?? 'anonymous'
  return `assistant.chat.${role}.${userId}`
}

const resolveSessionKey = () => {
  const user = getStoredUser()
  const role = (user?.role ?? 'teacher').toLowerCase()
  const userId = user?.userId ?? 'anonymous'
  return `assistant.session.${role}.${userId}`
}

const initSessionId = () => {
  const key = resolveSessionKey()
  let id = ''
  try {
    id = localStorage.getItem(key) || ''
  } catch (err) {
    id = ''
  }
  if (!id) {
    id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      localStorage.setItem(key, id)
    } catch (err) {
      // ignore
    }
  }
  return id
}

const sessionId = ref(initSessionId())

const resolveThinkingKey = () => {
  const user = getStoredUser()
  const role = (user?.role ?? 'teacher').toLowerCase()
  const userId = user?.userId ?? 'anonymous'
  return `assistant.thinking.${role}.${userId}`
}

const initThinkingMode = () => {
  try {
    const stored = localStorage.getItem(resolveThinkingKey())
    if (stored === 'enabled' || stored === 'disabled') {
      return stored
    }
  } catch (err) {
    // ignore
  }
  return 'disabled'
}

thinkingMode.value = initThinkingMode()

const resetSessionId = () => {
  const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  sessionId.value = id
  try {
    localStorage.setItem(resolveSessionKey(), id)
  } catch (err) {
    // ignore
  }
}

const toggleTools = () => {
  toolsOpen.value = !toolsOpen.value
}

const closeTools = () => {
  toolsOpen.value = false
}

const setThinkingMode = (mode) => {
  thinkingMode.value = mode
  try {
    localStorage.setItem(resolveThinkingKey(), mode)
  } catch (err) {
    // ignore
  }
  closeTools()
}

const handleOutsideClick = (event) => {
  if (!toolsRef.value) return
  if (toolsRef.value.contains(event.target)) return
  closeTools()
}

const normalizeMessageImages = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      name: String(item?.name || ''),
      url: resolveMessageImageUrl(item?.url),
    }))
    .filter((item) => Boolean(item.url))
}

const toStoredMessages = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const images = normalizeMessageImages(item?.images).filter(
      (image) => !image.url.startsWith('data:') && !image.url.startsWith('blob:'),
    )
    return {
      id: item?.id,
      role: item?.role,
      content: item?.content ?? '',
      ...(images.length ? { images } : {}),
    }
  })
}

const persistMessages = () => {
  if (persistTimer) {
    clearTimeout(persistTimer)
  }
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(resolveChatKey(), JSON.stringify(toStoredMessages(messages.value)))
    } catch (err) {
      // ignore
    }
  }, 150)
}

const loadMessages = () => {
  try {
    const raw = localStorage.getItem(resolveChatKey())
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      messages.value = parsed.map((item) => ({
        id: item?.id,
        role: item?.role,
        content: item?.content ?? '',
        images: normalizeMessageImages(item?.images),
      }))
      trimMessagesInPlace()
      const maxId = messages.value.reduce((max, item) => Math.max(max, item.id || 0), 0)
      messageSeed.value = maxId + 1
      return true
    }
  } catch (err) {
    return false
  }
  return false
}

const createInitialMessages = () => []

const messages = ref(createInitialMessages())

const quickPrompts = [
  '⚠重要提醒！点我查看',
  '你好，介绍一下自己',
  '分析一下某教学班的成绩',
  '上次作业的完成情况如何',
  '此系统不好用应该如何反馈',
]

const calculateTotalChatChars = () =>
  messages.value.reduce((sum, item) => sum + String(item?.content || '').length, 0)

const trimMessagesInPlace = () => {
  while (messages.value.length > MAX_CHAT_MESSAGES) {
    messages.value.shift()
  }
  let totalChars = calculateTotalChatChars()
  while (messages.value.length > 1 && totalChars > MAX_CHAT_CHARS) {
    const removed = messages.value.shift()
    totalChars -= String(removed?.content || '').length
  }
}

const hasMathContent = (content) => mathPattern.test(String(content || ''))

const normalizeMathForMarkdown = (value) => {
  let output = String(value || '')
  // Keep math delimiters in TeX form to avoid raw "$$" leaking into rendered markdown.
  output = output.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_all, inner) => `\\[${inner}\\]`)
  output = output.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_all, inner) => `\\(${inner}\\)`)
  return output
}

const renderAssistantMarkdown = (message) => {
  const rawContent = String(message?.content || '')
  const normalized = hasMathContent(rawContent) ? normalizeMathForMarkdown(rawContent) : rawContent
  const content = hasMathContent(normalized) ? normalized.replace(/\\/g, '\\\\') : normalized
  const key = `${message?.id ?? 'x'}:${content}`
  const cached = markdownCache.get(key)
  if (cached) return cached
  const html = marked.parse(content, { breaks: true })
  markdownCache.set(key, html)
  if (markdownCache.size > MARKDOWN_CACHE_LIMIT) {
    const oldestKey = markdownCache.keys().next().value
    if (typeof oldestKey === 'string') {
      markdownCache.delete(oldestKey)
    }
  }
  return html
}

const startLoadingTimer = (mode) => {
  activeThinkingMode.value = mode === 'enabled' ? 'enabled' : 'disabled'
  loadingStartedAt = Date.now()
  loadingElapsedSeconds.value = 0
  if (loadingTimer) {
    clearInterval(loadingTimer)
  }
  loadingTimer = setInterval(() => {
    loadingElapsedSeconds.value = Math.max(
      0,
      Math.floor((Date.now() - loadingStartedAt) / 1000),
    )
  }, 250)
}

const stopLoadingTimer = () => {
  if (loadingTimer) {
    clearInterval(loadingTimer)
    loadingTimer = null
  }
  loadingStartedAt = 0
  loadingElapsedSeconds.value = 0
  activeThinkingMode.value = 'disabled'
}

const loadingStatusText = computed(() =>
  activeThinkingMode.value === 'enabled'
    ? `深度思考中 · ${loadingElapsedSeconds.value} s`
    : `${loadingElapsedSeconds.value} s`,
)

const scrollToBottom = () => {
  nextTick(() => {
    const element = listRef.value
    if (element) {
      element.scrollTop = element.scrollHeight
    }
  })
}

const pushMessage = (role, content, options = {}) => {
  const id = messageSeed.value++
  const images = normalizeMessageImages(options.images)
  messages.value.push({
    id,
    role,
    content,
    ...(images.length ? { images } : {}),
  })
  trimMessagesInPlace()
  scrollToBottom()
  persistMessages()
  return id
}

const updateMessage = (id, content, options = {}) => {
  const target = messages.value.find((msg) => msg.id === id)
  if (target) {
    target.content = content
    trimMessagesInPlace()
    scrollToBottom()
    if (options.persist !== false) {
      persistMessages()
    }
  }
}

const clearConversation = () => {
  messageSeed.value = 1
  messages.value = createInitialMessages()
  markdownCache.clear()
  input.value = ''
  error.value = ''
  closeImagePreview()
  streamingMessageId.value = null
  stopLoadingTimer()
  clearAttachments()
  resetSessionId()
  try {
    localStorage.removeItem(resolveChatKey())
  } catch (err) {
    // ignore
  }
  persistMessages()
  scrollToBottom()
}

const openNewChat = () => {
  showConfirm.value = true
}

const closeNewChat = () => {
  showConfirm.value = false
}

const confirmNewChat = () => {
  showConfirm.value = false
  clearConversation()
}

const applyPrompt = (prompt) => {
  input.value = prompt
}

const triggerFile = () => {
  fileInputRef.value?.click()
}

const openUpload = () => {
  triggerFile()
  closeTools()
}

const clearAttachments = () => {
  attachments.value.forEach((item) => {
    if (item?.url) URL.revokeObjectURL(item.url)
  })
  attachments.value = []
}

const handleFileChange = (event) => {
  const files = Array.from(event.target?.files ?? [])
  if (!files.length) return
  const remaining = Math.max(0, 4 - attachments.value.length)
  const picked = files.slice(0, remaining)
  const next = picked.map((file) => ({
    file,
    name: file.name,
    url: URL.createObjectURL(file),
  }))
  attachments.value = [...attachments.value, ...next]
  event.target.value = ''
}

const removeAttachment = (index) => {
  const item = attachments.value[index]
  if (item?.url) URL.revokeObjectURL(item.url)
  attachments.value.splice(index, 1)
}

const buildMessageImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((item) => ({
      name: String(item?.name || ''),
      url: resolveMessageImageUrl(item?.url || item?.dataUrl || ''),
    }))
    .filter((item) => Boolean(item.url))

const openImagePreview = (image) => {
  if (!image?.url) return
  previewImage.value = {
    name: image.name || '',
    url: image.url,
  }
}

const closeImagePreview = () => {
  previewImage.value = null
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })

const buildImagesPayload = async () => {
  if (!attachments.value.length) return []
  const files = attachments.value.map((item) => item.file)
  const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
  let uploaded = []
  try {
    const response = await uploadAssistantImages(files)
    uploaded = Array.isArray(response?.files) ? response.files : []
  } catch {
    uploaded = []
  }

  return files.map((file, idx) => {
    const payload = {
      name: file.name,
      dataUrl: dataUrls[idx],
    }
    const url =
      uploaded[idx]?.url ?? uploaded.find((item) => item?.name === file.name)?.url ?? ''
    if (url) {
      payload.url = url
    }
    return payload
  })
}

const refreshUsage = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('assistant-usage-refresh'))
  }
}

const sendMessageWithText = async (question) => {
  const trimmed = question.trim()
  if ((!trimmed && !attachments.value.length) || sending.value) return

  error.value = ''
  const userContent = trimmed || '请查看我上传的图片。'
  if (userContent.length > 4000) {
    pushMessage('assistant', '非常抱歉，小小作坊资金有限，长对话暂不支持，请开启新对话继续学习吧~')
    clearAttachments()
    refreshUsage()
    return
  }
  sending.value = true

  try {
    const images = await buildImagesPayload()
    const messageImages = buildMessageImages(images)
    pushMessage('user', userContent, { images: messageImages })
    const assistantId = pushMessage('assistant', '')
    streamingMessageId.value = assistantId
    startLoadingTimer(thinkingMode.value)
    let streamBuffer = ''
    let streamTimer = null
    const flushStream = (persist = false) => {
      if (!streamBuffer) return
      updateMessage(assistantId, streamBuffer, { persist })
    }

    await streamAssistantMessage(
      userContent,
      { sessionId: sessionId.value, thinking: thinkingMode.value, images },
      {
        onDelta: (delta) => {
          streamBuffer += delta
          if (streamTimer) return
          streamTimer = setTimeout(() => {
            streamTimer = null
            flushStream(false)
          }, STREAM_UPDATE_THROTTLE_MS)
        },
        onDone: (full) => {
          if (streamTimer) {
            clearTimeout(streamTimer)
            streamTimer = null
          }
          streamBuffer = full || streamBuffer || '收到，我们继续聊。'
          streamingMessageId.value = null
          flushStream(true)
          window.dispatchEvent(new Event('assistant-usage-refresh'))
        },
      },
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'AI 请求失败'
    if (!streamingMessageId.value) {
      pushMessage('assistant', '请求失败，请稍后再试。')
    } else {
      updateMessage(streamingMessageId.value, '请求失败，请稍后再试。')
    }
  } finally {
    sending.value = false
    streamingMessageId.value = null
    stopLoadingTimer()
    clearAttachments()
    refreshUsage()
  }
}

const sendMessage = async () => {
  const question = input.value.trim()
  if ((!question && !attachments.value.length) || sending.value) return
  input.value = ''
  await sendMessageWithText(question)
}

const retryMessage = async (index) => {
  if (sending.value) return
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = messages.value[i]
    if (candidate?.role === 'user' && candidate.content) {
      messages.value.splice(index, 1)
      persistMessages()
      await sendMessageWithText(candidate.content)
      return
    }
  }
}

const copyMessage = async (content) => {
  if (!content) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content)
      return
    }
  } catch (err) {
    // fallback below
  }
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const isTypingMessage = (message) =>
  message.role === 'assistant' &&
  streamingMessageId.value === message.id &&
  !message.content

const isStreamingMessage = (message) =>
  message.role === 'assistant' &&
  streamingMessageId.value === message.id &&
  Boolean(message.content)

onMounted(async () => {
  await refreshProfile()
  if (!loadMessages()) {
    persistMessages()
  }
  scrollToBottom()
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  closeImagePreview()
  stopLoadingTimer()
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.assistant-wrapper {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 20px;
}

.assistant-panel {
  border-radius: 26px;
  padding: 24px;
  display: grid;
  gap: 18px;
  min-height: 560px;
  height: 700px;
  position: relative;
  overflow: hidden;
}

.assistant-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(600px 400px at 0% 0%, rgba(116, 220, 210, 0.25), transparent 60%),
    radial-gradient(600px 400px at 100% 0%, rgba(88, 174, 255, 0.2), transparent 55%);
  pointer-events: none;
  opacity: 0.9;
}

.assistant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.assistant-title {
  font-size: 18px;
  font-weight: 700;
}

.assistant-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
  margin-top: 4px;
}

.assistant-clear {
  border: none;
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.75);
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
}

.assistant-clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.assistant-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  position: relative;
  z-index: 1;
}

.assistant-messages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  height: 550px;
  max-height: 600px;
  overflow-y: auto;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(120, 140, 190, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.assistant-messages.empty {
  justify-content: center;
  align-items: center;
}

.assistant-empty {
  font-size: 24px;
  font-weight: 700;
  color: #0b0f1a;
  text-align: center;
  letter-spacing: 0.5px;
}

.assistant-message {
  display: flex;
  flex-direction: column;
  gap: 0px;
  align-items: flex-start;
}

.assistant-message.assistant .assistant-bubble {
  background: transparent;
  box-shadow: none;
  border: none;
  padding-bottom: 4px;
}

.assistant-message.user {
  grid-template-columns: 1fr;
}

.assistant-avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #1b2c4b;
  background: linear-gradient(135deg, rgba(255, 212, 156, 0.85), rgba(255, 245, 210, 0.85));
  box-shadow: 0 10px 18px rgba(33, 50, 80, 0.12);
}

.assistant-bubble {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  max-width: 90%;
  font-size: 14px;
  white-space: pre-wrap;
  position: relative;
}

.assistant-text {
  white-space: pre-wrap;
}

.assistant-message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 8px;
}

.assistant-message.user .assistant-message-images {
  align-self: flex-end;
  justify-content: flex-end;
  max-width: 90%;
}

.assistant-message-image-btn {
  width: 68px;
  height: 68px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 10px;
  overflow: hidden;
  padding: 0;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;
}

.assistant-message-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.assistant-message.user .assistant-avatar {
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.85), rgba(116, 220, 210, 0.85));
  color: #ffffff;
}

.assistant-message.user .assistant-bubble {
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.85), rgba(116, 220, 210, 0.85));
  color: #ffffff;
  align-self: flex-end;
  box-shadow: 0 10px 18px rgba(52, 140, 210, 0.2);
}

.assistant-bubble.typing {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 70px;
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.assistant-typing-meta {
  margin-left: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  white-space: nowrap;
}

.assistant-typing-dot {
  width: 10px;
  height: 10px;
  min-width: 10px;
  min-height: 10px;
  flex: 0 0 10px;
  border-radius: 50%;
  background: rgba(26, 29, 51, 0.55);
  animation: typingPulse 1.2s infinite ease-in-out;
  display: inline-block;
}

.assistant-typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.assistant-typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.assistant-actions {
  display: flex;
  gap: 4px;
  position: static;
  margin: -6px 0 0 10px;
  align-self: flex-start;
}

.assistant-action {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  border: none;
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: rgba(26, 29, 51, 0.6);
  transition: all 0.2s ease;
}

.assistant-action:hover {
  background: transparent;
  color: rgba(26, 29, 51, 0.85);
}

.assistant-action svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.assistant-message.assistant .assistant-markdown :deep(p):last-child {
  margin-bottom: 0;
}

.assistant-input {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 120px;
  gap: 12px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.assistant-file {
  display: none;
}

.assistant-upload {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  border: 1px solid rgba(97, 125, 170, 0.3);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 12px rgba(42, 64, 120, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  font-size: 22px;
  cursor: pointer;
  color: rgba(26, 29, 51, 0.7);
}

.assistant-tools {
  position: relative;
}

.assistant-tools-menu {
  position: absolute;
  left: 0;
  bottom: 56px;
  min-width: 160px;
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 16px 30px rgba(24, 32, 60, 0.18);
  z-index: 10;
}

.assistant-tools-item {
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.75);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.assistant-tools-item:hover {
  background: rgba(255, 176, 77, 0.18);
  color: rgba(26, 29, 51, 0.9);
}

.assistant-tools-item.active {
  font-weight: 600;
  color: rgba(245, 145, 59, 0.95);
}

.assistant-tools-item.active::after {
  content: '✓';
  font-size: 12px;
}

.assistant-tools-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.6);
  padding: 4px 8px 0;
}

.assistant-tools-divider {
  height: 1px;
  background: rgba(26, 29, 51, 0.08);
  margin: 2px 0;
}

.assistant-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.assistant-attachments-row {
  margin-top: 1px;
  display: grid;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.assistant-attachments {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.assistant-attachment {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: visible;
  box-shadow: 0 6px 12px rgba(24, 32, 60, 0.12);
}

.assistant-attachment img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
}

.assistant-attachment button {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(26, 29, 51, 0.85);
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.assistant-panel.has-attachments .assistant-messages {
  height: 500px;
  max-height: 540px;
}

.assistant-input textarea {
  border: 1px solid rgba(90, 120, 170, 0.35);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 10px 14px;
  font-size: 14px;
  min-height: 44px;
  height: 44px;
  line-height: 22px;
  resize: none;
  outline: none;
  width: 100%;
}

.assistant-input textarea:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(78, 132, 255, 0.18);
}

.assistant-send {
  border: none;
  background: linear-gradient(135deg, rgba(243, 125, 63, 0.95), rgba(255, 196, 120, 0.95));
  color: #ffffff;
  padding: 12px 16px;
  border-radius: 16px;
  font-weight: 600;
  cursor: pointer;
  height: 44px;
}

.assistant-send:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.assistant-error {
  font-size: 12px;
  color: #e76464;
  position: relative;
  z-index: 1;
}

.assistant-prompts-block {
  display: grid;
  gap: 8px;
}

.assistant-prompts-header {
  display: grid;
  gap: 2px;
}

.assistant-prompts {
  border-radius: 20px;
  padding: 14px;
  display: grid;
  gap: 10px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  height: 500px;
  overflow-y: auto;
}

.assistant-prompts-title {
  font-weight: 700;
  line-height: 1.2;
}

.assistant-prompts-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
  line-height: 1.2;
}

.assistant-prompts-tags {
  display: grid;
  gap: 6px;
}

.assistant-prompts-tag {
  border: 1px solid rgba(255, 255, 255, 0.65);
  text-align: left;
  padding: 7px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.8);
  line-height: 1.25;
  box-shadow: 0 6px 12px rgba(24, 32, 60, 0.08);
}

.assistant-prompts-tag.new-chat {
  background: linear-gradient(135deg, rgba(243, 125, 63, 0.92), rgba(255, 196, 120, 0.92));
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 8px 16px rgba(243, 125, 63, 0.2);
}


@keyframes typingPulse {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-6px) scale(1.05);
    opacity: 1;
  }
}

@media (max-width: 1200px) {
  .assistant-wrapper {
    grid-template-columns: 1fr;
  }

  .assistant-body {
    grid-template-columns: 1fr;
  }

  .assistant-panel {
    height: auto;
  }

  .assistant-messages {
    height: auto;
    max-height: 420px;
  }

  .assistant-prompts {
    height: auto;
    overflow: visible;
  }
}

.assistant-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 20, 40, 0.2);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 5;
}

.assistant-modal {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
  padding: 20px;
  width: min(360px, 90%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
  display: grid;
  gap: 12px;
}

.assistant-modal-title {
  font-weight: 700;
  font-size: 16px;
}

.assistant-modal-desc {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.7);
  line-height: 1.5;
}

.assistant-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.assistant-modal-btn {
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
}

.assistant-modal-btn.ghost {
  background: rgba(26, 29, 51, 0.08);
  color: rgba(26, 29, 51, 0.75);
}

.assistant-modal-btn.primary {
  background: linear-gradient(135deg, rgba(88, 174, 255, 0.9), rgba(108, 229, 215, 0.9));
  color: #ffffff;
}

.assistant-image-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 280;
  background: rgba(12, 18, 30, 0.55);
  backdrop-filter: blur(1.5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.assistant-image-preview-card {
  width: min(90vw, 860px);
  max-height: 88vh;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(189, 204, 232, 0.9);
  box-shadow: 0 22px 44px rgba(16, 25, 44, 0.35);
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.assistant-image-preview {
  width: 100%;
  max-height: calc(88vh - 58px);
  object-fit: contain;
  background: #f2f6fd;
}

.assistant-image-preview-meta {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  color: #1e315a;
  font-size: 14px;
  font-weight: 600;
}

.assistant-image-preview-meta button {
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  background: linear-gradient(135deg, rgba(75, 154, 245, 0.92), rgba(102, 205, 228, 0.92));
  color: #fff;
  cursor: pointer;
}

@media (max-width: 768px) {
  .assistant-input {
    grid-template-columns: 1fr;
  }
}

.assistant-markdown :deep(h1),
.assistant-markdown :deep(h2),
.assistant-markdown :deep(h3) {
  margin: 0 0 8px;
  font-weight: 700;
}

.assistant-markdown :deep(p) {
  margin: 0 0 8px;
  line-height: 1.6;
}

.assistant-markdown :deep(ul),
.assistant-markdown :deep(ol) {
  margin: 0 0 8px 18px;
  padding: 0;
}

.assistant-markdown :deep(code) {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 12px;
  background: rgba(26, 29, 51, 0.08);
  padding: 2px 6px;
  border-radius: 8px;
}

.assistant-markdown :deep(pre) {
  background: rgba(26, 29, 51, 0.08);
  padding: 10px 12px;
  border-radius: 12px;
  overflow-x: auto;
  margin: 8px 0;
}

.assistant-markdown :deep(blockquote) {
  margin: 6px 0;
  padding-left: 10px;
  border-left: 3px solid rgba(59, 168, 255, 0.5);
  color: rgba(26, 29, 51, 0.7);
}
</style>
