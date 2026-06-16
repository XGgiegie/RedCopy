<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSelect, NText, NTooltip } from 'naive-ui'
import type {
  AnalysisProvider,
  DeepSeekModel,
  DoubaoModel,
} from '../../../shared/ai-settings'
import {
  ANALYSIS_PROVIDER_OPTIONS,
  DEEPSEEK_MODEL_OPTIONS,
  DOUBAO_MODEL_OPTIONS,
  getAnalysisProviderDescription,
} from '../../../shared/ai-settings'
import InfoTip from '../../components/InfoTip.vue'

const props = defineProps<{
  hasNote: boolean
  isAnalyzing: boolean
  isGenerating: boolean
  isAiConfigured: boolean
  hasAnalysis: boolean
  analysisProvider: AnalysisProvider
  analysisModel: DeepSeekModel | DoubaoModel
  hasDeepseekKey: boolean
  hasDoubaoKey: boolean
  analysisProviderLabel: string
}>()

const emit = defineEmits<{
  analyze: []
  'update:analysisProvider': [value: AnalysisProvider]
  'update:analysisModel': [value: DeepSeekModel | DoubaoModel]
  openSettings: []
}>()

const providerSelectOptions = computed(() =>
  ANALYSIS_PROVIDER_OPTIONS.map((item) => {
    const configured =
      item.value === 'deepseek' ? props.hasDeepseekKey : props.hasDoubaoKey
    return {
      label: configured ? item.label : `${item.label}（未配置）`,
      value: item.value,
    }
  }),
)

const modelSelectOptions = computed(() => {
  const source =
    props.analysisProvider === 'doubao' ? DOUBAO_MODEL_OPTIONS : DEEPSEEK_MODEL_OPTIONS
  return source.map((item) => ({ label: item.label, value: item.value }))
})

const selectedModelDescription = computed(() => {
  const source =
    props.analysisProvider === 'doubao' ? DOUBAO_MODEL_OPTIONS : DEEPSEEK_MODEL_OPTIONS
  return source.find((item) => item.value === props.analysisModel)?.description ?? ''
})

const providerCapabilityTip = computed(() => {
  if (props.analysisProvider === 'deepseek') {
    return 'DeepSeek 仅分析笔记文案，不识别配图；生成类似笔记也使用 DeepSeek。'
  }
  return '豆包支持配图识图，请在笔记预览中勾选图片。切换服务商即可更换分析能力。'
})

const currentProviderDesc = computed(() =>
  getAnalysisProviderDescription(props.analysisProvider),
)

const analyzeDisabledReason = computed(() => {
  if (!props.hasNote) return '当前任务无笔记内容'
  if (props.isGenerating) return '正在生成类似笔记'
  if (!props.isAiConfigured) return `请先配置${props.analysisProviderLabel} API Key`
  return ''
})

const apiKeyTooltip = computed(
  () => `「${props.analysisProviderLabel}」未配置 API Key，点击前往设置`,
)
</script>

<template>
  <div class="analyze-bar">
    <div class="model-row">
      <NSelect
        :value="analysisProvider"
        :options="providerSelectOptions"
        size="small"
        class="provider-select"
        @update:value="emit('update:analysisProvider', $event)"
      />
      <NSelect
        :value="analysisModel"
        :options="modelSelectOptions"
        size="small"
        class="model-select"
        @update:value="emit('update:analysisModel', $event)"
      />
      <InfoTip :content="providerCapabilityTip" placement="bottom" />
    </div>

    <div class="analyze-row">
      <NButton
        class="analyze-btn"
        type="primary"
        block
        :loading="isAnalyzing"
        :disabled="!isAiConfigured || !hasNote || isGenerating"
        :title="analyzeDisabledReason || undefined"
        @click="emit('analyze')"
      >
        {{ hasAnalysis ? '重新分析' : 'AI 分析' }}
      </NButton>

      <NTooltip v-if="!isAiConfigured" trigger="hover">
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
        {{ apiKeyTooltip }}
      </NTooltip>
    </div>

    <NText depth="3" class="provider-desc">
      {{ currentProviderDesc }}
      <template v-if="selectedModelDescription"> · {{ selectedModelDescription }}</template>
      <template v-if="analysisProvider === 'deepseek'"> · 生成类似笔记同用 DeepSeek</template>
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
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.provider-select,
.model-select {
  width: 100%;
  min-width: 0;
}

.analyze-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.analyze-btn {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  height: 36px;
}

.provider-desc {
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
