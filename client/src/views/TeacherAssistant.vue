<template>
  <TeacherLayout
    title="110实验室 AI 助手"
    subtitle="老师您好，随时提问课程、作业与同学成绩"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="学习辅助中心"
    :show-topbar="false"
  >
    <section class="assistant-wrapper">
      <div
        class="assistant-panel glass"
        :class="{
          'has-attachments': attachments.length,
          'empty-state': !messages.length,
          'chat-started': messages.length > 0,
          'first-input-transitioning': firstInputTransitioning,
        }"
      >
        <div class="assistant-body">
          <div
            ref="listRef"
            class="assistant-messages"
            :class="{ empty: !messages.length }"
          >
            <div v-if="!messages.length" class="assistant-empty">
              你在忙什么？
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
                v-if="message.role === 'assistant' && message.cards?.length"
                class="assistant-action-cards"
              >
                <div
                  v-for="card in message.cards"
                  :key="card.actionId"
                  class="assistant-action-card"
                  :class="{ disabled: !canConfirmCard(card) }"
                >
                  <div class="assistant-action-card-header">
                    <div class="assistant-action-card-title">{{ card.title }}</div>
                    <span class="assistant-action-card-status">{{ formatCardStatus(card.status) }}</span>
                  </div>
                  <div class="assistant-action-card-summary">{{ card.summary }}</div>
                  <div
                    v-if="Array.isArray(card.fields) && card.fields.length"
                    class="assistant-action-card-fields"
                  >
                    <div
                      v-for="field in card.fields"
                      :key="`${card.actionId}-${field.label}`"
                      class="assistant-action-card-field"
                    >
                      <span>{{ field.label }}</span>
                      <strong>{{ field.value }}</strong>
                    </div>
                  </div>
                  <ul
                    v-if="Array.isArray(card.warnings) && card.warnings.length"
                    class="assistant-action-card-warnings"
                  >
                    <li v-for="warning in card.warnings" :key="warning">{{ warning }}</li>
                  </ul>
                  <div class="assistant-action-card-buttons">
                    <button
                      type="button"
                      class="assistant-action-card-btn primary"
                      :disabled="!canConfirmCard(card)"
                      @click="handleAssistantCardConfirm(message.id, card)"
                    >
                      {{ card.actions?.confirmLabel || '确认发布' }}
                    </button>
                    <button
                      type="button"
                      class="assistant-action-card-btn ghost"
                      :disabled="!canCancelCard(card)"
                      @click="handleAssistantCardCancel(message.id, card)"
                    >
                      {{ card.actions?.cancelLabel || '取消' }}
                    </button>
                  </div>
                </div>
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

        </div>

        <div v-if="!messages.length" class="assistant-suggestions-row">
          <button
            type="button"
            class="assistant-suggestion new-chat"
            @click="openNewChat"
          >
            新对话
          </button>
          <button
            v-for="prompt in quickPrompts"
            :key="`empty-${prompt}`"
            type="button"
            class="assistant-suggestion"
            @click="applyPrompt(prompt)"
          >
            {{ prompt }}
          </button>
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
          <template v-if="messages.length">
            <div class="assistant-compose-top">
              <div class="assistant-input-area">
                <textarea
                  v-model="input"
                  placeholder="发送消息或输入“/”选择技能"
                  @keydown.enter.exact.prevent="sendMessage"
                />
              </div>
            </div>
            <div class="assistant-compose-bottom">
              <div class="assistant-compose-left">
                <button
                  class="assistant-upload-tile"
                  type="button"
                  title="上传图片"
                  @click="openUpload"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 8.5A3.5 3.5 0 0 1 8.5 5h8a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5h-8A3.5 3.5 0 0 1 5 15.5v-7Z" />
                    <path d="m8 15 3-3 2 2 3-3 2 4" />
                    <circle cx="10" cy="10" r="1.1" />
                  </svg>
                </button>
                <button
                  class="assistant-pill-btn"
                  :class="{ active: thinkingMode === 'enabled' }"
                  type="button"
                  @click="toggleThinkingMode"
                >
                  深度思考
                  <span class="assistant-pill-state">
                    {{ thinkingMode === 'enabled' ? '开' : '关' }}
                  </span>
                </button>
                <button
                  class="assistant-pill-btn ghost"
                  type="button"
                  @click="openNewChat"
                >
                  开启新对话
                </button>
              </div>
              <button
                class="assistant-send assistant-send-inline"
                :disabled="sending || (!input.trim() && !attachments.length)"
                @click="sendMessage"
              >
                <span v-if="sending" class="assistant-send-label">...</span>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 12h10M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </template>
          <template v-else>
            <button class="assistant-upload" type="button" @click="openUpload">
              +
            </button>
            <div class="assistant-input-area">
              <textarea
                v-model="input"
                placeholder="有问题，尽管问"
                @keydown.enter.exact.prevent="sendMessage"
              />
            </div>
            <button
              class="assistant-send"
              :disabled="sending || (!input.trim() && !attachments.length)"
              @click="sendMessage"
            >
              <span v-if="sending" class="assistant-send-label">...</span>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 12h10M13 6l6 6-6 6" />
              </svg>
            </button>
          </template>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import {
  cancelAssistantAction,
  confirmAssistantAction,
  proposeAssignmentAction,
  streamAssistantMessage,
  uploadAssistantImages,
} from '../api/assistant'
import { API_BASE_URL } from '../api/http'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getStoredUser } from '../auth/storage'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()

const listRef = ref(null)
const fileInputRef = ref(null)
const input = ref('')
const sending = ref(false)
const error = ref('')
const messageSeed = ref(1)
const streamingMessageId = ref(null)
const showConfirm = ref(false)
const attachments = ref([])
const thinkingMode = ref('disabled')
const previewImage = ref(null)
const actionPendingIds = ref([])
const firstInputTransitioning = ref(false)
const isBootstrappingMessages = ref(true)
const hadAnyMessages = ref(false)
let persistTimer = null
let firstInputTransitionTimer = null
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

const setThinkingMode = (mode) => {
  thinkingMode.value = mode === 'enabled' ? 'enabled' : 'disabled'
  try {
    localStorage.setItem(resolveThinkingKey(), thinkingMode.value)
  } catch (err) {
    // ignore
  }
}

const toggleThinkingMode = () => {
  setThinkingMode(thinkingMode.value === 'enabled' ? 'disabled' : 'enabled')
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

const normalizeAssistantCards = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((card) => {
      const actionId = String(card?.actionId || '').trim()
      if (!actionId) return null
      const fields = Array.isArray(card?.fields)
        ? card.fields
            .map((field) => ({
              label: String(field?.label || '').trim(),
              value: String(field?.value || '').trim(),
            }))
            .filter((field) => field.label && field.value)
        : []
      const warnings = Array.isArray(card?.warnings)
        ? card.warnings
            .map((warning) => String(warning || '').trim())
            .filter(Boolean)
        : []
      return {
        type: String(card?.type || 'assignment_publish_confirm'),
        actionId,
        status: String(card?.status || 'PENDING').toUpperCase(),
        canConfirm: Boolean(card?.canConfirm),
        title: String(card?.title || '请确认操作'),
        summary: String(card?.summary || ''),
        fields,
        warnings,
        actions: {
          confirmLabel: String(card?.actions?.confirmLabel || '确认发布'),
          cancelLabel: String(card?.actions?.cancelLabel || '取消'),
        },
      }
    })
    .filter(Boolean)
}

const toStoredMessages = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const images = normalizeMessageImages(item?.images).filter(
      (image) => !image.url.startsWith('data:') && !image.url.startsWith('blob:'),
    )
    const cards = normalizeAssistantCards(item?.cards)
    return {
      id: item?.id,
      role: item?.role,
      content: item?.content ?? '',
      ...(images.length ? { images } : {}),
      ...(cards.length ? { cards } : {}),
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
        cards: normalizeAssistantCards(item?.cards),
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

watch(
  () => messages.value.length,
  (next, prev) => {
    if (isBootstrappingMessages.value) return
    if (!hadAnyMessages.value && prev === 0 && next > 0) {
      firstInputTransitioning.value = true
      if (firstInputTransitionTimer) {
        clearTimeout(firstInputTransitionTimer)
      }
      firstInputTransitionTimer = setTimeout(() => {
        firstInputTransitioning.value = false
        firstInputTransitionTimer = null
      }, 520)
      hadAnyMessages.value = true
      return
    }
    if (next === 0) {
      hadAnyMessages.value = false
      firstInputTransitioning.value = false
      if (firstInputTransitionTimer) {
        clearTimeout(firstInputTransitionTimer)
        firstInputTransitionTimer = null
      }
      return
    }
    hadAnyMessages.value = next > 0
  },
)

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
  const cards = normalizeAssistantCards(options.cards)
  messages.value.push({
    id,
    role,
    content,
    ...(images.length ? { images } : {}),
    ...(cards.length ? { cards } : {}),
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
    if (options.cards !== undefined) {
      const cards = normalizeAssistantCards(options.cards)
      if (cards.length) {
        target.cards = cards
      } else {
        delete target.cards
      }
    }
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
  actionPendingIds.value = []
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

const formatCardStatus = (status) => {
  const value = String(status || '').toUpperCase()
  if (value === 'PENDING') return '待确认'
  if (value === 'CONFIRMING') return '发布中'
  if (value === 'CONFIRMED') return '已发布'
  if (value === 'CANCELED') return '已取消'
  if (value === 'EXPIRED') return '已过期'
  if (value === 'FAILED') return '失败'
  return status || '未知'
}

const isActionBusy = (actionId) => {
  const id = String(actionId || '').trim()
  return Boolean(id) && actionPendingIds.value.includes(id)
}

const markActionBusy = (actionId, busy) => {
  const id = String(actionId || '').trim()
  if (!id) return
  if (busy) {
    if (!actionPendingIds.value.includes(id)) {
      actionPendingIds.value.push(id)
    }
    return
  }
  actionPendingIds.value = actionPendingIds.value.filter((item) => item !== id)
}

const canConfirmCard = (card) => {
  const status = String(card?.status || '').toUpperCase()
  return Boolean(card?.canConfirm) && status === 'PENDING' && !isActionBusy(card?.actionId)
}

const canCancelCard = (card) => {
  const status = String(card?.status || '').toUpperCase()
  return status === 'PENDING' && !isActionBusy(card?.actionId)
}

const updateAssistantCard = (messageId, actionId, updater, options = {}) => {
  const target = messages.value.find((msg) => msg.id === messageId)
  if (!target) return
  const cards = normalizeAssistantCards(target.cards)
  const index = cards.findIndex((item) => item.actionId === actionId)
  if (index < 0) return
  const current = cards[index]
  const next = typeof updater === 'function' ? updater(current) : updater
  cards[index] = normalizeAssistantCards([next])[0] || current
  target.cards = cards
  if (options.persist !== false) {
    persistMessages()
  }
}

const buildActionProposalPayload = (action, originalText) => ({
  originalText: String(action?.args?.originalText || originalText || '').trim(),
  courseId: action?.args?.courseId,
  courseName: action?.args?.courseName,
  textbookTitle: action?.args?.textbookTitle,
  chapterTitle: action?.args?.chapterTitle,
  exerciseRef: action?.args?.exerciseRef,
  questionRef: action?.args?.questionRef,
  questionNo: Number.isFinite(Number(action?.args?.questionNo))
    ? Number(action?.args?.questionNo)
    : undefined,
  confidence: Number.isFinite(Number(action?.confidence))
    ? Number(action?.confidence)
    : undefined,
})

const buildFailedActionCard = (message) => ({
  type: 'assignment_publish_confirm',
  actionId: `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  status: 'FAILED',
  canConfirm: false,
  title: '发布确认卡片生成失败',
  summary: '本次未能自动生成发布卡片，请补充信息后重试。',
  warnings: [String(message || '未知错误')],
  fields: [],
  actions: {
    confirmLabel: '确认发布',
    cancelLabel: '取消',
  },
})

const navigateAfterAssignmentConfirmed = async (assignmentId) => {
  const id = String(assignmentId || '').trim()
  if (!id) {
    await router.push('/teacher/grading')
    return
  }
  try {
    await router.push({
      path: `/teacher/grading/${id}`,
      query: {
        from: 'assistant',
      },
    })
  } catch {
    await router.push('/teacher/grading')
  }
}

const proposeCardsFromActions = async (actions, originalText) => {
  const cards = []
  for (const action of Array.isArray(actions) ? actions : []) {
    if (String(action?.type || '').toUpperCase() !== 'ASSIGNMENT_PUBLISH') continue
    try {
      const response = await proposeAssignmentAction(
        buildActionProposalPayload(action, originalText),
      )
      if (response?.card) {
        cards.push(response.card)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成卡片失败'
      cards.push(buildFailedActionCard(message))
    }
  }
  return normalizeAssistantCards(cards)
}

const handleAssistantCardConfirm = async (messageId, card) => {
  if (!canConfirmCard(card)) return
  const actionId = String(card.actionId || '')
  markActionBusy(actionId, true)
  updateAssistantCard(
    messageId,
    actionId,
    (current) => ({
      ...current,
      status: 'CONFIRMING',
      canConfirm: false,
      summary: '正在发布作业，请稍候...',
      warnings: current?.warnings || [],
    }),
    { persist: true },
  )
  try {
    const response = await confirmAssistantAction(actionId)
    updateAssistantCard(
      messageId,
      actionId,
      (current) => ({
        ...current,
        status: String(response?.status || 'CONFIRMED').toUpperCase(),
        canConfirm: false,
        summary: response?.message || '作业已发布',
      }),
      { persist: true },
    )
    if (response?.assignmentId) {
      pushMessage('assistant', `已为你发布作业，作业ID：${response.assignmentId}，正在跳转到该作业详情页。`)
    } else {
      pushMessage('assistant', '作业已发布，正在跳转到发布记录页。')
    }
    await navigateAfterAssignmentConfirmed(response?.assignmentId)
  } catch (err) {
    const message = err instanceof Error ? err.message : '确认发布失败，请稍后再试'
    error.value = message
    updateAssistantCard(
      messageId,
      actionId,
      (current) => ({
        ...current,
        status: 'FAILED',
        canConfirm: false,
        summary: '发布失败，请重新描述需求后再试',
        warnings: [...(current?.warnings || []), message],
      }),
      { persist: true },
    )
  } finally {
    markActionBusy(actionId, false)
  }
}

const handleAssistantCardCancel = async (messageId, card) => {
  if (!canCancelCard(card)) return
  const actionId = String(card.actionId || '')
  markActionBusy(actionId, true)
  try {
    const response = await cancelAssistantAction(actionId)
    updateAssistantCard(
      messageId,
      actionId,
      (current) => ({
        ...current,
        status: String(response?.status || 'CANCELED').toUpperCase(),
        canConfirm: false,
        summary: '已取消本次发布',
      }),
      { persist: true },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : '取消失败，请稍后再试'
    error.value = message
  } finally {
    markActionBusy(actionId, false)
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
        onDone: async (payload) => {
          if (streamTimer) {
            clearTimeout(streamTimer)
            streamTimer = null
          }
          const finalAnswer = String(payload?.answer || '')
          streamBuffer = finalAnswer || streamBuffer || '收到，我们继续聊。'
          streamingMessageId.value = null
          let cards = normalizeAssistantCards(payload?.cards)
          if (!cards.length && Array.isArray(payload?.actions) && payload.actions.length) {
            cards = await proposeCardsFromActions(payload.actions, userContent)
          }
          updateMessage(assistantId, streamBuffer, {
            persist: false,
            ...(cards.length ? { cards } : {}),
          })
          persistMessages()
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
  hadAnyMessages.value = messages.value.length > 0
  isBootstrappingMessages.value = false
  scrollToBottom()
})

onBeforeUnmount(() => {
  closeImagePreview()
  stopLoadingTimer()
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (firstInputTransitionTimer) {
    clearTimeout(firstInputTransitionTimer)
    firstInputTransitionTimer = null
  }
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

.assistant-action-cards {
  width: min(760px, 92%);
  display: grid;
  gap: 10px;
  margin: 2px 0 2px 10px;
}

.assistant-action-card {
  border-radius: 14px;
  border: 1px solid rgba(110, 134, 188, 0.35);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 16px rgba(30, 46, 82, 0.08);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.assistant-action-card.disabled {
  opacity: 0.92;
}

.assistant-action-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.assistant-action-card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1c315e;
}

.assistant-action-card-status {
  font-size: 12px;
  color: #2f67c5;
  background: rgba(79, 136, 230, 0.14);
  border: 1px solid rgba(79, 136, 230, 0.28);
  border-radius: 999px;
  padding: 2px 10px;
  line-height: 20px;
}

.assistant-action-card-summary {
  font-size: 13px;
  color: rgba(30, 49, 90, 0.78);
  line-height: 1.5;
}

.assistant-action-card-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
}

.assistant-action-card-field {
  display: grid;
  gap: 4px;
  border-radius: 10px;
  border: 1px solid rgba(140, 166, 213, 0.25);
  background: rgba(246, 250, 255, 0.86);
  padding: 8px;
}

.assistant-action-card-field span {
  font-size: 12px;
  color: rgba(33, 48, 79, 0.6);
}

.assistant-action-card-field strong {
  font-size: 13px;
  color: #223a70;
  line-height: 1.4;
}

.assistant-action-card-warnings {
  margin: 0;
  padding-left: 16px;
  color: #af5d42;
  font-size: 12px;
  display: grid;
  gap: 4px;
}

.assistant-action-card-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.assistant-action-card-btn {
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assistant-action-card-btn.primary {
  color: #fff;
  background: linear-gradient(135deg, rgba(75, 149, 241, 0.95), rgba(86, 197, 227, 0.95));
}

.assistant-action-card-btn.ghost {
  color: #335994;
  background: rgba(77, 129, 212, 0.1);
  border: 1px solid rgba(77, 129, 212, 0.25);
}

.assistant-action-card-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

  .assistant-action-cards {
    width: 100%;
    margin-left: 0;
  }

  .assistant-action-card-fields {
    grid-template-columns: 1fr;
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

/* Minimal assistant redesign */
.assistant-wrapper {
  gap: 14px;
}

.assistant-panel {
  border-radius: 28px;
  padding: 20px;
  min-height: 640px;
  height: min(78vh, 760px);
  gap: 14px;
}

.assistant-panel.chat-started {
  display: flex;
  flex-direction: column;
}

.assistant-panel.empty-state {
  height: min(72vh, 700px);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.assistant-panel::before {
  background:
    radial-gradient(560px 320px at 50% 0%, rgba(112, 178, 255, 0.12), transparent 65%),
    radial-gradient(420px 280px at 8% 100%, rgba(155, 196, 255, 0.09), transparent 70%);
  opacity: 1;
}

.assistant-body {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  flex: 1;
}

.assistant-panel.chat-started .assistant-body {
  flex: 1 1 auto;
  min-height: 0;
}

.assistant-messages {
  height: 100%;
  max-height: none;
  min-height: 0;
  padding: 24px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(151, 170, 201, 0.24);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
  gap: 12px;
  scroll-behavior: smooth;
}

.assistant-panel.empty-state .assistant-messages {
  border: none;
  background: transparent;
  box-shadow: none;
  min-height: 240px;
  height: auto;
  overflow: hidden;
}

.assistant-panel.empty-state .assistant-body {
  flex: 0 0 auto;
}

.assistant-panel.has-attachments .assistant-messages {
  height: 100%;
  max-height: none;
}

.assistant-empty {
  font-size: 56px;
  font-weight: 500;
  color: rgba(17, 26, 46, 0.96);
  letter-spacing: 0;
}

.assistant-message {
  gap: 4px;
}

.assistant-bubble {
  border-radius: 18px;
  padding: 10px 14px;
  max-width: min(880px, 90%);
  border: 1px solid rgba(167, 184, 212, 0.26);
  box-shadow: 0 2px 8px rgba(28, 38, 58, 0.04);
}

.assistant-message.assistant .assistant-bubble {
  background: rgba(248, 250, 255, 0.88);
  border-color: rgba(186, 197, 220, 0.3);
  box-shadow: none;
}

.assistant-message.user .assistant-bubble {
  background: linear-gradient(135deg, #4c97ff, #67cee7);
  border-color: transparent;
}

.assistant-actions {
  margin: 0 0 0 8px;
}

.assistant-suggestions-row {
  display: none;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 0 6px;
}

.assistant-suggestion {
  border: 1px solid rgba(166, 180, 205, 0.4);
  background: rgba(255, 255, 255, 0.82);
  color: rgba(26, 29, 51, 0.78);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assistant-suggestion:hover {
  border-color: rgba(114, 148, 212, 0.55);
  color: #1e315d;
}

.assistant-suggestion.new-chat {
  background: linear-gradient(135deg, rgba(76, 151, 255, 0.94), rgba(103, 206, 231, 0.94));
  border-color: transparent;
  color: #ffffff;
}

.assistant-input {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 10px;
  min-height: 52px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(170, 182, 204, 0.5);
  box-shadow: 0 8px 24px rgba(22, 34, 58, 0.08);
}

.assistant-panel.chat-started .assistant-input {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  padding: 14px 16px;
  min-height: 132px;
  border-radius: 28px;
}

.assistant-panel.chat-started.first-input-transitioning .assistant-input {
  animation: assistantDockInput 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.assistant-panel.chat-started.first-input-transitioning .assistant-compose-bottom {
  opacity: 0;
  transform: translateY(10px);
  animation: assistantDockTools 0.26s ease 0.2s forwards;
}

.assistant-compose-top {
  width: 100%;
}

.assistant-compose-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.assistant-compose-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.assistant-upload-tile {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(170, 182, 204, 0.55);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(36, 44, 63, 0.84);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assistant-upload-tile:hover {
  border-color: rgba(120, 145, 198, 0.7);
  color: rgba(33, 43, 67, 0.95);
}

.assistant-upload-tile svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.assistant-pill-btn {
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(170, 182, 204, 0.52);
  background: rgba(255, 255, 255, 0.88);
  color: rgba(28, 36, 54, 0.84);
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assistant-pill-btn:hover {
  border-color: rgba(120, 145, 198, 0.7);
}

.assistant-pill-btn.active {
  color: #1f4ea7;
  border-color: rgba(87, 136, 228, 0.58);
  background: rgba(228, 241, 255, 0.78);
}

.assistant-pill-btn.ghost {
  color: rgba(54, 67, 95, 0.88);
}

.assistant-pill-state {
  font-size: 12px;
  font-weight: 700;
  color: rgba(57, 82, 133, 0.76);
}

.assistant-send-inline {
  width: 42px;
  height: 42px;
  min-width: 42px;
}

.assistant-panel.empty-state .assistant-input {
  width: min(760px, calc(100% - 48px));
  margin: 14px auto 0;
}

.assistant-upload {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  box-shadow: none;
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
  color: rgba(32, 39, 56, 0.76);
}

.assistant-input-area {
  min-width: 0;
}

.assistant-input textarea {
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 8px 6px;
  min-height: 40px;
  height: 40px;
  resize: none;
}

.assistant-panel.chat-started .assistant-input textarea {
  min-height: 52px;
  height: 52px;
  padding: 6px 4px;
  font-size: 16px;
}

.assistant-input textarea:focus {
  border: none;
  box-shadow: none;
}

.assistant-send {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  padding: 0;
  display: inline-grid;
  place-items: center;
  background: #0e1118;
  box-shadow: none;
}

.assistant-send svg {
  width: 15px;
  height: 15px;
  stroke: #ffffff;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: translateX(0.5px);
}

.assistant-send:disabled {
  background: rgba(130, 143, 168, 0.45);
  opacity: 1;
}

.assistant-send-label {
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

@keyframes assistantDockInput {
  0% {
    transform: translateY(-160px) scale(0.96);
    opacity: 0.78;
  }
  60% {
    transform: translateY(10px) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes assistantDockTools {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .assistant-panel {
    height: auto;
    min-height: 560px;
  }

  .assistant-empty {
    font-size: 34px;
  }

  .assistant-panel.empty-state .assistant-input {
    width: 100%;
    margin: 0;
  }
}
</style>
