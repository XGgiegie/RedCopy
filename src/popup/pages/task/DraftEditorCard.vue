<script setup lang="ts">
import { h } from 'vue'
import '../../styles/content-card.css'
import { NButton, NDynamicTags, NInput, NSpace, NTag, NText, useMessage } from 'naive-ui'
import type { DynamicTagsOption } from 'naive-ui'
import type {
  GeneratedImageRecord,
  GeneratedNoteDraft,
} from '../../../shared/ai-types'
import { copyTextToClipboard } from '../../../shared/export-markdown'
import {
  DRAFT_TITLE_MAX_LENGTH,
  limitDraftTitle,
} from '../../../shared/parse-generated-draft'
import DraftImagePromptList from './DraftImagePromptList.vue'
import DraftImageHistory from './DraftImageHistory.vue'

const draft = defineModel<GeneratedNoteDraft>('draft', { required: true })
const message = useMessage()

defineProps<{
  taskId: string
  isProPlan: boolean
  isGenerateReady: boolean
  imageHistory: GeneratedImageRecord[]
  isOpeningPublish: boolean
}>()

const emit = defineEmits<{
  copyText: []
  copyMarkdown: []
  edit: []
  generated: [record: GeneratedImageRecord]
  deleteImage: [recordId: string]
  openPublishPage: []
}>()

function normalizeTagForCopy(tag: string): string {
  const trimmed = tag.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

async function copyTag(tag: string) {
  const value = normalizeTagForCopy(tag)
  if (!value) return

  try {
    await copyTextToClipboard(value)
    message.success(`已复制 ${value}`)
  } catch (error) {
    console.error('[RedCopy] 复制标签失败', { tag, error })
    message.error('复制失败')
  }
}

function removeTag(index: number) {
  draft.value.tags = draft.value.tags.filter((_, itemIndex) => itemIndex !== index)
  emit('edit')
}

function getTagText(tag: string | DynamicTagsOption): string {
  return typeof tag === 'string' ? tag : tag.label
}

function renderCopyableTag(tag: string | DynamicTagsOption, index: number) {
  const label = getTagText(tag)
  const copyValue = normalizeTagForCopy(label)

  return h(
    NTag,
    {
      key: index,
      round: true,
      closable: true,
      class: 'copyable-dynamic-tag',
      title: copyValue,
      onClick: () => copyTag(label),
      onClose: (event: MouseEvent) => {
        event.stopPropagation()
        removeTag(index)
      },
    },
    { default: () => label },
  )
}

function handleTitleUpdate(value: string) {
  const limited = limitDraftTitle(value)
  if (limited !== value) {
    draft.value.title = limited
  }
  emit('edit')
}
</script>

<template>
  <div class="content-card draft-card">
    <NSpace align="center" justify="space-between" class="draft-header">
      <NText strong>类似笔记</NText>
      <NSpace :size="6">
        <NButton
          size="tiny"
          type="warning"
          :loading="isOpeningPublish"
          @click="$emit('openPublishPage')"
        >
          打开发布页
        </NButton>
        <NButton size="tiny" type="primary" @click="$emit('copyText')">
          复制
        </NButton>
        <NButton size="tiny" secondary @click="$emit('copyMarkdown')">
          Markdown
        </NButton>
      </NSpace>
    </NSpace>

    <NText depth="3" class="draft-edit-hint">内容可直接编辑，修改后会自动保存</NText>

    <div class="content-block">
      <NText depth="3" class="content-label">标题</NText>
      <NInput
        v-model:value="draft.title"
        placeholder="输入标题"
        :maxlength="DRAFT_TITLE_MAX_LENGTH"
        @update:value="handleTitleUpdate"
      />
    </div>

    <div class="content-block">
      <NText depth="3" class="content-label">正文</NText>
      <NInput
        v-model:value="draft.body"
        type="textarea"
        placeholder="输入正文"
        :autosize="{ minRows: 6, maxRows: 16 }"
        @update:value="$emit('edit')"
      />
    </div>

    <div class="content-block">
      <NText depth="3" class="content-label">标签</NText>
      <NDynamicTags
        v-model:value="draft.tags"
        class="copyable-tags"
        :render-tag="renderCopyableTag"
        @update:value="$emit('edit')"
      />
    </div>

    <div class="content-block">
      <DraftImagePromptList
        v-model:image-prompts="draft.imagePrompts"
        :task-id="taskId"
        :is-pro-plan="isProPlan"
        :is-generate-ready="isGenerateReady"
        :image-history="imageHistory"
        @edit="$emit('edit')"
        @generated="(record) => $emit('generated', record)"
        @delete-image="(id) => $emit('deleteImage', id)"
      />

      <DraftImageHistory
        :records="imageHistory"
        @delete-image="(id) => $emit('deleteImage', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.draft-header {
  margin-bottom: 8px;
}

.draft-edit-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.copyable-tags {
  max-width: 100%;
  row-gap: 6px;
}

.copyable-tags :deep(.n-space-item) {
  max-width: 100%;
}

.copyable-tags :deep(.copyable-dynamic-tag) {
  cursor: pointer;
  --n-border: 1px solid #ff2442 !important;
  --n-border-hover: 1px solid #ff2442 !important;
  --n-border-checked: 1px solid #ff2442 !important;
  --n-text-color: #ff2442 !important;
  --n-close-icon-color: #ff2442 !important;
  --n-close-icon-color-hover: #e60028 !important;
  --n-close-color-hover: rgba(255, 36, 66, 0.12) !important;
  border-color: #ff2442;
  background: #fff7f7;
  color: #ff2442;
}

.copyable-tags :deep(.copyable-dynamic-tag:hover) {
  background: #fff1f0;
  border-color: #ff2442;
}

.copyable-tags :deep(.copyable-dynamic-tag .n-tag__border) {
  border-color: #ff2442 !important;
}

.copyable-tags :deep(.copyable-dynamic-tag .n-tag__close) {
  color: #ff2442 !important;
}

.copyable-tags :deep(.copyable-dynamic-tag .n-tag__close:hover) {
  color: #e60028 !important;
}

.copyable-tags :deep(.copyable-dynamic-tag .n-tag__content) {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
