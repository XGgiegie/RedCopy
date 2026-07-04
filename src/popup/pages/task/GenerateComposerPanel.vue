<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NInput, NText } from 'naive-ui'
import {
  CREATION_PURPOSE_OPTIONS,
  type CreationIntentPayload,
  type CreationPurposeKey,
} from '../../../shared/creation-intent'
import type { AnalyzeGenerateMode } from '../../../shared/messages'

const props = withDefaults(defineProps<{
  mode: AnalyzeGenerateMode
  purpose: CreationPurposeKey | null
  topic: string
  isGenerating: boolean
  hasDraft: boolean
  errorMessage?: string
  showCancel?: boolean
  cancelLabel?: string
}>(), {
  errorMessage: '',
  showCancel: false,
  cancelLabel: '返回',
})

const emit = defineEmits<{
  'update:purpose': [value: CreationPurposeKey | null]
  'update:topic': [value: string]
  confirm: [payload: CreationIntentPayload]
  cancel: []
}>()

const isDirect = computed(() => props.mode === 'direct')
const panelTitle = computed(() => {
  if (isDirect.value) return props.hasDraft ? '重新直接创作' : '直接创作'
  return props.hasDraft ? '重新仿照创作' : '仿照创作'
})
const panelSubtitle = computed(() =>
  isDirect.value
    ? '先明确这条笔记属于哪一类创作，再给出具体主题。'
    : '先锁定仿写方向，再结合参考笔记生成新稿。',
)
const panelHint = computed(() =>
  isDirect.value
    ? '直接创作不会分析参考笔记，而是根据你选择的主题类型与明确主题直接生成。'
    : '仿照创作会先理解参考笔记和已选配图，再按你的主题方向去重写。',
)
const placeholder = computed(() =>
  isDirect.value
    ? '例如：AI 代码审查工作流 / 独立开发者如何做第一笔付费转化'
    : '例如：把这篇参考笔记改写成独立开发复盘 / 技术分享避坑指南',
)
const confirmLabel = computed(() => (isDirect.value ? '开始直接创作' : '开始仿照创作'))
const confirmDisabled = computed(
  () => props.isGenerating || !props.purpose || !props.topic.trim(),
)

function selectPurpose(nextPurpose: CreationPurposeKey) {
  emit('update:purpose', nextPurpose)
}

function updateTopic(value: string) {
  emit('update:topic', value)
}

function confirm() {
  if (!props.purpose) return
  emit('confirm', {
    purpose: props.purpose,
    topic: props.topic.trim(),
  })
}
</script>

<template>
  <div class="composer-panel">
    <div class="composer-header">
      <span class="composer-title">{{ panelTitle }}</span>
      <span class="composer-subtitle">{{ panelSubtitle }}</span>
    </div>

    <NText depth="3" class="composer-hint">
      {{ panelHint }}
    </NText>

    <div v-if="errorMessage" class="composer-error" role="alert">
      {{ errorMessage }}
    </div>

    <div class="purpose-section">
      <NText depth="3" class="purpose-label">选择笔记主题</NText>
      <div class="purpose-preset-list">
        <NButton
          v-for="preset in CREATION_PURPOSE_OPTIONS"
          :key="preset.key"
          size="small"
          :type="purpose === preset.key ? 'primary' : 'default'"
          :secondary="purpose !== preset.key"
          :disabled="isGenerating"
          @click="selectPurpose(preset.key)"
        >
          {{ preset.label }}
        </NButton>
      </div>
      <NText depth="3" class="purpose-desc">
        {{ purpose ? CREATION_PURPOSE_OPTIONS.find((item) => item.key === purpose)?.description : '先选主题类型，生成模板才会自动拼接对应的子提示词。' }}
      </NText>
    </div>

    <NInput
      :value="topic"
      type="textarea"
      :placeholder="placeholder"
      :autosize="{ minRows: 4, maxRows: 8 }"
      :disabled="isGenerating"
      class="topic-input"
      @update:value="updateTopic"
    />

    <div class="composer-actions">
      <NButton v-if="showCancel" :disabled="isGenerating" @click="$emit('cancel')">
        {{ cancelLabel }}
      </NButton>
      <NButton
        type="primary"
        :loading="isGenerating"
        :disabled="confirmDisabled"
        @click="confirm"
      >
        {{ confirmLabel }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.composer-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 14px 12px 16px;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 12px;
}

.composer-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer-title {
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}

.composer-subtitle {
  font-size: 12px;
  color: #86909c;
  line-height: 1.5;
}

.composer-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.composer-error {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #ffccc7;
  background: #fff1f0;
  color: #cf1322;
  font-size: 12px;
  line-height: 1.5;
}

.purpose-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purpose-label {
  display: block;
  font-size: 12px;
}

.purpose-preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.purpose-desc {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.topic-input {
  width: 100%;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>