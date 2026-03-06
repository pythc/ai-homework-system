<template>
  <view class="page ui-shell assistant-page">
    <view
      class="ui-card chat-card fx-fade-up fx-delay-1"
      :class="{ 'has-attachments': attachments.length, 'empty-state': !messages.length }"
    >
      <scroll-view class="messages" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
        <view v-if="!messages.length" class="empty-hero">你在忙什么？</view>

        <view v-for="(item, idx) in messages" :key="item.id" class="msg-row fx-fade-up" :class="item.role">
          <view class="msg-bubble" :class="{ pending: item.pending }">
            <text class="msg-text" user-select>{{ item.pending ? '...' : item.content }}</text>
          </view>

          <view v-if="item.role === 'assistant' && item.content && !item.pending" class="msg-actions">
            <button class="icon-action" title="复制" @click="copyMessage(item.content)">
              <text class="icon-symbol">⧉</text>
            </button>
            <button class="icon-action" title="重试" @click="retryMessage(idx)">
              <text class="icon-symbol">↻</text>
            </button>
          </view>
        </view>
      </scroll-view>

      <view v-if="!messages.length" class="assistant-suggestions-row">
        <view class="assistant-suggestion new-chat" @click="openNewChat">新对话</view>
        <view
          v-for="prompt in quickPrompts"
          :key="`empty-${prompt}`"
          class="assistant-suggestion"
          @click="applyPrompt(prompt)"
        >
          {{ prompt }}
        </view>
      </view>

      <view v-if="attachments.length" class="attachment-list">
        <view v-for="(item, idx) in attachments" :key="`${item.path}-${idx}`" class="attachment-item">
          <image class="attachment-image" :src="item.path" mode="aspectFill" />
          <view class="attachment-delete" @click="removeAttachment(idx)">×</view>
        </view>
      </view>
      <view class="composer fx-fade-up">
        <button class="circle-btn plus-btn" @click="pickImages">
          <view class="plus-icon">
            <view class="plus-icon-h"></view>
            <view class="plus-icon-v"></view>
          </view>
        </button>

        <textarea
          v-model="input"
          class="composer-input"
          placeholder="有问题，尽管问"
          placeholder-style="color: rgba(26, 36, 64, 0.45);"
          :disabled="sending"
          maxlength="4000"
          confirm-type="send"
          auto-height
          @confirm="sendMessage"
        />

        <button
          class="circle-btn send-btn"
          :class="{ disabled: sending || (!input.trim() && !attachments.length) }"
          :disabled="sending || (!input.trim() && !attachments.length)"
          @click="sendMessage"
        >
          <text v-if="sending" class="send-loading">...</text>
          <view v-else class="send-icon"></view>
        </button>
      </view>
      <view v-if="error" class="error">{{ error }}</view>
    </view>

    <StudentBottomNav active="ai" />
  </view>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { sendAssistantMessage, uploadAssistantImages } from '../../api/assistant'
import { getUser, requireStudent } from '../../utils/storage'
import StudentBottomNav from '../../components/StudentBottomNav.vue'

const input = ref('')
const sending = ref(false)
const error = ref('')
const scrollTop = ref(0)
const sessionId = ref('')
const attachments = ref([])
const messageSeed = ref(1)
const messages = ref([])

const quickPrompts = [
  '你好，介绍一下自己',
  '帮我看看今晚未完成作业',
  '分析我上次作业的成绩如何',
  '这题应该怎么解？',
  '如果系统体验不好我该怎么反馈',
]

function resolveStorageKey(name) {
  const user = getUser()
  const role = String(user?.role || 'student').toLowerCase()
  const userId = user?.userId || 'anonymous'
  return `miniapp.assistant.${name}.${role}.${userId}`
}

function createSessionId() {
  return `mini-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadSession() {
  const key = resolveStorageKey('session')
  const existing = uni.getStorageSync(key)
  if (existing) {
    sessionId.value = existing
    return
  }
  const id = createSessionId()
  sessionId.value = id
  uni.setStorageSync(key, id)
}

function loadMessages() {
  const key = resolveStorageKey('messages')
  const raw = uni.getStorageSync(key)

  if (!raw) {
    messages.value = []
    return
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed) || !parsed.length) {
      messages.value = []
      return
    }
    messages.value = parsed.map((item, idx) => ({
      id: item.id || idx + 1,
      role: item.role === 'user' ? 'user' : 'assistant',
      content: String(item.content || ''),
      pending: false,
    }))
    const maxId = messages.value.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0)
    messageSeed.value = maxId + 1
  } catch {
    messages.value = []
  }
}

function persistMessages() {
  const key = resolveStorageKey('messages')
  const plain = messages.value.map((item) => ({
    id: item.id,
    role: item.role,
    content: item.content,
  }))
  uni.setStorageSync(key, plain)
}

function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = Date.now()
  })
}

function pushMessage(role, content, pending = false) {
  const id = messageSeed.value++
  messages.value.push({ id, role, content, pending })
  persistMessages()
  scrollToBottom()
  return id
}

function updateMessage(id, payload) {
  const target = messages.value.find((item) => item.id === id)
  if (!target) return
  Object.assign(target, payload)
  persistMessages()
  scrollToBottom()
}

function clearAttachments() {
  attachments.value = []
}

function openNewChat() {
  if (sending.value) return
  messages.value = []
  persistMessages()
  scrollToBottom()
}

function applyPrompt(prompt) {
  if (sending.value) return
  input.value = prompt
}

function pickImages() {
  const remain = 4 - attachments.value.length
  if (remain <= 0) {
    uni.showToast({ title: '最多上传4张图片', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const files = (res.tempFiles || []).map((file) => ({
        path: file.path || file.tempFilePath,
        name: (file.path || file.tempFilePath || '').split('/').pop() || 'image',
      }))
      attachments.value = [...attachments.value, ...files].slice(0, 4)
    },
  })
}

function removeAttachment(index) {
  attachments.value.splice(index, 1)
}

function inferMimeType(filePath) {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}

function readLocalImageAsDataUrl(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const fs = uni.getFileSystemManager()
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          const mime = inferMimeType(filePath)
          resolve(`data:${mime};base64,${res.data || ''}`)
        },
        fail: () => reject(new Error('图片读取失败')),
      })
    } catch {
      reject(new Error('图片读取失败'))
    }
  })
}

async function buildImagesPayload() {
  if (!attachments.value.length) return []
  const paths = attachments.value.map((item) => item.path)
  const dataUrls = await Promise.all(paths.map((path) => readLocalImageAsDataUrl(path)))
  let uploaded = []

  try {
    uploaded = await uploadAssistantImages(paths)
  } catch {
    uploaded = []
  }

  return attachments.value.map((item, idx) => {
    const payload = {
      name: item.name,
      dataUrl: dataUrls[idx],
    }
    const url =
      uploaded[idx]?.url || uploaded.find((image) => image?.name === item.name)?.url || ''
    if (url) {
      payload.url = url
    }
    return payload
  })
}

async function sendByQuestion(question) {
  if (sending.value) return
  const text = String(question || '').trim()
  if (!text && !attachments.value.length) return

  const userContent = text || '请结合我上传的图片给出分析。'
  pushMessage('user', userContent)
  sending.value = true
  error.value = ''
  input.value = ''

  const assistantId = pushMessage('assistant', '', true)

  try {
    const images = await buildImagesPayload()
    const data = await sendAssistantMessage(userContent, {
      sessionId: sessionId.value,
      thinking: 'disabled',
      images,
    })
    const answer = data?.answer || '我暂时没有得到有效回复，请稍后再试。'
    updateMessage(assistantId, { content: answer, pending: false })
  } catch (err) {
    const message = err?.message || 'AI 服务暂时不可用，请稍后重试。'
    error.value = message
    updateMessage(assistantId, { content: message, pending: false })
  } finally {
    sending.value = false
    clearAttachments()
  }
}

async function sendMessage() {
  await sendByQuestion(input.value)
}

async function retryMessage(index) {
  if (sending.value) return
  let question = ''
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages.value[i]?.role === 'user' && messages.value[i]?.content) {
      question = messages.value[i].content
      break
    }
  }
  if (!question) {
    uni.showToast({ title: '没有可重试的问题', icon: 'none' })
    return
  }
  await sendByQuestion(question)
}

function copyMessage(content) {
  if (!content) return
  uni.setClipboardData({
    data: content,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'none' })
    },
  })
}

onMounted(() => {
  if (!requireStudent()) return
  loadSession()
  loadMessages()
  scrollToBottom()
})
</script>

<style scoped>
.assistant-page {
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  padding-top: 12rpx;
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

.chat-card {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  overflow: hidden;
  border-radius: 28rpx;
}

.chat-card.empty-state {
  min-height: 520rpx;
}

.messages {
  flex: 1;
  min-height: 0;
  padding: 12rpx 10rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.58);
  border: 2rpx solid rgba(151, 170, 201, 0.24);
}

.chat-card.empty-state .messages {
  background: transparent;
  border: 0;
}

.empty-hero {
  min-height: 460rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(17, 26, 46, 0.94);
  font-size: 64rpx;
  font-weight: 500;
  line-height: 1.15;
}

.msg-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 14rpx;
}

.msg-row.user {
  align-items: flex-end;
}

.msg-row.assistant {
  align-items: flex-start;
}

.msg-bubble {
  max-width: 86%;
  border-radius: 18rpx;
  padding: 16rpx 20rpx;
}

.msg-bubble.pending {
  opacity: 0.72;
  animation: typingPulse 1.2s ease-in-out infinite;
}

.msg-row.assistant .msg-bubble {
  background: #edf2fa;
}

.msg-row.user .msg-bubble {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
}

.msg-text {
  font-size: 30rpx;
  line-height: 1.52;
  white-space: pre-wrap;
  word-break: break-word;
  color: #1a2440;
}

.msg-row.user .msg-text {
  color: #2f67c8;
  font-weight: 700;
}

.msg-actions {
  margin-top: 8rpx;
  display: flex;
  gap: 10rpx;
}

.icon-action {
  margin: 0;
  width: 54rpx;
  height: 54rpx;
  border-radius: 14rpx;
  border: 0;
  background: #e5eefb;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.icon-action:active {
  transform: scale(0.94);
  box-shadow: 0 8rpx 16rpx rgba(32, 58, 106, 0.16);
}

.icon-symbol {
  font-size: 28rpx;
  color: #3159b2;
  line-height: 1;
  font-weight: 700;
}

.assistant-suggestions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  align-items: center;
}

.assistant-suggestion {
  border: 2rpx solid rgba(166, 180, 205, 0.4);
  background: rgba(255, 255, 255, 0.82);
  color: rgba(26, 29, 51, 0.78);
  border-radius: 999rpx;
  padding: 10rpx 16rpx;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.2;
}

.assistant-suggestion.new-chat {
  background: linear-gradient(90deg, #5a8ff2 0%, #69d0dc 100%);
  border-color: transparent;
  color: #fff;
}

.attachment-list {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.attachment-item {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 2rpx solid #d7e0f0;
  position: relative;
}

.attachment-image {
  width: 100%;
  height: 100%;
}

.attachment-delete {
  position: absolute;
  right: 4rpx;
  top: 4rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 14rpx;
  background: rgba(18, 28, 44, 0.64);
  color: #fff;
  text-align: center;
  line-height: 26rpx;
  font-size: 20rpx;
}

.composer {
  margin-top: auto;
  border-radius: 999rpx;
  border: 2rpx solid rgba(170, 182, 204, 0.5);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10rpx 30rpx rgba(22, 34, 58, 0.08);
  padding: 10rpx 12rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  animation: composerEnter 0.55s ease both;
}

.chat-card.empty-state .composer {
  margin-bottom: 46rpx;
}

.composer-input {
  flex: 1;
  min-height: 66rpx;
  max-height: 220rpx;
  border: 0;
  background: transparent;
  font-size: 30rpx;
  color: #1a2440;
  line-height: 1.42;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.circle-btn {
  margin: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0;
  line-height: 1;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.plus-btn {
  border: 3rpx solid #243b6a;
  background: #fff;
  color: #243b6a;
}

.send-btn {
  border: 0;
  background: #0e1118;
  color: #fff;
}

.send-btn:not(.disabled) {
  background: #0e1118;
  color: #fff;
}

.send-btn.disabled {
  background: rgba(130, 143, 168, 0.45);
  color: #fff;
}

.plus-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
}

.plus-icon-h,
.plus-icon-v {
  position: absolute;
  background: currentColor;
  border-radius: 2rpx;
}

.plus-icon-h {
  left: 0;
  right: 0;
  top: 12rpx;
  height: 4rpx;
}

.plus-icon-v {
  top: 0;
  bottom: 0;
  left: 12rpx;
  width: 4rpx;
}

.send-icon {
  width: 0;
  height: 0;
  border-top: 10rpx solid transparent;
  border-bottom: 10rpx solid transparent;
  border-left: 17rpx solid #fff;
  margin-left: 2rpx;
}

.send-loading {
  font-size: 24rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.circle-btn:active {
  transform: scale(0.94);
}

.error {
  color: #d65656;
  font-size: 24rpx;
}

.icon-action::after,
.circle-btn::after,
.plus-btn::after,
.send-btn::after {
  border: none;
}

.messages .msg-row:nth-child(1) {
  animation-delay: 0.04s;
}

.messages .msg-row:nth-child(2) {
  animation-delay: 0.08s;
}

.messages .msg-row:nth-child(3) {
  animation-delay: 0.12s;
}

.messages .msg-row:nth-child(4) {
  animation-delay: 0.16s;
}

@keyframes typingPulse {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.72;
  }
  50% {
    transform: translateY(-2rpx) scale(1.02);
    opacity: 0.95;
  }
}

@keyframes composerEnter {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
