<script setup lang="ts">
import {
  NButton,
  NInput,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import {
  DOUBAO_CAPABILITY_SUMMARY,
  DOUBAO_MODEL_OPTIONS,
  type AiPlan,
  type AiSettings,
  clearApiKey,
  isAiConfigured,
  loadAiSettings,
  saveAiSettings,
} from '../../../shared/ai-settings'
import { DOUBAO_API_KEY_URL } from '../../../shared/brand'
import { GROWTH_AI_ACTION_LIMIT } from '../../../shared/growth-acquire'
import { PRO_CAPABILITY_SUMMARY, validateProApiKey } from '../../../shared/pro-ai-api'

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
const plan = ref<AiPlan>('free')
const apiKey = ref('')
const proApiKey = ref('')
const isSaving = ref(false)
const isClearing = ref(false)
const showKey = ref(false)
const showProKey = ref(false)

const isFreePlan = computed(() => plan.value === 'free')
const isProPlan = computed(() => plan.value === 'pro')
const hasFreeKey = computed(() => apiKey.value.trim().length > 0)
const hasProKey = computed(() => proApiKey.value.trim().length > 0)
const activeKeyLabel = computed(() => (isProPlan.value ? 'Pro 版 API Key' : 'ARK API Key'))

async function restoreSettings() {
  const settings = await loadAiSettings()
  plan.value = settings.plan
  apiKey.value = settings.apiKey
  proApiKey.value = settings.proApiKey
}

async function handleSave() {
  const current = await loadAiSettings()

  isSaving.value = true
  try {
    if (isProPlan.value) {
      const key = proApiKey.value.trim()
      if (!key) {
        message.warning('请输入 Pro 版 API Key')
        return
      }

      await validateProApiKey(key)

      const settings: AiSettings = {
        plan: 'pro',
        apiKey: '',
        proApiKey: key,
        model: current.model,
      }
      await saveAiSettings(settings)
      apiKey.value = ''
      message.success('Pro 版 API Key 已保存并验证通过')
      console.info('[RedCopy] Pro 版 API Key 已保存', {
        configured: isAiConfigured(settings),
      })
    } else {
      const settings: AiSettings = {
        plan: 'free',
        apiKey: apiKey.value.trim(),
        proApiKey: '',
        model: current.model,
      }
      await saveAiSettings(settings)
      proApiKey.value = ''
      message.success('API Key 已保存')
      console.info('[RedCopy] 免费版 ARK API Key 已保存', {
        configured: isAiConfigured(settings),
      })
    }
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
    if (isProPlan.value) {
      proApiKey.value = ''
      showProKey.value = false
      message.success('Pro 版 API Key 已清空')
    } else {
      apiKey.value = ''
      showKey.value = false
      message.success('ARK API Key 已清空')
    }
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
    <section class="usage-notice" aria-label="使用说明">
      <NText strong class="usage-notice-title">使用说明</NText>
      <ul class="usage-notice-list">
        <li>
          <strong>免费版</strong>与 <strong>Pro 版</strong>只能二选一，保存时会自动切换并清空另一方案的 Key。
        </li>
        <li v-if="isFreePlan">
          火山方舟豆包提供<strong>免费额度</strong>，本扩展不代扣费用；请自行
          <a
            class="usage-notice-link"
            :href="DOUBAO_API_KEY_URL"
            target="_blank"
            rel="noreferrer"
          >申请 ARK API Key</a>
          并填入下方，AI 调用费用由您的火山账号承担。
        </li>
        <li v-if="isFreePlan">
          涨粉自动获客中的 AI 自动评论与 AI 自动回复，每日合计不得超过
          {{ GROWTH_AI_ACTION_LIMIT }} 次，用完后请改用固定文案或次日再试。
        </li>
        <li v-if="isProPlan">
          Pro 版使用高级大模型；配置并验证 Pro API Key 后，涨粉自动获客中的
          <strong>AI 评论与 AI 回复不限次数</strong>。
        </li>
        <li v-if="isProPlan">
          保存 Pro Key 时会自动调用轻量模型验证 Key 是否有效，通过后才写入本地。
        </li>
      </ul>
    </section>

    <section class="plan-section">
      <NText strong class="section-title">选择方案</NText>
      <NRadioGroup v-model:value="plan" size="small" class="plan-radio-group">
        <NRadioButton value="free">免费版</NRadioButton>
        <NRadioButton value="pro">Pro 版</NRadioButton>
      </NRadioGroup>
    </section>

    <section v-if="isFreePlan" class="capability-section">
      <NText strong class="section-title">{{ DOUBAO_CAPABILITY_SUMMARY.title }}</NText>
      <NText depth="3" class="section-hint">
        分析与生成功能均使用同一 ARK API Key；模型在任务详情页切换。
      </NText>

      <div class="provider-card">
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

    <section v-else class="capability-section">
      <NText strong class="section-title">{{ PRO_CAPABILITY_SUMMARY.title }}</NText>
      <NText depth="3" class="section-hint">
        {{ PRO_CAPABILITY_SUMMARY.description }}
      </NText>

      <div class="provider-card provider-card--pro">
        <div class="capability-tags">
          <NTag
            v-for="item in PRO_CAPABILITY_SUMMARY.supports"
            :key="item"
            size="small"
            round
            :bordered="false"
            type="warning"
          >
            {{ item }}
          </NTag>
        </div>
        <NText depth="3" class="model-list">
          文本模型：{{ PRO_CAPABILITY_SUMMARY.textModel }}
        </NText>
        <NText depth="3" class="model-list">
          图片模型：{{ PRO_CAPABILITY_SUMMARY.imageModels.join('、') }}
        </NText>
        <NText depth="3" class="provider-note">
          {{ PRO_CAPABILITY_SUMMARY.growthBenefit }}
        </NText>
        <NText depth="3" class="provider-note">
          {{ PRO_CAPABILITY_SUMMARY.note }}
        </NText>
      </div>
    </section>

    <NSpace vertical :size="8">
      <NText strong class="section-title">{{ activeKeyLabel }}</NText>
      <NInput
        v-if="isFreePlan"
        v-model:value="apiKey"
        :type="showKey ? 'text' : 'password'"
        placeholder="火山方舟 ARK API Key"
        clearable
      />
      <NInput
        v-else
        v-model:value="proApiKey"
        :type="showProKey ? 'text' : 'password'"
        placeholder="Pro 版 API Key"
        clearable
      />
      <NSpace :size="8" align="center" wrap>
        <NButton
          text
          type="primary"
          size="small"
          @click="isFreePlan ? (showKey = !showKey) : (showProKey = !showProKey)"
        >
          {{ (isFreePlan ? showKey : showProKey) ? '隐藏' : '显示' }}
        </NButton>
        <NButton
          v-if="isFreePlan"
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
          v-if="isFreePlan ? hasFreeKey : hasProKey"
          positive-text="清空"
          negative-text="取消"
          @positive-click="handleClear"
        >
          <template #trigger>
            <NButton text type="error" size="small" :disabled="isClearing">
              清空
            </NButton>
          </template>
          确定清空{{ isProPlan ? ' Pro 版' : ' ARK' }} API Key？
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
.settings-panel {
  width: 100%;
}

.usage-notice {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7e8;
  border: 1px solid #ffe7ba;
}

.usage-notice-title {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: #1d2129;
}

.usage-notice-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: #4e5969;
}

.usage-notice-list li + li {
  margin-top: 6px;
}

.usage-notice-link {
  color: #2080f0;
  text-decoration: none;
}

.usage-notice-link:hover {
  text-decoration: underline;
}

.plan-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-radio-group {
  width: 100%;
}

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

.provider-card--pro {
  background: #fffaf0;
  border-color: #ffe7ba;
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
