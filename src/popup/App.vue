<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NTooltip } from 'naive-ui'
import { APP_NAME } from '../shared/brand'
import AppFooter from './components/AppFooter.vue'
import ModuleTabs from './components/ModuleTabs.vue'
import { usePageStatusStore } from './stores/page-status'
import { useXhsLoginStore } from './stores/xhs-login'

const route = useRoute()
const router = useRouter()
const pageStatus = usePageStatusStore()
const xhsLogin = useXhsLoginStore()

const isModuleHome = computed(
  () => route.name === 'analysis' || route.name === 'growth',
)
const showModuleTabs = computed(() => isModuleHome.value)
const isSettings = computed(() => route.name === 'settings')

const headerTitle = computed(() => {
  if (isSettings.value) return 'API Key 设置'
  if (route.name === 'task') return '笔记任务'
  return ''
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/analysis')
}

function openSettings() {
  void router.push('/settings')
}

onMounted(() => {
  pageStatus.start()
  xhsLogin.start()
})

onUnmounted(() => {
  pageStatus.stop()
  xhsLogin.stop()
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-left">
        <button
          v-if="!isModuleHome"
          type="button"
          class="back-btn"
          aria-label="返回"
          @click="goBack"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5 9 13.5l-5-5.5 5-5.5 1 1z" />
          </svg>
        </button>

        <template v-if="isModuleHome">
          <span class="brand-mark" aria-hidden="true">🍠</span>
          <span class="brand-name">{{ APP_NAME }}</span>
          <div class="status-tags">
            <NTooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span
                  class="status-tag"
                  :class="`status-tag--${pageStatus.tagLevel}`"
                >
                  <span class="status-tag-dot" aria-hidden="true" />
                  {{ pageStatus.tagLabel }}
                </span>
              </template>
              {{ pageStatus.tagTooltip }}
            </NTooltip>
            <NTooltip trigger="hover" placement="bottom">
              <template #trigger>
                <span
                  class="status-tag"
                  :class="`status-tag--${xhsLogin.tagLevel}`"
                >
                  <span class="status-tag-dot" aria-hidden="true" />
                  {{ xhsLogin.tagLabel }}
                </span>
              </template>
              {{ xhsLogin.tagTooltip }}
            </NTooltip>
          </div>
        </template>
        <span v-else class="header-title">{{ headerTitle }}</span>
      </div>

      <button
        v-if="!isSettings"
        type="button"
        class="gear-btn"
        title="配置 API Key"
        aria-label="配置 API Key"
        @click="openSettings"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96a.488.488 0 0 0-.59.22l-1.92 3.32c-.12.22-.09.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.09-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>
    </header>

    <ModuleTabs v-if="showModuleTabs" />

    <main class="app-body">
      <div class="app-body-inner">
        <router-view />
      </div>
    </main>

    <AppFooter class="app-footer" />
  </div>
</template>

<style scoped>
.app-shell {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.brand-mark {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.status-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-wrap: wrap;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: default;
  border: 1px solid transparent;
}

.status-tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-tag--ready {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.status-tag--ready .status-tag-dot {
  background: #22c55e;
}

.status-tag--warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}

.status-tag--warn .status-tag-dot {
  background: #f59e0b;
}

.status-tag--idle {
  background: #f2f3f5;
  border-color: #e5e6eb;
  color: #86909c;
}

.status-tag--idle .status-tag-dot {
  background: #c9cdd4;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.back-btn,
.gear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.back-btn:hover,
.gear-btn:hover {
  color: #ff2442;
  background: #f2f3f5;
}

.back-btn svg {
  width: 16px;
  height: 16px;
}

.gear-btn svg {
  width: 17px;
  height: 17px;
}

.app-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-body-inner {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-footer {
  flex-shrink: 0;
}
</style>
