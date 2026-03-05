<template>
  <section class="paper-preview-list">
    <div v-if="!items.length" class="empty-box">{{ emptyText }}</div>
    <article
      v-for="(item, index) in items"
      :key="item.key"
      class="paper-preview-item"
    >
      <header class="paper-preview-head">
        <div class="paper-preview-index">第 {{ index + 1 }} 题</div>
        <div class="paper-preview-tags">
          <span class="badge">{{ getQuestionTypeLabel(item.questionType) }}</span>
          <span v-if="item.source === 'custom'" class="badge soft">自定义</span>
          <span v-else class="badge soft">题库</span>
        </div>
      </header>

      <div v-if="item.title" class="paper-preview-title">{{ item.title }}</div>

      <section class="paper-preview-block">
        <div class="paper-preview-label">题目</div>
        <div
          class="paper-preview-content"
          v-mathjax
          v-html="item.promptHtml || '<span class=&quot;placeholder&quot;>暂无题干</span>'"
        />
      </section>

      <section class="paper-preview-block answer">
        <div class="paper-preview-label">答案</div>
        <div
          class="paper-preview-content"
          v-mathjax
          v-html="item.answerHtml || '<span class=&quot;placeholder&quot;>暂无标准答案</span>'"
        />
      </section>
    </article>
  </section>
</template>

<script setup lang="ts">
import { getQuestionTypeLabel, type PaperPreviewItem } from '../utils/paperPreview'

withDefaults(
  defineProps<{
    items: PaperPreviewItem[]
    emptyText?: string
  }>(),
  {
    emptyText: '暂无可预览题目',
  },
)
</script>

<style scoped>
.paper-preview-list {
  display: grid;
  gap: 12px;
}

.paper-preview-item {
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.5);
  background: rgba(255, 255, 255, 0.72);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.paper-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.paper-preview-index {
  font-size: 14px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.paper-preview-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge.soft {
  background: rgba(231, 239, 255, 0.8);
  color: rgba(53, 84, 140, 0.82);
}

.paper-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.84);
}

.paper-preview-block {
  border-radius: 12px;
  border: 1px solid rgba(208, 221, 243, 0.54);
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  display: grid;
  gap: 8px;
}

.paper-preview-block.answer {
  background: rgba(247, 250, 255, 0.78);
}

.paper-preview-label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.62);
}

.paper-preview-content {
  color: rgba(26, 29, 51, 0.86);
  line-height: 1.6;
  font-size: 14px;
  word-break: break-word;
}

:deep(.placeholder) {
  color: rgba(26, 29, 51, 0.48);
}
</style>
