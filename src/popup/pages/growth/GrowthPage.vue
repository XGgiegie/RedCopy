<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTooltip, useMessage } from 'naive-ui'
import { MODULE_GROWTH } from '../../../shared/brand'
import {
  type GrowthRecord,
  clearGrowthRecords,
  deleteGrowthRecord,
  listGrowthRecords,
} from '../../../shared/growth-records'
import { usePageStatusStore } from '../../stores/page-status'
import GrowthCollectDialog from './GrowthCollectDialog.vue'
import GrowthRecordList from './GrowthRecordList.vue'

const message = useMessage()
const router = useRouter()
const pageStatus = usePageStatusStore()

const records = ref<GrowthRecord[]>([])
const showCollect = ref(false)

const isXhsPage = computed(() => pageStatus.isXhsPage)

async function refreshRecords() {
  records.value = await listGrowthRecords()
}

async function handleDelete(id: string) {
  try {
    await deleteGrowthRecord(id)
    await refreshRecords()
    message.success('已删除互动记录')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 删除记录失败', { id, detail }, error)
    message.error(`删除失败：${detail}`)
  }
}

async function handleClearAll() {
  if (records.value.length === 0) {
    message.warning('暂无互动记录')
    return
  }

  try {
    const count = await clearGrowthRecords()
    await refreshRecords()
    message.success(`已清空 ${count} 条互动记录`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 清空互动记录失败', detail, error)
    message.error(`清空失败：${detail}`)
  }
}

onMounted(() => {
  void refreshRecords()
  void pageStatus.syncActiveTab()
})

watch(
  () => router.currentRoute.value.name,
  (name) => {
    if (name === 'growth') void refreshRecords()
  },
)
</script>

<template>
  <div class="growth-page">
    <div class="growth-page-sticky">
      <section class="growth-hero">
        <div class="growth-hero-head">
          <span class="growth-hero-icon" aria-hidden="true">🎯</span>
          <div class="growth-hero-text">
            <h2 class="growth-hero-title">{{ MODULE_GROWTH }}</h2>
          </div>
        </div>
      </section>

      <div class="growth-actions">
        <NTooltip trigger="hover" :disabled="isXhsPage">
          <template #trigger>
            <NButton
              type="primary"
              size="medium"
              class="growth-start-btn"
              :disabled="!isXhsPage"
              @click="showCollect = true"
            >
              开始自动获客
            </NButton>
          </template>
          {{ isXhsPage ? '打开配置后开始运行' : '请先打开小红书网站' }}
        </NTooltip>
      </div>

      <GrowthCollectDialog
        v-model:show="showCollect"
        @completed="refreshRecords"
      />
    </div>

    <div class="growth-page-scroll">
      <GrowthRecordList
        class="growth-list"
        :records="records"
        @delete="handleDelete"
        @clear-all="handleClearAll"
      />
    </div>
  </div>
</template>

<style scoped>
.growth-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.growth-page-sticky {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f4;
}

.growth-hero {
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #fff7ed 0%, #fff1f0 100%);
  border: 1px solid #ffd8bf;
}

.growth-hero-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.growth-hero-icon {
  flex-shrink: 0;
  font-size: 22px;
  line-height: 1;
}

.growth-hero-text {
  min-width: 0;
}

.growth-hero-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: -0.02em;
}

.growth-actions {
  display: flex;
}

.growth-start-btn {
  flex: 1;
  height: 40px;
  font-weight: 600;
}

.growth-page-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
}

.growth-list {
  flex: 1;
  min-height: 0;
}
</style>
