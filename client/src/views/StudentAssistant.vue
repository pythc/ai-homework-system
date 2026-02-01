<template>
  <StudentLayout
    title="AI 助手"
    subtitle="随时提问课程、作业与学习方法"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="学习辅助中心"
  >
    <section class="assistant-wrapper">
      <div class="assistant-panel glass">
        <header class="assistant-header">
          <div>
            <div class="assistant-title">对话助手</div>
          </div>
          <button
            class="assistant-clear"
            :disabled="sending || !messages.length"
            @click="clearConversation"
          >
            清空对话
          </button>
        </header>

        <div class="assistant-body">
          <div ref="listRef" class="assistant-messages">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['assistant-message', message.role]"
          >
            <div class="assistant-avatar">
              {{ message.role === 'user' ? '你' : 'AI' }}
            </div>
            <div class="assistant-bubble">
              <div
                v-if="message.role === 'assistant'"
                class="assistant-markdown"
                v-html="renderMarkdown(message.content)"
              />
              <div v-else class="assistant-text">{{ message.content }}</div>
            </div>
          </div>
          <div v-if="sending" class="assistant-message assistant">
            <div class="assistant-avatar">AI</div>
            <div class="assistant-bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

          <div class="assistant-prompts">
            <div class="assistant-prompts-title">可尝试的提问</div>
            <div class="assistant-prompts-sub">点击即可填充到输入框</div>
            <div class="assistant-prompts-tags">
              <button
                v-for="prompt in quickPrompts"
                :key="prompt"
                class="assistant-prompts-tag"
                @click="applyPrompt(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
            <div class="assistant-prompts-note">
              AI 回答仅供参考，请结合课堂材料与老师要求。
            </div>
          </div>
        </div>

        <div class="assistant-input">
          <textarea
            v-model="input"
            placeholder="输入问题，回车发送，Shift+Enter 换行"
            :disabled="sending"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <button
            class="assistant-send"
            :disabled="sending || !input.trim()"
            @click="sendMessage"
          >
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>

        <div v-if="error" class="assistant-error">{{ error }}</div>
      </div>

    </section>
  </StudentLayout>
</template>

<script setup>
import { marked } from 'marked'
import { nextTick, onMounted, ref } from 'vue'
import StudentLayout from '../components/StudentLayout.vue'
import { sendAssistantMessage } from '../api/assistant'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()

const listRef = ref(null)
const input = ref('')
const sending = ref(false)
const error = ref('')
const messageSeed = ref(1)

const messages = ref([
  {
    id: messageSeed.value++,
    role: 'assistant',
    content: '你好！我是学习助手，可以帮你解释作业要求、整理知识点。',
  },
])

const quickPrompts = [
  '帮我总结今天课程重点',
  '如何规划本周的复习任务？',
  '这道题的解题思路是什么？',
  '请把作业要求拆成步骤',
]

const systemMessage = {
  role: 'system',
  content: '你是学生学习助手，请用清晰、简洁的方式回答，必要时列出步骤。',
}

const renderMarkdown = (content) =>
  marked.parse(content ?? '', { breaks: true })

const scrollToBottom = () => {
  nextTick(() => {
    const element = listRef.value
    if (element) {
      element.scrollTop = element.scrollHeight
    }
  })
}

const pushMessage = (role, content) => {
  messages.value.push({ id: messageSeed.value++, role, content })
  scrollToBottom()
}

const clearConversation = () => {
  messages.value = []
  input.value = ''
  error.value = ''
  scrollToBottom()
}

const applyPrompt = (prompt) => {
  input.value = prompt
}

const sendMessage = async () => {
  const question = input.value.trim()
  if (!question || sending.value) return

  error.value = ''
  input.value = ''
  pushMessage('user', question)
  sending.value = true

  try {
    const response = await sendAssistantMessage([
      systemMessage,
      ...messages.value.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ])
    pushMessage('assistant', response.content || '收到，我们继续聊。')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'AI 请求失败'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  await refreshProfile()
  scrollToBottom()
})
</script>

<style scoped>
.assistant-wrapper {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.assistant-panel {
  border-radius: 26px;
  padding: 24px;
  display: grid;
  gap: 18px;
  min-height: 560px;
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
  display: grid;
  gap: 14px;
  padding: 16px;
  max-height: 420px;
  overflow-y: auto;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.assistant-message {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
}

.assistant-message.user {
  grid-template-columns: 1fr auto;
}

.assistant-message.user .assistant-avatar {
  order: 2;
}

.assistant-message.user .assistant-bubble {
  order: 1;
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

.assistant-message.user .assistant-avatar {
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.85), rgba(116, 220, 210, 0.85));
  color: #ffffff;
}

.assistant-message.user .assistant-bubble {
  background: linear-gradient(135deg, rgba(59, 168, 255, 0.85), rgba(116, 220, 210, 0.85));
  color: #ffffff;
  justify-self: end;
}

.assistant-bubble.typing {
  display: flex;
  gap: 6px;
  align-items: center;
}

.assistant-bubble.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(26, 29, 51, 0.4);
  animation: typing 1s infinite ease-in-out;
}

.assistant-bubble.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.assistant-bubble.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

.assistant-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 12px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.assistant-input textarea {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.75);
  border-radius: 16px;
  padding: 12px 14px;
  font-size: 14px;
  min-height: 60px;
  resize: vertical;
  outline: none;
}

.assistant-input textarea:focus {
  border-color: rgba(61, 115, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(78, 132, 255, 0.18);
}

.assistant-send {
  border: none;
  background: linear-gradient(135deg, rgba(88, 174, 255, 0.9), rgba(108, 229, 215, 0.9));
  color: #ffffff;
  padding: 12px 16px;
  border-radius: 16px;
  font-weight: 600;
  cursor: pointer;
  height: 70%;
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

.assistant-prompts {
  border-radius: 20px;
  padding: 16px;
  display: grid;
  gap: 10px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.assistant-prompts-title {
  font-weight: 700;
}

.assistant-prompts-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
}

.assistant-prompts-tags {
  display: grid;
  gap: 8px;
}

.assistant-prompts-tag {
  border: none;
  text-align: left;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.8);
}

.assistant-prompts-note {
  font-size: 11px;
  color: rgba(26, 29, 51, 0.5);
}

@keyframes typing {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-4px);
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
