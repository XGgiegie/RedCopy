<script setup lang="ts">
import {
  NButton,
  NInput,
  NRadio,
  NRadioGroup,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { onMounted, ref } from 'vue'
import {
  DEEPSEEK_MODEL_OPTIONS,
  type AiSettings,
  type DeepSeekModel,
  isAiSettingsReady,
  loadAiSettings,
  saveAiSettings,
} from '../shared/ai-settings'

const emit = defineEmits<{
  saved: []
  close: []
}>()

const message = useMessage()
const apiKey = ref('')
const model = ref<DeepSeekModel>('deepseek-v4-flash')
const isSaving = ref(false)
const showApiKey = ref(false)

async function restoreSettings() {
  const settings = await loadAiSettings()
  apiKey.value = settings.apiKey
  model.value = settings.model
}

async function handleSave() {
  if (!apiKey.value.trim()) {
    message.warning('请填写 DeepSeek API Key')
    return
  }

  isSaving.value = true
  try {
    const settings: AiSettings = {
      provider: 'deepseek',
      apiKey: apiKey.value.trim(),
      model: model.value,
    }
    await saveAiSettings(settings)
    message.success('API Key 已保存')
    console.info('[RedCopy] AI 设置已保存', {
      model: settings.model,
      configured: isAiSettingsReady(settings),
    })
    emit('saved')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 保存 AI 设置失败', detail, error)
    message.error(`保存失败：${detail}`)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void restoreSettings()
})
</script>

<template>
  <NSpace vertical :size="14" class="settings-panel">
    <div class="field-block">
      <NText depth="3" class="field-hint">DeepSeek API Key，仅保存在本机扩展中。</NText>
      <NInput
        v-model:value="apiKey"
        :type="showApiKey ? 'text' : 'password'"
        placeholder="sk-..."
        clearable
      />
      <NSpace :size="8">
        <NButton text type="primary" size="small" @click="showApiKey = !showApiKey">
          {{ showApiKey ? '隐藏' : '显示' }}
        </NButton>
        <NButton
          text
          tag="a"
          size="small"
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noreferrer"
        >
          获取 Key
        </NButton>
      </NSpace>
    </div>

    <div class="field-block">
      <NText strong class="field-label">分析模型</NText>
      <NRadioGroup v-model:value="model" size="small">
        <NSpace vertical :size="8">
          <NRadio
            v-for="item in DEEPSEEK_MODEL_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </NRadio>
        </NSpace>
      </NRadioGroup>
    </div>

    <NSpace :size="8">
      <NButton type="primary" :loading="isSaving" @click="handleSave">
        保存
      </NButton>
      <NButton @click="emit('close')">取消</NButton>
    </NSpace>
  </NSpace>
</template>

<style scoped>
.field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
}

.field-hint {
  font-size: 12px;
  line-height: 1.5;
}
</style>
