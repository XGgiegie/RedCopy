<script setup lang="ts">
import { NRadioButton, NRadioGroup } from 'naive-ui'
import type { ContentView, ContentViewOption } from '../../types/content-view'

defineProps<{
  modelValue: ContentView
  options: ContentViewOption[]
}>()

defineEmits<{
  'update:modelValue': [value: ContentView]
}>()
</script>

<template>
  <NRadioGroup
    :value="modelValue"
    size="small"
    class="content-view-switch"
    @update:value="$emit('update:modelValue', $event)"
  >
    <NRadioButton
      v-for="option in options"
      :key="option.value"
      :value="option.value"
    >
      {{ option.label }}
    </NRadioButton>
  </NRadioGroup>
</template>

<style scoped>
.content-view-switch {
  display: flex;
  width: 100%;
  margin-top: 2px;
}

.content-view-switch :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}
</style>
