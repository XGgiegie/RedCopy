<script setup lang="ts">
import { NButton, NText } from 'naive-ui'

defineProps<{
  providerLabel: string
}>()

defineEmits<{
  openSettings: []
}>()
</script>

<template>
  <div
    class="api-key-hint"
    role="button"
    tabindex="0"
    @click="$emit('openSettings')"
    @keydown.enter="$emit('openSettings')"
  >
    <NText class="api-key-hint-title">
      🍠 「{{ providerLabel }}」未配置 API Key
    </NText>
    <NText depth="3" class="api-key-hint-text">
      请配置对应模型的 API Key，或切换其他已配置的分析模型。
    </NText>
    <NButton text type="primary" size="tiny" @click.stop="$emit('openSettings')">
      前往配置 →
    </NButton>
  </div>
</template>

<style scoped>
.api-key-hint {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7f0;
  border: 1px solid #ffe4cc;
  cursor: pointer;
}

.api-key-hint-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #d46b08;
  margin-bottom: 4px;
}

.api-key-hint-text {
  display: block;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 4px;
}
</style>
