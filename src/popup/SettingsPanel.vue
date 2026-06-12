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
import {
  API_KEY_SETUP_HINT,
  CONTACT_GROUP,
  CONTACT_QQ,
  DEEPSEEK_API_KEY_URL,
} from '../shared/brand'

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
    <div class="api-key-notice">
      <NText class="api-key-notice-title">🍠 首次使用请先申请 API Key</NText>
      <NText depth="3" class="api-key-notice-text">{{ API_KEY_SETUP_HINT }}</NText>
      <NButton
        tag="a"
        type="primary"
        size="small"
        :href="DEEPSEEK_API_KEY_URL"
        target="_blank"
        rel="noreferrer"
      >
        前往 DeepSeek 申请 API Key
      </NButton>
    </div>

    <div class="field-block">
      <NText strong class="field-label">DeepSeek API Key</NText>
      <NText depth="3" class="field-hint">填写后仅保存在本机扩展中，不会上传。</NText>
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
          :href="DEEPSEEK_API_KEY_URL"
          target="_blank"
          rel="noreferrer"
        >
          打开申请页
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

    <div class="settings-footer">
      <NText depth="3" class="settings-footer-text">
        问题反馈 QQ：{{ CONTACT_QQ }} · 交流群：{{ CONTACT_GROUP }}
      </NText>
    </div>
  </NSpace>
</template>

<style scoped>
.api-key-notice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: #fff7f0;
  border: 1px solid #ffe4cc;
}

.api-key-notice-title {
  font-size: 13px;
  font-weight: 600;
  color: #d46b08;
}

.api-key-notice-text {
  font-size: 12px;
  line-height: 1.6;
}

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

.settings-footer {
  padding-top: 4px;
  border-top: 1px solid #eef0f4;
}

.settings-footer-text {
  display: block;
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}
</style>
