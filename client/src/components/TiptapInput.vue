<template>
  <div class="tiptap-shell" :class="{ disabled }">
    <div class="tiptap-toolbar">
      <button class="tool-btn" :disabled="disabled" type="button" title="撤销" @click="runCommand('undo')">
        <Undo2 class="tool-icon" />
      </button>
      <button class="tool-btn" :disabled="disabled" type="button" title="重做" @click="runCommand('redo')">
        <Redo2 class="tool-icon" />
      </button>
      <span class="tool-divider" />
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('heading', { level: 2 }) }"
        :disabled="disabled"
        type="button"
        title="标题"
        @click="runCommand('heading')"
      >
        <Heading2 class="tool-icon" />
      </button>
      <span class="tool-divider" />
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('bulletList') }"
        :disabled="disabled"
        type="button"
        title="无序列表"
        @click="runCommand('bulletList')"
      >
        <List class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('orderedList') }"
        :disabled="disabled"
        type="button"
        title="有序列表"
        @click="runCommand('orderedList')"
      >
        <ListOrdered class="tool-icon" />
      </button>
      <span class="tool-divider" />
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('codeBlock') }"
        :disabled="disabled"
        type="button"
        title="代码块"
        @click="runCommand('codeBlock')"
      >
        <Code2 class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('bold') }"
        :disabled="disabled"
        type="button"
        title="加粗"
        @click="runCommand('bold')"
      >
        <Bold class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('italic') }"
        :disabled="disabled"
        type="button"
        title="斜体"
        @click="runCommand('italic')"
      >
        <Italic class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('underline') }"
        :disabled="disabled"
        type="button"
        title="下划线"
        @click="runCommand('underline')"
      >
        <Underline class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('strike') }"
        :disabled="disabled"
        type="button"
        title="删除线"
        @click="runCommand('strike')"
      >
        <Strikethrough class="tool-icon" />
      </button>
      <span class="tool-divider" />
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('superscript') }"
        :disabled="disabled"
        type="button"
        title="上标"
        @click="runCommand('superscript')"
      >
        <SuperscriptIcon class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('subscript') }"
        :disabled="disabled"
        type="button"
        title="下标"
        @click="runCommand('subscript')"
      >
        <SubscriptIcon class="tool-icon" />
      </button>
      <span class="tool-divider" />
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('paragraph', { textAlign: 'left' }) }"
        :disabled="disabled"
        type="button"
        title="左对齐"
        @click="runCommand('alignLeft')"
      >
        <AlignLeft class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('paragraph', { textAlign: 'center' }) }"
        :disabled="disabled"
        type="button"
        title="居中对齐"
        @click="runCommand('alignCenter')"
      >
        <AlignCenter class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('paragraph', { textAlign: 'right' }) }"
        :disabled="disabled"
        type="button"
        title="右对齐"
        @click="runCommand('alignRight')"
      >
        <AlignRight class="tool-icon" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: isEditorActive('paragraph', { textAlign: 'justify' }) }"
        :disabled="disabled"
        type="button"
        title="两端对齐"
        @click="runCommand('alignJustify')"
      >
        <AlignJustify class="tool-icon" />
      </button>
    </div>
    <div class="tiptap-content-wrap">
      <EditorContent class="tiptap-content" :editor="editor" />
      <div v-if="!props.modelValue?.trim() && props.placeholder" class="editor-placeholder">
        {{ props.placeholder }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  Undo2,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    disabled?: boolean
    minHeight?: number
  }>(),
  {
    modelValue: '',
    placeholder: '',
    disabled: false,
    minHeight: 160,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', payload: string): void
}>()

const syncingFromParent = ref(false)
const minHeightPx = computed(() => `${Math.max(120, Number(props.minHeight || 160))}px`)

const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [2] } }),
    UnderlineExtension,
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
  ],
  editable: !props.disabled,
  content: props.modelValue || '',
  onUpdate: ({ editor: editorInstance }) => {
    if (syncingFromParent.value) return
    emit('update:modelValue', editorInstance.isEmpty ? '' : editorInstance.getHTML())
  },
})

const isEditorActive = (name: string, attrs?: Record<string, unknown>) =>
  editor.value ? editor.value.isActive(name, attrs) : false

const runCommand = (command: string) => {
  if (!editor.value || props.disabled) return
  const chain = editor.value.chain().focus()
  switch (command) {
    case 'undo':
      chain.undo().run()
      break
    case 'redo':
      chain.redo().run()
      break
    case 'heading':
      chain.toggleHeading({ level: 2 }).run()
      break
    case 'bulletList':
      chain.toggleBulletList().run()
      break
    case 'orderedList':
      chain.toggleOrderedList().run()
      break
    case 'codeBlock':
      chain.toggleCodeBlock().run()
      break
    case 'bold':
      chain.toggleBold().run()
      break
    case 'italic':
      chain.toggleItalic().run()
      break
    case 'underline':
      chain.toggleUnderline().run()
      break
    case 'strike':
      chain.toggleStrike().run()
      break
    case 'superscript':
      chain.toggleSuperscript().run()
      break
    case 'subscript':
      chain.toggleSubscript().run()
      break
    case 'alignLeft':
      chain.setTextAlign('left').run()
      break
    case 'alignCenter':
      chain.setTextAlign('center').run()
      break
    case 'alignRight':
      chain.setTextAlign('right').run()
      break
    case 'alignJustify':
      chain.setTextAlign('justify').run()
      break
    default:
      break
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    const nextValue = value || ''
    const currentValue = editor.value.getHTML()
    if (currentValue === nextValue) return
    syncingFromParent.value = true
    editor.value.commands.setContent(nextValue, false)
    syncingFromParent.value = false
  },
)

watch(
  () => props.disabled,
  (value) => {
    editor.value?.setEditable(!value)
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.tiptap-shell {
  border-radius: 14px;
  border: 1px solid rgba(176, 195, 228, 0.72);
  background: rgba(255, 255, 255, 0.82);
  overflow: hidden;
}

.tiptap-shell.disabled {
  opacity: 0.72;
}

.tiptap-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(181, 201, 233, 0.6);
  background: rgba(237, 244, 255, 0.52);
}

.tool-btn {
  border: none;
  background: transparent;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(79, 88, 111, 0.9);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(206, 222, 247, 0.52);
  color: rgba(36, 44, 69, 0.96);
}

.tool-btn.active {
  background: rgba(183, 208, 245, 0.66);
  color: rgba(26, 29, 51, 0.95);
}

.tool-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tool-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.tool-divider {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: rgba(171, 193, 228, 0.74);
}

.tiptap-content-wrap {
  position: relative;
}

.tiptap-content {
  min-height: v-bind(minHeightPx);
}

.tiptap-content :deep(.ProseMirror) {
  min-height: v-bind(minHeightPx);
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(26, 29, 51, 0.92);
  outline: none;
}

.tiptap-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: '';
}

.editor-placeholder {
  position: absolute;
  left: 15px;
  top: 12px;
  font-size: 14px;
  color: rgba(26, 29, 51, 0.36);
  pointer-events: none;
}
</style>
