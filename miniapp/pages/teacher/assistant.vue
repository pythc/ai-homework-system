<template>
  <view class="page ui-shell assistant-page">
    <view class="ui-card chat-card fx-fade-up fx-delay-1">
      <scroll-view class="messages" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
        <view v-if="!messages.length" class="empty-hero">你好，让我们从这里启程</view>

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

      <view class="prompt-block">
        <view class="prompt-label">可尝试的提问</view>
        <scroll-view class="prompt-scroll" scroll-x>
          <view class="prompt-list">
            <view class="prompt-chip new" @click="openNewChat">开启新对话</view>
            <view v-for="prompt in quickPrompts" :key="prompt" class="prompt-chip" @click="applyPrompt(prompt)">
              {{ prompt }}
            </view>
          </view>
        </scroll-view>
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
          placeholder="输入问题，回车发送"
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
          <view class="send-icon"></view>
        </button>
      </view>
      <view v-if="error" class="error">{{ error }}</view>
    </view>

    <TeacherBottomNav active="ai" />
  </view>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { sendAssistantMessage, uploadAssistantImages } from '../../api/assistant'
import { getUser, requireTeacher } from '../../utils/storage'
import TeacherBottomNav from '../../components/TeacherBottomNav.vue'

const input = ref('')
const sending = ref(false)
const error = ref('')
const scrollTop = ref(0)
const sessionId = ref('')
const attachments = ref([])
const messageSeed = ref(1)
const messages = ref([])
const courseName = ref('')

const quickPrompts = computed(() => {
  const base = [
    '帮我分析当前待批改作业情况',
    '给我一个本周教学任务建议',
    '如何提高学生作业提交率',
    '请给这门课设计一次课后练习',
  ]
  if (courseName.value) {
    return [`分析课程 ${courseName.value} 的学习情况`, ...base]
  }
  return base
})

function resolveStorageKey(name) {
  const user = getUser()
  const role = String(user?.role || 'teacher').toLowerCase()
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
    if (url) payload.url = url
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
  if (!requireTeacher()) return
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  courseName.value = decodeURIComponent(current?.options?.courseName || '')
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
  padding: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  overflow: hidden;
}

.messages {
  flex: 1;
  min-height: 0;
  padding: 8rpx 6rpx;
}

.empty-hero {
  height: 100%;
  min-height: 420rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(26, 36, 64, 0.56);
  font-size: 36rpx;
  font-weight: 700;
}

.msg-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 16rpx;
}

.msg-row.user {
  align-items: flex-end;
}

.msg-row.assistant {
  align-items: flex-start;
}

.msg-bubble {
  max-width: 94%;
  border-radius: 20rpx;
  padding: 16rpx 18rpx;
  font-size: 30rpx;
  line-height: 1.58;
}

.msg-row.user .msg-bubble {
  background: linear-gradient(90deg, #59a0ff 0%, #62d2d7 100%);
  color: #fff;
  box-shadow: 0 8rpx 16rpx rgba(74, 139, 241, 0.22);
}

.msg-row.assistant .msg-bubble {
  background: #f2f6ff;
  color: #1a2440;
  border: 2rpx solid #dfe8fb;
}

.msg-bubble.pending {
  opacity: 0.7;
}

.msg-text {
  white-space: pre-wrap;
}

.msg-actions {
  margin-top: 8rpx;
  display: flex;
  gap: 10rpx;
}

.icon-action {
  width: 56rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  border-radius: 14rpx;
  border: 2rpx solid #dbe5f9;
  background: #f1f6ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-action::after {
  border: none;
}

.icon-symbol {
  font-size: 28rpx;
  color: #2a58b7;
  line-height: 1;
}

.prompt-block {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.prompt-label {
  font-size: 21rpx;
  color: rgba(26, 36, 64, 0.54);
}

.prompt-scroll {
  white-space: nowrap;
}

.prompt-list {
  display: inline-flex;
  gap: 10rpx;
  padding-bottom: 2rpx;
}

.prompt-chip {
  flex-shrink: 0;
  border-radius: 14rpx;
  border: 2rpx solid #dbe4f8;
  background: #f4f8ff;
  color: #30456e;
  font-size: 22rpx;
  padding: 10rpx 14rpx;
}

.prompt-chip.new {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(90deg, #5a8ff2 0%, #69d0dc 100%);
}

.attachment-list {
  display: flex;
  gap: 12rpx;
  padding-top: 2rpx;
}

.attachment-item {
  width: 94rpx;
  height: 94rpx;
  border-radius: 14rpx;
  overflow: hidden;
  position: relative;
  border: 2rpx solid #dbe5f7;
}

.attachment-image {
  width: 100%;
  height: 100%;
}

.attachment-delete {
  position: absolute;
  top: 2rpx;
  right: 2rpx;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.composer {
  border-radius: 24rpx;
  border: 2rpx solid #d7e2f7;
  background: #f7faff;
  padding: 8rpx 12rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.composer-input {
  flex: 1;
  min-height: 66rpx;
  max-height: 190rpx;
  font-size: 28rpx;
  line-height: 1.45;
  color: #1a2440;
}

.circle-btn {
  width: 64rpx;
  height: 64rpx;
  min-width: 64rpx;
  min-height: 64rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 2rpx solid #1d2a45;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.circle-btn::after {
  border: none;
}

.plus-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
}

.plus-icon-h,
.plus-icon-v {
  position: absolute;
  background: #1d2a45;
  border-radius: 999rpx;
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

.send-btn {
  border-color: #b6c4dc;
  background: #f7f8fb;
}

.send-btn.disabled {
  opacity: 0.55;
}

.send-icon {
  width: 0;
  height: 0;
  border-top: 11rpx solid transparent;
  border-bottom: 11rpx solid transparent;
  border-left: 17rpx solid #1f2c49;
  transform: translateX(2rpx);
}

.error {
  font-size: 23rpx;
  color: #d94949;
  padding-left: 8rpx;
}
</style>
