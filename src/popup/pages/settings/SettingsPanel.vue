<script setup lang="ts">
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NInput,
  NPopconfirm,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import {
  DEEPSEEK_MODEL_OPTIONS,
  DOUBAO_MODEL_OPTIONS,
  PROVIDER_CAPABILITY_SUMMARY,
  type AiSettings,
  type ApiKeyProvider,
  clearAllApiKeys,
  clearProviderApiKey,
  isGenerateConfigured,
  loadAiSettings,
  saveAiSettings,
} from '../../../shared/ai-settings'
import { DEEPSEEK_API_KEY_URL, DOUBAO_API_KEY_URL } from '../../../shared/brand'

const props = withDefaults(
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
const deepseekApiKey = ref('')
const doubaoApiKey = ref('')
const isSaving = ref(false)
const isClearing = ref(false)
const showDeepseekKey = ref(false)
const showDoubaoKey = ref(false)

const hasDeepseekKey = computed(() => deepseekApiKey.value.trim().length > 0)
const hasDoubaoKey = computed(() => doubaoApiKey.value.trim().length > 0)
const hasAnyKey = computed(() => hasDeepseekKey.value || hasDoubaoKey.value)

async function restoreSettings() {
  const settings = await loadAiSettings()
  deepseekApiKey.value = settings.deepseek.apiKey
  doubaoApiKey.value = settings.doubao.apiKey
}

async function handleSave() {
  const current = await loadAiSettings()

  const settings: AiSettings = {
    analysisProvider: current.analysisProvider,
    deepseek: {
      apiKey: deepseekApiKey.value.trim(),
      model: current.deepseek.model,
    },
    doubao: {
      apiKey: doubaoApiKey.value.trim(),
      model: current.doubao.model,
    },
  }

  isSaving.value = true
  try {
    await saveAiSettings(settings)
    message.success('API Key 已保存')
    console.info('[RedCopy] API Key 已保存', {
      deepseek: Boolean(settings.deepseek.apiKey),
      doubao: Boolean(settings.doubao.apiKey),
      generateReady: isGenerateConfigured(settings),
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

async function handleClearProvider(provider: ApiKeyProvider) {
  isClearing.value = true
  try {
    await clearProviderApiKey(provider)
    if (provider === 'deepseek') {
      deepseekApiKey.value = ''
      showDeepseekKey.value = false
    } else {
      doubaoApiKey.value = ''
      showDoubaoKey.value = false
    }
    message.success(provider === 'deepseek' ? 'DeepSeek Key 已清空' : '豆包 Key 已清空')
    emit('cleared')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 清空 API Key 失败', { provider, detail }, error)
    message.error(`清空失败：${detail}`)
  } finally {
    isClearing.value = false
  }
}

async function handleClearAll() {
  isClearing.value = true
  try {
    await clearAllApiKeys()
    deepseekApiKey.value = ''
    doubaoApiKey.value = ''
    showDeepseekKey.value = false
    showDoubaoKey.value = false
    message.success('已全部清空 API Key')
    emit('cleared')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 清空全部 API Key 失败', detail, error)
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
      <NText strong class="section-title">支持的服务与模型</NText>
      <NText depth="3" class="section-hint">
        分析时在笔记详情页切换服务商；DeepSeek 与豆包能力不同，请按需配置 Key。
      </NText>

      <div class="provider-card">
        <NText strong class="provider-name">{{ PROVIDER_CAPABILITY_SUMMARY.deepseek.title }}</NText>
        <div class="capability-tags">
          <NTag
            v-for="item in PROVIDER_CAPABILITY_SUMMARY.deepseek.supports"
            :key="item"
            size="small"
            round
            :bordered="false"
            type="success"
          >
            {{ item }}
          </NTag>
          <NTag
            v-for="item in PROVIDER_CAPABILITY_SUMMARY.deepseek.notSupports"
            :key="item"
            size="small"
            round
            :bordered="false"
          >
            不支持 {{ item }}
          </NTag>
        </div>
        <NText depth="3" class="model-list">
          {{ PROVIDER_CAPABILITY_SUMMARY.deepseek.modelHint }}：
          {{ DEEPSEEK_MODEL_OPTIONS.map((m) => m.label).join('、') }}
        </NText>
      </div>

      <div class="provider-card">
        <NText strong class="provider-name">{{ PROVIDER_CAPABILITY_SUMMARY.doubao.title }}</NText>
        <div class="capability-tags">
          <NTag
            v-for="item in PROVIDER_CAPABILITY_SUMMARY.doubao.supports"
            :key="item"
            size="small"
            round
            :bordered="false"
            type="success"
          >
            {{ item }}
          </NTag>
          <NTag
            v-for="item in PROVIDER_CAPABILITY_SUMMARY.doubao.notSupports"
            :key="item"
            size="small"
            round
            :bordered="false"
          >
            不支持 {{ item }}
          </NTag>
        </div>
        <NText depth="3" class="model-list">
          {{ PROVIDER_CAPABILITY_SUMMARY.doubao.modelHint }}：
          {{ DOUBAO_MODEL_OPTIONS.map((m) => m.label).join('、') }}
        </NText>
        <NText depth="3" class="provider-note">
          {{ PROVIDER_CAPABILITY_SUMMARY.doubao.note }}
        </NText>
      </div>
    </section>

    <NCollapse :default-expanded-names="['deepseek', 'doubao']" arrow-placement="right">
      <NCollapseItem title="DeepSeek API Key" name="deepseek">
        <NSpace vertical :size="8">
          <NInput
            v-model:value="deepseekApiKey"
            :type="showDeepseekKey ? 'text' : 'password'"
            placeholder="sk-..."
            clearable
          />
          <NSpace :size="8" align="center" wrap>
            <NButton text type="primary" size="small" @click="showDeepseekKey = !showDeepseekKey">
              {{ showDeepseekKey ? '隐藏' : '显示' }}
            </NButton>
            <NButton
              text
              tag="a"
              size="small"
              :href="DEEPSEEK_API_KEY_URL"
              target="_blank"
              rel="noreferrer"
            >
              申请 Key
            </NButton>
            <NPopconfirm
              v-if="hasDeepseekKey"
              positive-text="清空"
              negative-text="取消"
              @positive-click="handleClearProvider('deepseek')"
            >
              <template #trigger>
                <NButton text type="error" size="small" :disabled="isClearing">
                  清空
                </NButton>
              </template>
              确定清空 DeepSeek API Key？
            </NPopconfirm>
          </NSpace>
        </NSpace>
      </NCollapseItem>

      <NCollapseItem title="豆包 API Key" name="doubao">
        <NSpace vertical :size="8">
          <NInput
            v-model:value="doubaoApiKey"
            :type="showDoubaoKey ? 'text' : 'password'"
            placeholder="ARK API Key"
            clearable
          />
          <NSpace :size="8" align="center" wrap>
            <NButton text type="primary" size="small" @click="showDoubaoKey = !showDoubaoKey">
              {{ showDoubaoKey ? '隐藏' : '显示' }}
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
              v-if="hasDoubaoKey"
              positive-text="清空"
              negative-text="取消"
              @positive-click="handleClearProvider('doubao')"
            >
              <template #trigger>
                <NButton text type="error" size="small" :disabled="isClearing">
                  清空
                </NButton>
              </template>
              确定清空豆包 API Key？
            </NPopconfirm>
          </NSpace>
        </NSpace>
      </NCollapseItem>
    </NCollapse>

    <NSpace :size="8" align="center" wrap class="settings-actions">
      <NButton type="primary" :loading="isSaving" :disabled="isClearing" @click="handleSave">
        保存
      </NButton>
      <NPopconfirm
        v-if="hasAnyKey"
        positive-text="全部清空"
        negative-text="取消"
        @positive-click="handleClearAll"
      >
        <template #trigger>
          <NButton :disabled="isSaving || isClearing" :loading="isClearing">
            清空全部 Key
          </NButton>
        </template>
        确定清空全部 API Key？清空后将无法使用 AI 分析与生成功能。
      </NPopconfirm>
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
