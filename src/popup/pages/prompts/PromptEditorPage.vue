<script setup lang="ts">
import { NButton, NPopconfirm, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  type AppPrompts,
  defaultPrompts,
  loadPrompts,
  savePrompts,
} from '../../../shared/prompts'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const key = computed(() => route.params.key as keyof AppPrompts)

const metaMap: Record<keyof AppPrompts, { icon: string; title: string; source: string; warning?: string }> = {
  analysis: {
    icon: '📊',
    title: '笔记分析',
    source: '创作页 → 分析笔记（豆包图文分析 / Pro 分析）',
    warning: '输出格式为严格 JSON，请保留末尾的 JSON Schema 示例，否则解析会失败。',
  },
  generate: {
    icon: '🧩',
    title: '笔记生成通用模板',
    source: '创作页 → 生成草稿（所有主题共用基础模板）',
    warning: '输出格式为严格 JSON，请保留末尾的 JSON Schema 示例，否则解析会失败。',
  },
  purposeTechnicalShare: {
    icon: '🛠',
    title: '硬核干货 / 技术分享类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeMythBusting: {
    icon: '🧠',
    title: '避坑解密 / 信息差类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeIndieDevDiary: {
    icon: '📈',
    title: '独立开发 / 搞钱日记类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposePainPointSolution: {
    icon: '⚡',
    title: '场景痛点 / 解决方案类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeResourceRoundup: {
    icon: '📦',
    title: '资源合集 / 打包白嫖类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeInteractiveCocreation: {
    icon: '🤝',
    title: '听劝养成 / 互动共创类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeIndustryInsight: {
    icon: '🧭',
    title: '行业观察 / 职场感悟类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  purposeCommercialPromotion: {
    icon: '💰',
    title: '直接带货 / 商业推广类',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  growthReply: {
    icon: '💬',
    title: '评论回复',
    source: '自动垂直养号 → 回复评论',
  },
  growthNoteComment: {
    icon: '🔥',
    title: '笔记抢首评',
    source: '自动垂直养号 → 抢首评',
  },
}

const meta = computed(() => metaMap[key.value] ?? { icon: '📝', title: '提示词', source: '' })

const loading = ref(true)
const saving = ref(false)
const content = ref('')

onMounted(async () => {
  try {
    const prompts = await loadPrompts()
    content.value = prompts[key.value] ?? ''
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  saving.value = true
  try {
    await savePrompts({ [key.value]: content.value })
    message.success('已保存')
  } catch (err) {
    message.error(`保存失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    saving.value = false
  }
}

async function handleReset() {
  content.value = defaultPrompts[key.value]
  await savePrompts({ [key.value]: content.value })
  message.success('已恢复默认提示词')
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="editor-page">
    <div v-if="loading" class="editor-loading">
      <NSpin size="medium" />
    </div>

    <template v-else>
      <!-- 顶部信息栏 -->
      <div class="editor-info">
        <span class="editor-icon" aria-hidden="true">{{ meta.icon }}</span>
        <div class="editor-meta">
          <span class="editor-title">{{ meta.title }}</span>
          <span class="editor-source">{{ meta.source }}</span>
        </div>
      </div>

      <p v-if="meta.warning" class="editor-warning">⚠️ {{ meta.warning }}</p>

      <!-- 全屏编辑区 -->
      <textarea
        v-model="content"
        class="editor-textarea"
        spellcheck="false"
        placeholder="请输入提示词内容…"
      />

      <!-- 底部操作栏 -->
      <div class="editor-actions">
        <NPopconfirm @positive-click="handleReset">
          <template #trigger>
            <NButton size="small">恢复默认</NButton>
          </template>
          确定将此条提示词恢复为内置默认值？
        </NPopconfirm>

        <div class="editor-actions-right">
          <NButton size="small" @click="goBack">返回</NButton>
          <NButton
            type="primary"
            size="small"
            :loading="saving"
            @click="handleSave"
          >
            保存
          </NButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.editor-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
}

.editor-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #eef0f4;
  flex-shrink: 0;
}

.editor-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.editor-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.editor-title {
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
}

.editor-source {
  font-size: 11px;
  color: #86909c;
}

.editor-warning {
  margin: 0;
  padding: 6px 12px;
  font-size: 11px;
  color: #d97706;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}

.editor-textarea {
  flex: 1;
  min-height: 0;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'FiraCode', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: #1d2129;
  background: #fff;
}

.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #eef0f4;
  flex-shrink: 0;
  background: #fff;
}

.editor-actions-right {
  display: flex;
  gap: 6px;
}
</style>
