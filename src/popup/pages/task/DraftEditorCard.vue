<script setup lang="ts">
import '../../styles/content-card.css'
import { NButton, NDynamicTags, NInput, NSpace, NText } from 'naive-ui'
import type { GeneratedNoteDraft } from '../../../shared/ai-types'

const draft = defineModel<GeneratedNoteDraft>('draft', { required: true })

defineEmits<{
  copyText: []
  copyMarkdown: []
  edit: []
}>()
</script>

<template>
  <div class="content-card draft-card">
    <NSpace align="center" justify="space-between" class="draft-header">
      <NText strong>类似笔记</NText>
      <NSpace :size="6">
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
        @update:value="$emit('edit')"
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
        @update:value="$emit('edit')"
      />
    </div>

    <div class="content-block">
      <NText depth="3" class="content-label">配图建议</NText>
      <NInput
        v-model:value="draft.imageTips"
        type="textarea"
        placeholder="配图张数、封面与风格建议（选填）"
        :autosize="{ minRows: 2, maxRows: 8 }"
        @update:value="$emit('edit')"
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
</style>
