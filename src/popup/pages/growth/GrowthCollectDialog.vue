<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NRadio,
  NRadioGroup,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import type { GrowthAcquireProgress, GrowthTextMode } from '../../../shared/growth-acquire'
import { GROWTH_AI_ACTION_LIMIT } from '../../../shared/growth-acquire'
import {
  getGrowthAiUsedCount,
  isGrowthAiQuotaExhausted,
} from '../../../shared/growth-ai-quota'
import { hasUnlimitedGrowthAi, loadAiSettings } from '../../../shared/ai-settings'
import {
  GrowthAcquireCancelledError,
  runGrowthAcquire,
} from '../../services/growth-acquire-runner'
import InfoTip from '../../components/InfoTip.vue'
import GrowthRunProgressDialog from './GrowthRunProgressDialog.vue'

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
const durationMinutes = ref(30)
const maxRepliesPerNote = ref(3)
const enableComment = ref(true)
const enableReply = ref(true)
const commentMode = ref<GrowthTextMode>('ai')
const aiCommentPrompt = ref('结合笔记内容简短夸赞并表达共鸣，自然引导关注或私信交流。')
const fixedCommentText = ref('写得太好了！学到了，已关注～')
const replyMode = ref<GrowthTextMode>('ai')
const aiReplyPrompt = ref('友好简短地回复，自然引导用户关注或私信交流，语气亲切不生硬。')
const fixedReplyText = ref('谢谢姐妹的关注～有问题随时私信我呀 💕')

const isRunning = ref(false)
const cancelled = ref(false)
const progress = ref<GrowthAcquireProgress | null>(null)
const showProgressDialog = ref(false)
const growthAiUsed = ref(0)
const growthAiUnlimited = ref(false)

const usesAiMode = computed(
  () =>
    (enableComment.value && commentMode.value === 'ai')
    || (enableReply.value && replyMode.value === 'ai'),
)

const growthAiRemaining = computed(() =>
  Math.max(0, GROWTH_AI_ACTION_LIMIT - growthAiUsed.value),
)

const aiQuotaBlocked = computed(
  () => usesAiMode.value && !growthAiUnlimited.value && growthAiRemaining.value <= 0,
)

const aiQuotaHint = computed(() =>
  growthAiUnlimited.value
    ? 'Pro 版 AI 评论与回复不限次数'
    : `AI 评论与回复每日合计 ${GROWTH_AI_ACTION_LIMIT} 次，今日用完后请改用固定文案或明日再试`,
)

async function refreshAiQuota() {
  const settings = await loadAiSettings()
  growthAiUnlimited.value = hasUnlimitedGrowthAi(settings)
  growthAiUsed.value = growthAiUnlimited.value ? 0 : await getGrowthAiUsedCount()
}

function resetForm() {
  keyword.value = ''
  minLikedCount.value = 0
  minCollectedCount.value = 0
  minCommentCount.value = 0
  durationMinutes.value = 30
  maxRepliesPerNote.value = 3
  enableComment.value = true
  enableReply.value = true
  commentMode.value = 'ai'
  aiCommentPrompt.value = '结合笔记内容简短夸赞并表达共鸣，自然引导关注或私信交流。'
  fixedCommentText.value = '写得太好了！学到了，已关注～'
  replyMode.value = 'ai'
  aiReplyPrompt.value = '友好简短地回复，自然引导用户关注或私信交流，语气亲切不生硬。'
  fixedReplyText.value = '谢谢姐妹的关注～有问题随时私信我呀 💕'
  progress.value = null
  cancelled.value = false
  growthAiUnlimited.value = false
  showProgressDialog.value = false
}

watch(
  () => props.show,
  (visible) => {
    if (visible && isRunning.value) {
      emit('update:show', false)
      showProgressDialog.value = true
      return
    }
    if (visible && !isRunning.value) {
      progress.value = null
      cancelled.value = false
      void refreshAiQuota()
    }
  },
)

function close() {
  emit('update:show', false)
}

function cancelRun() {
  cancelled.value = true
  progress.value = {
    phase: 'cancelled',
    message: '正在停止…',
    scanned: progress.value?.scanned ?? 0,
    skipped: progress.value?.skipped ?? 0,
    replied: progress.value?.replied ?? 0,
    commented: progress.value?.commented ?? 0,
    aiUsed: progress.value?.aiUsed ?? 0,
    remainingSec: progress.value?.remainingSec ?? 0,
  }
}

async function startRun() {
  if (isRunning.value) return

  if (!keyword.value.trim()) {
    message.warning('请填写搜索关键词')
    return
  }

  if (!enableComment.value && !enableReply.value) {
    message.warning('请至少开启「发表评论」或「回复评论」')
    return
  }

  if (enableComment.value) {
    if (commentMode.value === 'fixed' && !fixedCommentText.value.trim()) {
      message.warning('请填写固定评论内容')
      return
    }
    if (commentMode.value === 'ai' && !aiCommentPrompt.value.trim()) {
      message.warning('请填写 AI 评论提示词')
      return
    }
  }

  if (enableReply.value) {
    if (replyMode.value === 'fixed' && !fixedReplyText.value.trim()) {
      message.warning('请填写固定回复内容')
      return
    }
    if (replyMode.value === 'ai' && !aiReplyPrompt.value.trim()) {
      message.warning('请填写 AI 回复提示词')
      return
    }
  }

  const needsAi =
    (enableComment.value && commentMode.value === 'ai')
    || (enableReply.value && replyMode.value === 'ai')
  if (needsAi) {
    await refreshAiQuota()
    if (!growthAiUnlimited.value && isGrowthAiQuotaExhausted(growthAiUsed.value)) {
      message.warning(`AI 今日额度已用完（每日共 ${GROWTH_AI_ACTION_LIMIT} 次），请改用固定文案或明日再试`)
      return
    }
  }

  const config = {
    keyword: keyword.value.trim(),
    minLikedCount: minLikedCount.value || 0,
    minCollectedCount: minCollectedCount.value || 0,
    minCommentCount: minCommentCount.value || 0,
    durationMinutes: Math.min(Math.max(durationMinutes.value || 30, 1), 480),
    maxRepliesPerNote: Math.min(Math.max(maxRepliesPerNote.value || 3, 1), 10),
    enableComment: enableComment.value,
    enableReply: enableReply.value,
    commentMode: commentMode.value,
    aiCommentPrompt: aiCommentPrompt.value.trim(),
    fixedCommentText: fixedCommentText.value.trim(),
    replyMode: replyMode.value,
    aiReplyPrompt: aiReplyPrompt.value.trim(),
    fixedReplyText: fixedReplyText.value.trim(),
  }

  isRunning.value = true
  cancelled.value = false
  const aiUsedBeforeRun = needsAi
    ? growthAiUsed.value
    : growthAiUnlimited.value
      ? 0
      : await getGrowthAiUsedCount()
  progress.value = {
    phase: 'navigating',
    message: '准备开始…',
    scanned: 0,
    skipped: 0,
    replied: 0,
    commented: 0,
    aiUsed: aiUsedBeforeRun,
    aiUnlimited: growthAiUnlimited.value,
    remainingSec: config.durationMinutes * 60,
  }

  emit('update:show', false)
  showProgressDialog.value = true

  try {
    const result = await runGrowthAcquire(config, {
      onProgress: (value) => {
        progress.value = value
      },
      isCancelled: () => cancelled.value,
    })

    const summary = `评论 ${result.commented} 条，回复 ${result.replied} 条`
    if (cancelled.value) {
      message.info(`自动获客已停止：${summary}`)
    } else {
      message.success(`自动获客结束：${summary}`)
    }
    if (result.replied > 0 || result.commented > 0) emit('completed')
  } catch (error) {
    if (error instanceof GrowthAcquireCancelledError) {
      const replied = progress.value?.replied ?? 0
      const commented = progress.value?.commented ?? 0
      message.info(
        replied > 0 || commented > 0
          ? `自动获客已停止：评论 ${commented} 条，回复 ${replied} 条`
          : '自动获客已停止',
      )
      if (replied > 0 || commented > 0) emit('completed')
    } else {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy][获客] 自动获客失败', detail, error)
      message.error(`自动获客失败：${detail}`)
      progress.value = {
        phase: 'error',
        message: detail,
        scanned: progress.value?.scanned ?? 0,
        skipped: progress.value?.skipped ?? 0,
        replied: progress.value?.replied ?? 0,
        commented: progress.value?.commented ?? 0,
        aiUsed: progress.value?.aiUsed ?? 0,
        remainingSec: progress.value?.remainingSec ?? 0,
      }
    }
  } finally {
    isRunning.value = false
    void refreshAiQuota()
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="growth-collect-dialog"
    :style="{ width: 'min(400px, calc(100vw - 24px))' }"
    :content-style="{ padding: '12px 16px 0' }"
    title="涨粉自动获客"
    @update:show="emit('update:show', $event)"
  >
    <div class="dialog-scroll-body">
      <NText depth="3" class="dialog-hint">
        运行期间请勿切换标签页，注意控制频率。
      </NText>

      <div
        class="ai-quota-banner"
        :class="{ 'ai-quota-banner--empty': !growthAiUnlimited && growthAiRemaining <= 0 }"
        role="status"
      >
        <span class="ai-quota-banner-label">今日 AI</span>
        <span v-if="growthAiUnlimited" class="ai-quota-banner-remain">
          <strong>不限</strong>
        </span>
        <span v-else class="ai-quota-banner-remain">
          还剩 <strong>{{ growthAiRemaining }}</strong> 次
        </span>
        <span v-if="!growthAiUnlimited" class="ai-quota-banner-total">/ {{ GROWTH_AI_ACTION_LIMIT }} 次</span>
        <span v-if="!growthAiUnlimited && growthAiRemaining <= 0" class="ai-quota-banner-warn">
          今日已用完
        </span>
      </div>

      <NForm label-placement="top" size="small" class="growth-collect-form">
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
        <NFormItem>
          <template #label>
            <span class="form-label-with-tip">
              运行时长（分钟）
              <InfoTip content="到时自动停止；也可随时手动停止" />
            </span>
          </template>
          <NInputNumber
            v-model:value="durationMinutes"
            :min="1"
            :max="480"
            :step="5"
            class="filter-input"
          />
        </NFormItem>
        <NFormItem label="每篇最多回复">
          <NInputNumber
            v-model:value="maxRepliesPerNote"
            :min="1"
            :max="10"
            :step="1"
            class="filter-input"
            :disabled="!enableReply"
          />
        </NFormItem>
      </div>

      <div class="action-section">
        <NText strong class="action-section-title">互动动作</NText>
        <NSpace>
          <NCheckbox v-model:checked="enableComment">发表评论</NCheckbox>
          <NCheckbox v-model:checked="enableReply">回复评论</NCheckbox>
        </NSpace>
      </div>

      <div
        v-if="enableComment || enableReply"
        class="risk-disclaimer"
        role="note"
      >
        <p class="risk-disclaimer-recommend">推荐使用 AI 评论 / AI 回复，每条文案更有变化，更不易触发平台风控。</p>
        <p class="risk-disclaimer-warn">
          固定评论/回复重复发送相同文案，更容易触发平台风控；相关后果由您自行承担，与本工具及开发者无关。
        </p>
      </div>

      <template v-if="enableComment">
        <NFormItem label="发评论方式">
          <NRadioGroup v-model:value="commentMode">
            <NSpace>
              <NRadio value="ai">AI 评论（推荐）</NRadio>
              <NRadio value="fixed">固定评论</NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>

        <NFormItem v-if="commentMode === 'ai'">
          <template #label>
            <span class="form-label-with-tip">
              AI 评论提示词
              <InfoTip
                :content="`约束 AI 评论风格，需已配置 API Key；${aiQuotaHint}`"
              />
            </span>
          </template>
          <NInput
            v-model:value="aiCommentPrompt"
            type="textarea"
            :rows="2"
            placeholder="例如：结合笔记内容夸赞并引导关注"
          />
        </NFormItem>

        <NFormItem v-else label="固定评论内容" required>
          <NInput
            v-model:value="fixedCommentText"
            type="textarea"
            :rows="2"
            placeholder="每篇笔记下发表相同评论"
          />
        </NFormItem>
      </template>

      <template v-if="enableReply">
        <NFormItem label="回复评论方式">
        <NRadioGroup v-model:value="replyMode">
          <NSpace>
            <NRadio value="ai">AI 回复（推荐）</NRadio>
            <NRadio value="fixed">固定回复</NRadio>
          </NSpace>
        </NRadioGroup>
      </NFormItem>

      <NFormItem v-if="replyMode === 'ai'" label="AI 回复提示词" required>
        <template #label>
          <span class="form-label-with-tip">
            AI 回复提示词
            <InfoTip
              :content="`约束 AI 回复风格，需已配置 API Key；${aiQuotaHint}`"
            />
          </span>
        </template>
        <NInput
          v-model:value="aiReplyPrompt"
          type="textarea"
          :rows="2"
          placeholder="例如：用亲切语气回复，引导用户关注并私信领取资料"
        />
      </NFormItem>

      <NFormItem v-else label="固定回复内容" required>
        <NInput
          v-model:value="fixedReplyText"
          type="textarea"
          :rows="2"
          placeholder="每条评论将发送相同内容"
        />
      </NFormItem>
      </template>

      </NForm>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <NButton quaternary @click="resetForm">重置</NButton>
        <div class="dialog-footer-actions">
          <NButton @click="close">关闭</NButton>
          <NButton type="primary" :disabled="aiQuotaBlocked" @click="startRun">
            开始运行
          </NButton>
        </div>
      </div>
    </template>
  </NModal>

  <GrowthRunProgressDialog
    v-model:show="showProgressDialog"
    :progress="progress"
    :is-running="isRunning"
    @stop="cancelRun"
  />
</template>

<style scoped>
.dialog-scroll-body {
  max-height: min(58vh, 400px);
  overflow-y: auto;
  padding-bottom: 4px;
  margin-right: -4px;
  padding-right: 4px;
}

.growth-collect-dialog :deep(.n-card__footer) {
  padding-top: 12px;
}

.growth-collect-form :deep(.n-form-item) {
  margin-bottom: 10px;
}

.growth-collect-form :deep(.n-form-item-label) {
  padding-bottom: 4px;
}

.dialog-hint {
  display: block;
  font-size: 11px;
  line-height: 1.45;
  margin-bottom: 8px;
}

.ai-quota-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f0f7ff;
  border: 1px solid #d4e8ff;
  font-size: 11px;
  line-height: 1.4;
  color: #4e5969;
}

.ai-quota-banner--empty {
  background: #fff7e8;
  border-color: #ffe7ba;
}

.ai-quota-banner-label {
  font-weight: 600;
  color: #1d2129;
}

.ai-quota-banner-remain strong {
  font-size: 15px;
  font-weight: 700;
  color: #2080f0;
}

.ai-quota-banner--empty .ai-quota-banner-remain strong {
  color: #f53f3f;
}

.ai-quota-banner-total {
  color: #86909c;
}

.ai-quota-banner-warn {
  color: #d48806;
  font-size: 11px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
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

.action-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 2px;
}

.action-section-title {
  font-size: 13px;
}

.risk-disclaimer {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
}

.risk-disclaimer-recommend {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 600;
  color: #1d2129;
}

.risk-disclaimer-warn {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #f53f3f;
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
