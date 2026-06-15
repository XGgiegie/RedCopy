<script setup lang="ts">
import { NText } from 'naive-ui'
</script>

<template>
  <NText depth="3" class="empty-hint">
    点击「执行提取」获取当前笔记内容，不会自动执行。
  </NText>
</template>

<style scoped>
.empty-hint {
  font-size: 12px;
  line-height: 1.5;
}
</style>
