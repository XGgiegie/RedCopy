<script setup lang="ts">
import {
  NButton,
  NInput,
  NPopconfirm,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import {
  DOUBAO_CAPABILITY_SUMMARY,
  DOUBAO_MODEL_OPTIONS,
  type AiSettings,
  clearApiKey,
  isAiConfigured,
  loadAiSettings,
  saveAiSettings,
} from '../../../shared/ai-settings'
import { DOUBAO_API_KEY_URL } from '../../../shared/brand'

withDefaults(
  defineProps<{
    /** 侧栏独立页模式：显示返回按钮 */
    pageMode?: boolean
  }>(),
  { pageMode: false },
)

const emit = defineEmits<{
  saved: []
  close: []
  cleared: []
}>()

const message = useMessage()
const apiKey = ref('')
const isSaving = ref(false)
const isClearing = ref(false)
const showKey = ref(false)

const hasKey = computed(() => apiKey.value.trim().length > 0)

async function restoreSettings() {
  const settings = await loadAiSettings()
  apiKey.value = settings.apiKey
}

async function handleSave() {
  const current = await loadAiSettings()

  const settings: AiSettings = {
    apiKey: apiKey.value.trim(),
    model: current.model,
  }

  isSaving.value = true
  try {
    await saveAiSettings(settings)
    message.success('API Key 已保存')
    console.info('[RedCopy] ARK API Key 已保存', {
      configured: isAiConfigured(settings),
    })
    emit('saved')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 保存 API Key 失败', detail, error)
    message.error(`保存失败：${detail}`)
  } finally {
    isSaving.value = false
  }
}

async function handleClear() {
  isClearing.value = true
  try {
    await clearApiKey()
    apiKey.value = ''
    showKey.value = false
    message.success('ARK API Key 已清空')
    emit('cleared')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 清空 API Key 失败', detail, error)
    message.error(`清空失败：${detail}`)
  } finally {
    isClearing.value = false
  }
}

onMounted(() => {
  void restoreSettings()
})
</script>

<template>
  <NSpace vertical :size="12" class="settings-panel">
    <section class="capability-section">
      <NText strong class="section-title">火山方舟 · 豆包大模型</NText>
      <NText depth="3" class="section-hint">
        分析与生成功能均使用同一 ARK API Key；模型在任务详情页切换。
      </NText>

      <div class="provider-card">
        <NText strong class="provider-name">{{ DOUBAO_CAPABILITY_SUMMARY.title }}</NText>
        <div class="capability-tags">
          <NTag
            v-for="item in DOUBAO_CAPABILITY_SUMMARY.supports"
            :key="item"
            size="small"
            round
            :bordered="false"
            type="success"
          >
            {{ item }}
          </NTag>
        </div>
        <NText depth="3" class="model-list">
          {{ DOUBAO_CAPABILITY_SUMMARY.modelHint }}：
          {{ DOUBAO_MODEL_OPTIONS.map((m) => m.label).join('、') }}
        </NText>
        <NText depth="3" class="provider-note">
          {{ DOUBAO_CAPABILITY_SUMMARY.note }}
        </NText>
      </div>
    </section>

    <NSpace vertical :size="8">
      <NText strong class="section-title">ARK API Key</NText>
      <NInput
        v-model:value="apiKey"
        :type="showKey ? 'text' : 'password'"
        placeholder="火山方舟 ARK API Key"
        clearable
      />
      <NSpace :size="8" align="center" wrap>
        <NButton text type="primary" size="small" @click="showKey = !showKey">
          {{ showKey ? '隐藏' : '显示' }}
        </NButton>
        <NButton
          text
          tag="a"
          size="small"
          :href="DOUBAO_API_KEY_URL"
          target="_blank"
          rel="noreferrer"
        >
          申请 Key
        </NButton>
        <NPopconfirm
          v-if="hasKey"
          positive-text="清空"
          negative-text="取消"
          @positive-click="handleClear"
        >
          <template #trigger>
            <NButton text type="error" size="small" :disabled="isClearing">
              清空
            </NButton>
          </template>
          确定清空 ARK API Key？
        </NPopconfirm>
      </NSpace>
    </NSpace>

    <NSpace :size="8" align="center" wrap class="settings-actions">
      <NButton type="primary" :loading="isSaving" :disabled="isClearing" @click="handleSave">
        保存
      </NButton>
      <NButton v-if="pageMode" :disabled="isSaving || isClearing" @click="emit('close')">
        返回
      </NButton>
    </NSpace>
  </NSpace>
</template>

<style scoped>
.section-title {
  display: block;
  font-size: 13px;
}

.section-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

.capability-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-card {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fafbfc;
  border: 1px solid #eef0f4;
}

.provider-name {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
}

.capability-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.model-list {
  display: block;
  font-size: 11px;
  line-height: 1.5;
}

.provider-note {
  display: block;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 4px;
  color: #86909c;
}

.settings-actions {
  width: 100%;
}
</style>
