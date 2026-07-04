<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsPanel from './SettingsPanel.vue'

const router = useRouter()

function goBack() {
  void router.push('/settings')
}
</script>

<template>
  <div class="apikey-view">
    <SettingsPanel page-mode @close="goBack" />
  </div>
</template>

<style scoped>
.apikey-view {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}
</style>
