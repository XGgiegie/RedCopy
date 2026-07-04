<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NText, NTooltip } from 'naive-ui'
import { DOUBAO_MODEL_OPTIONS } from '../../../shared/ai-settings'
import { PRO_TEXT_MODEL } from '../../../shared/pro-ai-api'
import type { ContentView } from '../../types/content-view'
import InfoTip from '../../components/InfoTip.vue'

const props = defineProps<{
  contentView: ContentView
  isDirectCreation: boolean
  hasNote: boolean
  hasDraft: boolean
  isAnalyzing: boolean
  isGenerating: boolean
  isAiConfigured: boolean
  isGenerateReady: boolean
  isProPlan: boolean
}>()

const emit = defineEmits<{
  generate: []
  openSettings: []
}>()

const selectedModelDescription = computed(
  () =>
    props.isProPlan
      ? props.isDirectCreation
        ? 'Pro 文本模型，直接生成创作草稿；生成会在后台继续'
        : 'Pro 图文模型，生成前会先理解笔记结构；生成会在后台继续'
      : DOUBAO_MODEL_OPTIONS[0].description,
)

const modelTip = computed(() => props.isProPlan
  ? `Pro 创作使用 ${PRO_TEXT_MODEL}，请求会等待更长时间以提升稳定性；生成已支持后台运行。`
  : props.isDirectCreation
    ? '豆包 Doubao-Seed-2.1 Pro 会根据主题直接生成创作草稿；生成已支持后台运行。'
    : '豆包 Doubao-Seed-2.1 Pro 支持配图识图，请在笔记预览中勾选图片参与生成；生成已支持后台运行。')

const activeModelLabel = computed(() =>
  props.isProPlan ? PRO_TEXT_MODEL : DOUBAO_MODEL_OPTIONS[0].label,
)

const showPrimaryAction = computed(() =>
  props.isDirectCreation || props.contentView === 'note',
)

const primaryLabel = computed(() => {
  if (props.isDirectCreation) return props.hasDraft ? '重新直接创作' : '直接创作'
  return props.hasDraft ? '重新仿照创作' : '仿照创作'
})

const primaryLoading = computed(() => props.isAnalyzing || props.isGenerating)

const primaryDisabledReason = computed(() => {
  if (!props.isDirectCreation && !props.hasNote) return '当前任务无笔记内容'
  if (props.isGenerating) return props.isDirectCreation ? '正在创作草稿' : '正在生成创作草稿'
  if (props.isAnalyzing) return '正在分析笔记'
  if (!props.isAiConfigured || !props.isGenerateReady) return '请先配置火山方舟 ARK API Key'
  return ''
})

const primaryDisabled = computed(() => {
  if (primaryLoading.value) return false
  return (
    !props.isAiConfigured ||
    !props.isGenerateReady ||
    (!props.isDirectCreation && !props.hasNote)
  )
})

function handlePrimaryClick() {
  emit('generate')
}
</script>

<template>
  <div class="analyze-bar">
    <div class="model-row">
      <div class="model-pill">
        {{ activeModelLabel }}
      </div>
      <InfoTip :content="modelTip" placement="bottom" />
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

      <NTooltip v-if="!isAiConfigured || !isGenerateReady" trigger="hover">
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
      {{ selectedModelDescription }}{{ isDirectCreation ? '' : ' · 支持图文识图' }}
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

.model-pill {
  flex: 1;
  min-width: 0;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 6px;
  background: #fff7e8;
  border: 1px solid #ffe7ba;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
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
