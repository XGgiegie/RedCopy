<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NModal, NText } from 'naive-ui'
import type { AnalyzeGenerateMode } from '../../../shared/messages'

const props = defineProps<{
  show: boolean
  initialTopic?: string
  mode: AnalyzeGenerateMode
  isGenerating: boolean
  hasDraft: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [topic: string]
}>()

const topic = ref('')

const isDirect = computed(() => props.mode === 'direct')
const dialogTitle = computed(() => {
  if (isDirect.value) return props.hasDraft ? '重新直接创作' : '直接创作'
  return props.hasDraft ? '重新仿照创作' : '仿照创作'
})
const dialogHint = computed(() =>
  isDirect.value
    ? '不分析笔记，直接根据主题、产品、场景或卖点生成一篇创作草稿。'
    : '将先理解参考笔记的结构与卖点，再生成一篇仿照创作草稿。以下内容可选填。',
)
const placeholder = computed(() =>
  isDirect.value
    ? '想创作什么 / 产品卖点 / 使用场景（必填）'
    : '想卖什么 / 主题或卖点（选填，留空也能生成）',
)
const confirmLabel = computed(() =>
  isDirect.value ? '直接创作' : '仿照创作',
)
const confirmDisabled = computed(
  () => props.isGenerating || (isDirect.value && !topic.value.trim()),
)

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      topic.value = props.initialTopic ?? ''
    }
  },
)

function close() {
  emit('update:show', false)
}

function confirm() {
  emit('confirm', topic.value.trim())
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="generate-dialog"
    :style="{ width: 'min(360px, calc(100vw - 24px))' }"
    :title="dialogTitle"
    :mask-closable="!isGenerating"
    :closable="!isGenerating"
    @update:show="emit('update:show', $event)"
  >
    <NText depth="3" class="dialog-hint">
      {{ dialogHint }}
    </NText>

    <NInput
      v-model:value="topic"
      type="textarea"
      :placeholder="placeholder"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :disabled="isGenerating"
      class="topic-input"
    />

    <template #footer>
      <div class="dialog-footer">
        <NButton :disabled="isGenerating" @click="close">取消</NButton>
        <NButton
          type="primary"
          :loading="isGenerating"
          :disabled="confirmDisabled"
          @click="confirm"
        >
          {{ confirmLabel }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.topic-input {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
