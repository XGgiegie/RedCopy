<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NInput, NModal, NText } from 'naive-ui'

const props = defineProps<{
  show: boolean
  initialTopic?: string
  isGenerating: boolean
  hasDraft: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [topic: string]
}>()

const topic = ref('')

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      topic.value = props.initialTopic ?? ''
    }
  },
)

function close() {
  emit('update:show', false)
}

function confirm() {
  emit('confirm', topic.value.trim())
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="generate-dialog"
    :style="{ width: 'min(360px, calc(100vw - 24px))' }"
    :title="hasDraft ? '重新生成类似笔记' : '生成类似笔记'"
    :mask-closable="!isGenerating"
    :closable="!isGenerating"
    @update:show="emit('update:show', $event)"
  >
    <NText depth="3" class="dialog-hint">
      将基于当前 AI 分析结果生成一篇结构类似的笔记，以下内容均可选填。
    </NText>

    <NInput
      v-model:value="topic"
      type="textarea"
      placeholder="想卖什么 / 主题或卖点（选填，留空也能生成）"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :disabled="isGenerating"
      class="topic-input"
    />

    <template #footer>
      <div class="dialog-footer">
        <NButton :disabled="isGenerating" @click="close">取消</NButton>
        <NButton type="primary" :loading="isGenerating" @click="confirm">
          开始生成
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.topic-input {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
