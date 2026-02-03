<template>
  <AdminLayout
    title="题目详情"
    subtitle="完整题干与答案"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库目录"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">账号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="panel glass">
      <div class="panel-title">题目</div>
      <div v-if="question" class="detail-body">
        <div class="detail-row">
          <div class="detail-label">标题</div>
          <div class="detail-value">{{ question.title || '未命名' }}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">类型</div>
          <div class="detail-value">
            {{ question.nodeType }} / {{ question.questionType }}
          </div>
        </div>

        <div v-if="question.nodeType === 'GROUP'" class="detail-block">
          <div class="detail-label">题干</div>
          <MathjaxBlock
            :key="`${questionKey}-stem`"
            :html="renderMarkdown(question.stem)"
          />
          <div v-if="renderMedia(question.stem).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.stem)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>
        </div>

        <div v-else class="detail-block">
          <div class="detail-label">题干</div>
          <MathjaxBlock
            :key="`${questionKey}-prompt`"
            :html="renderMarkdown(question.prompt)"
          />
          <div v-if="renderMedia(question.prompt).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.prompt)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>

          <div class="detail-label">答案</div>
          <MathjaxBlock
            :key="`${questionKey}-answer`"
            :html="renderMarkdown(question.standardAnswer)"
          />
          <div v-if="renderMedia(question.standardAnswer).length" class="detail-media">
            <img
              v-for="(img, index) in renderMedia(question.standardAnswer)"
              :key="index"
              :src="img.url"
              :alt="img.caption || 'image'"
            />
          </div>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ loadError || '加载中...' }}
      </div>
    </section>
  </AdminLayout>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onMounted, onUpdated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminProfile } from '../composables/useAdminProfile'
import { getQuestionBankQuestion } from '../api/questionBank'
import MarkdownIt from 'markdown-it'

const { profileName, profileAccount, refreshProfile } = useAdminProfile()
const route = useRoute()
const loadError = ref('')
const question = ref(null)
const questionKey = computed(() => String(route.params.questionId ?? ''))

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
})

const MathjaxBlock = defineComponent({
  name: 'MathjaxBlock',
  props: {
    html: { type: String, required: true },
  },
  setup(props) {
    const elRef = ref(null)
    let retryTimer = null

    const scheduleTypeset = () => {
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
      retryTimer = setTimeout(() => {
        void typeset()
      }, 60)
    }

    const typeset = async () => {
      const mathjax = window.MathJax
      if (!mathjax?.startup?.promise || !mathjax?.typesetPromise) {
        scheduleTypeset()
        return
      }
      await mathjax.startup.promise
      await nextTick()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (!elRef.value) return

      // Unescape html entities and double slashes so MathJax can parse LaTeX.
      let html = elRef.value.innerHTML
        .replace(/&#36;|&#x24;/gi, '$')
        .replace(/&#92;|&#x5c;/gi, '\\')
        .replace(/\\\\/g, '\\')
        .replace(/\\\$/g, '$')
        .replace(/&gt;/gi, '>')
        .replace(/&lt;/gi, '<')
        .replace(/&amp;/gi, '&')

      // Keep $...$ and $$...$$ as-is; MathJax handles them directly.
      html = html

      elRef.value.innerHTML = html

      if (mathjax.typesetClear) {
        mathjax.typesetClear([elRef.value])
      }
      if (mathjax.texReset) {
        mathjax.texReset()
      }
      if (mathjax.startup?.document) {
        mathjax.startup.document.clear()
        mathjax.startup.document.updateDocument()
      }
      await mathjax.typesetPromise([elRef.value])
    }

    onMounted(scheduleTypeset)
    onUpdated(scheduleTypeset)
    watch(
      () => props.html,
      () => scheduleTypeset(),
      { flush: 'post' },
    )

    return () =>
      h('div', {
        ref: elRef,
        class: 'detail-text',
        innerHTML: props.html,
      })
  },
})

onMounted(async () => {
  await refreshProfile()
  await fetchQuestion()
})

watch(
  () => route.params.questionId,
  async () => {
    await fetchQuestion()
  },
)

const fetchQuestion = async () => {
  loadError.value = ''
  try {
    question.value = await getQuestionBankQuestion(String(route.params.questionId))
    await nextTick()
    const mathjax = window.MathJax
    if (mathjax?.typesetPromise) {
      await mathjax.typesetPromise()
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载题目失败'
  }
}

const normalizeTextBlock = (value) => {
  if (!value) return { text: '', media: [] }
  if (typeof value === 'string') return { text: value, media: [] }
  const text = value.text ?? ''
  const media = Array.isArray(value.media) ? value.media : []
  return { text, media }
}

const renderMarkdown = (value) => {
  const text = normalizeTextBlock(value).text || ''
  const normalized = text.replace(/\\\\/g, '\\').replace(/\\\$/g, '$')
  const html = markdown.render(normalized)
  return html
    .replace(/&#36;|&#x24;/gi, '$')
    .replace(/&#92;|&#x5c;/gi, '\\')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;/gi, '&')
    .replace(/\\\\/g, '\\')
    .replace(/\\\$/g, '$')
}
const renderMedia = (value) => normalizeTextBlock(value).media
</script>
