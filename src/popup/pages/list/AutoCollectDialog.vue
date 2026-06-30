<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NText,
  useMessage,
} from 'naive-ui'
import type { AutoCollectConfig, AutoCollectProgress } from '../../../shared/auto-collect'
import {
  getAutoCollectTaskStatus,
  startAutoCollectTask,
  stopAutoCollectTask,
} from '../../services/background-tasks'
import InfoTip from '../../components/InfoTip.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  completed: []
}>()

const message = useMessage()

const keyword = ref('')
const minLikedCount = ref(0)
const minCollectedCount = ref(0)
const minCommentCount = ref(0)
const maxExtract = ref(10)
const scrollRounds = ref(3)

const isRunning = ref(false)
const cancelled = ref(false)
const progress = ref<AutoCollectProgress | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

function resetForm() {
  keyword.value = ''
  minLikedCount.value = 0
  minCollectedCount.value = 0
  minCommentCount.value = 0
  maxExtract.value = 10
  scrollRounds.value = 3
  progress.value = null
  cancelled.value = false
}

function stopPolling() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    void syncBackgroundStatus()
  }, 1000)
}

async function syncBackgroundStatus() {
  try {
    const response = await getAutoCollectTaskStatus()
    const status = response.status
    if (!status) return

    const wasRunning = isRunning.value
    isRunning.value = status.running
    cancelled.value = status.cancelled
    progress.value = status.progress

    if (status.running) {
      startPolling()
      return
    }

    stopPolling()

    if (wasRunning) {
      if (status.error) {
        message.error(`自动采集失败：${status.error}`)
      } else if (status.result) {
        const savedCount = status.result.extracted
        if (status.cancelled || status.progress?.phase === 'cancelled') {
          message.info(
            savedCount > 0
              ? `自动采集已取消，已入库 ${savedCount} 篇`
              : '自动采集已取消',
          )
        } else {
          message.success(`自动采集完成：入库 ${savedCount} 篇`)
        }
        if (savedCount > 0) emit('completed')
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 同步后台自动采集状态失败', detail, error)
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible && !isRunning.value) {
      progress.value = null
      cancelled.value = false
    }
  },
)

function close() {
  if (isRunning.value) return
  emit('update:show', false)
}

function cancelRun() {
  void stopAutoCollectTask()
    .then((response) => {
      cancelled.value = response.status?.cancelled ?? true
      progress.value = response.status?.progress ?? {
        phase: 'cancelled',
        message: '正在取消…',
        scanned: progress.value?.scanned ?? 0,
        extracted: progress.value?.extracted ?? 0,
        skipped: progress.value?.skipped ?? 0,
      }
    })
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`停止失败：${detail}`)
    })
}

async function startRun() {
  if (!keyword.value.trim()) {
    message.warning('请填写搜索关键词')
    return
  }

  const config: AutoCollectConfig = {
    keyword: keyword.value.trim(),
    minLikedCount: minLikedCount.value || 0,
    minCollectedCount: minCollectedCount.value || 0,
    minCommentCount: minCommentCount.value || 0,
    maxExtract: Math.min(Math.max(maxExtract.value || 10, 1), 30),
    scrollRounds: Math.min(Math.max(scrollRounds.value || 3, 1), 8),
  }

  isRunning.value = true
  cancelled.value = false
  progress.value = {
    phase: 'navigating',
    message: '准备开始…',
    scanned: 0,
    extracted: 0,
    skipped: 0,
  }

  try {
    const response = await startAutoCollectTask(config)
    isRunning.value = response.status?.running ?? true
    cancelled.value = response.status?.cancelled ?? false
    progress.value = response.status?.progress ?? progress.value
    startPolling()
    emit('update:show', false)
    message.success('自动采集已在后台开始，关闭侧栏也会继续运行')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 启动后台自动采集失败', detail, error)
    message.error(`自动采集失败：${detail}`)
    progress.value = {
      phase: 'error',
      message: detail,
      scanned: progress.value?.scanned ?? 0,
      extracted: progress.value?.extracted ?? 0,
      skipped: progress.value?.skipped ?? 0,
    }
    isRunning.value = false
  }
}

onMounted(() => {
  void syncBackgroundStatus()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="auto-collect-dialog"
    :style="{ width: 'min(380px, calc(100vw - 24px))' }"
    title="自动采集笔记"
    :mask-closable="!isRunning"
    :closable="!isRunning"
    @update:show="emit('update:show', $event)"
  >
    <NText depth="3" class="dialog-hint">
      将在当前小红书标签页搜索关键词，按点赞/收藏/评论筛选后自动提取入库到历史任务。任务会交给后台继续运行，关闭侧栏也不会停止；采集过程中请勿切换小红书标签页。
    </NText>

    <NForm label-placement="top" :disabled="isRunning" size="small">
      <NFormItem label="搜索关键词" required>
        <NInput
          v-model:value="keyword"
          placeholder="例如：减脂早餐、露营装备"
          clearable
          @keydown.enter.prevent="startRun"
        />
      </NFormItem>

      <div class="filter-grid">
        <NFormItem label="最低点赞">
          <NInputNumber
            v-model:value="minLikedCount"
            :min="0"
            :step="100"
            placeholder="0 不限"
            class="filter-input"
          />
        </NFormItem>
        <NFormItem label="最低收藏">
          <NInputNumber
            v-model:value="minCollectedCount"
            :min="0"
            :step="100"
            placeholder="0 不限"
            class="filter-input"
          />
        </NFormItem>
        <NFormItem label="最低评论">
          <NInputNumber
            v-model:value="minCommentCount"
            :min="0"
            :step="50"
            placeholder="0 不限"
            class="filter-input"
          />
        </NFormItem>
      </div>

      <div class="filter-grid filter-grid--two">
        <NFormItem label="最多提取">
          <NInputNumber
            v-model:value="maxExtract"
            :min="1"
            :max="30"
            :step="1"
            class="filter-input"
          />
        </NFormItem>
        <NFormItem>
          <template #label>
            <span class="form-label-with-tip">
              下拉加载轮数
              <InfoTip
                content="首屏直出结果处理完后，再向下滚动加载更多搜索结果的次数（每轮约一屏，用于触发分页）"
              />
            </span>
          </template>
          <NInputNumber
            v-model:value="scrollRounds"
            :min="1"
            :max="8"
            :step="1"
            class="filter-input"
          />
        </NFormItem>
      </div>
    </NForm>

    <div v-if="progress" class="progress-box" role="status" aria-live="polite">
      <NText class="progress-message">{{ progress.message }}</NText>
      <NText depth="3" class="progress-stats">
        扫描 {{ progress.scanned }} · 入库 {{ progress.extracted }} · 跳过 {{ progress.skipped }}
      </NText>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <NButton v-if="!isRunning" quaternary @click="resetForm">重置</NButton>
        <div class="dialog-footer-actions">
          <NButton v-if="isRunning" @click="cancelRun">停止</NButton>
          <NButton v-else :disabled="isRunning" @click="close">关闭</NButton>
          <NButton type="primary" :loading="isRunning" @click="startRun">
            {{ isRunning ? '采集中…' : '开始采集' }}
          </NButton>
        </div>
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

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.filter-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.filter-input {
  width: 100%;
}

.form-label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.progress-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
}

.progress-message {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  color: #1d2129;
}

.progress-stats {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.dialog-footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
