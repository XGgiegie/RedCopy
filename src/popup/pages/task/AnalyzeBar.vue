<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSelect, NText, NTooltip } from 'naive-ui'
import type { DoubaoModel } from '../../../shared/ai-settings'
import { DOUBAO_MODEL_OPTIONS } from '../../../shared/ai-settings'
import type { ContentView } from '../../types/content-view'
import InfoTip from '../../components/InfoTip.vue'

const props = defineProps<{
  contentView: ContentView
  hasNote: boolean
  hasAnalysis: boolean
  hasDraft: boolean
  isAnalyzing: boolean
  isGenerating: boolean
  isAiConfigured: boolean
  isGenerateReady: boolean
  model: DoubaoModel
}>()

const emit = defineEmits<{
  analyze: []
  generate: []
  'update:model': [value: DoubaoModel]
  openSettings: []
}>()

const modelSelectOptions = computed(() =>
  DOUBAO_MODEL_OPTIONS.map((item) => ({ label: item.label, value: item.value })),
)

const selectedModelDescription = computed(
  () => DOUBAO_MODEL_OPTIONS.find((item) => item.value === props.model)?.description ?? '',
)

const MODEL_TIP =
  '豆包大模型均支持配图识图，请在笔记预览中勾选图片参与分析。分析与生成功能共用同一 ARK Key。'

const showPrimaryAction = computed(
  () => props.contentView === 'note' || props.contentView === 'analysis',
)

const primaryMode = computed<'analyze' | 'generate'>(() =>
  props.contentView === 'analysis' ? 'generate' : 'analyze',
)

const primaryLabel = computed(() => {
  if (primaryMode.value === 'generate') {
    return props.hasDraft ? '重新生成类似笔记' : '生成类似笔记'
  }
  return props.hasAnalysis ? '重新分析笔记' : 'AI 分析笔记'
})

const primaryLoading = computed(() =>
  primaryMode.value === 'generate' ? props.isGenerating : props.isAnalyzing,
)

const primaryDisabledReason = computed(() => {
  if (primaryMode.value === 'generate') {
    if (!props.hasAnalysis) return '请先完成 AI 分析'
    if (props.isAnalyzing) return '正在分析中'
    if (!props.isGenerateReady) return '请先配置火山方舟 ARK API Key'
    return ''
  }
  if (!props.hasNote) return '当前任务无笔记内容'
  if (props.isGenerating) return '正在生成类似笔记'
  if (!props.isAiConfigured) return '请先配置火山方舟 ARK API Key'
  return ''
})

const primaryDisabled = computed(() => {
  if (primaryLoading.value) return false
  if (primaryMode.value === 'generate') {
    return !props.isGenerateReady || !props.hasAnalysis || props.isAnalyzing
  }
  return !props.isAiConfigured || !props.hasNote || props.isGenerating
})

function handlePrimaryClick() {
  if (primaryMode.value === 'generate') {
    emit('generate')
    return
  }
  emit('analyze')
}
</script>

<template>
  <div class="analyze-bar">
    <div class="model-row">
      <NSelect
        :value="model"
        :options="modelSelectOptions"
        size="small"
        class="model-select"
        @update:value="emit('update:model', $event)"
      />
      <InfoTip :content="MODEL_TIP" placement="bottom" />
    </div>

    <div v-if="showPrimaryAction" class="analyze-row">
      <NButton
        class="primary-btn"
        type="primary"
        block
        :loading="primaryLoading"
        :disabled="primaryDisabled"
        :title="primaryDisabledReason || undefined"
        @click="handlePrimaryClick"
      >
        {{ primaryLabel }}
      </NButton>

      <NTooltip v-if="!isAiConfigured && !isGenerateReady" trigger="hover">
        <template #trigger>
          <button
            type="button"
            class="warn-icon"
            aria-label="API Key 未配置"
            @click="emit('openSettings')"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1.2 1.5 13h13L8 1.2Zm0 3.2.9 1.8H7.1L8 4.4ZM7.25 8h1.5v3.5h-1.5V8Z" />
            </svg>
          </button>
        </template>
        未配置火山方舟 ARK API Key，点击前往设置
      </NTooltip>
    </div>

    <NText v-if="selectedModelDescription" depth="3" class="model-desc">
      {{ selectedModelDescription }} · 支持图文识图
    </NText>
  </div>
</template>

<style scoped>
.analyze-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-select {
  flex: 1;
  min-width: 0;
}

.analyze-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-btn {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  height: 36px;
}

.model-desc {
  font-size: 11px;
  line-height: 1.4;
}

.warn-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: #fff7e6;
  color: #d46b08;
  cursor: pointer;
  transition: background 0.15s ease;
}

.warn-icon:hover {
  background: #ffe7ba;
}

.warn-icon svg {
  width: 14px;
  height: 14px;
}
</style>
