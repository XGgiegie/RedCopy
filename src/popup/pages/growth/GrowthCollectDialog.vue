<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
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
  DEFAULT_GROWTH_REPLY_PROMPT_TEMPLATE_ID,
  GROWTH_REPLY_PROMPT_TEMPLATES,
  getGrowthReplyPromptTemplate,
} from '../../../shared/growth-reply-templates'
import {
  getGrowthAcquireTaskStatus,
  startGrowthAcquireTask,
  stopGrowthAcquireTask,
} from '../../services/background-tasks'
import InfoTip from '../../components/InfoTip.vue'
import GrowthRunProgressDialog from './GrowthRunProgressDialog.vue'

const props = defineProps<{
  isXhsPage: boolean
}>()

const emit = defineEmits<{
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
const selectedReplyTemplateId = ref(DEFAULT_GROWTH_REPLY_PROMPT_TEMPLATE_ID)
const aiReplyPrompt = ref(
  getGrowthReplyPromptTemplate(DEFAULT_GROWTH_REPLY_PROMPT_TEMPLATE_ID).prompt,
)
const fixedReplyText = ref('谢谢姐妹的关注～有问题随时私信我呀 💕')

const isRunning = ref(false)
const cancelled = ref(false)
const progress = ref<GrowthAcquireProgress | null>(null)
const showProgressDialog = ref(false)
const growthAiUsed = ref(0)
const growthAiUnlimited = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

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

const selectedReplyTemplate = computed(() =>
  getGrowthReplyPromptTemplate(selectedReplyTemplateId.value),
)

function applyReplyTemplate(templateId: string) {
  const template = getGrowthReplyPromptTemplate(templateId)
  selectedReplyTemplateId.value = template.id
  aiReplyPrompt.value = template.prompt
}

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
  applyReplyTemplate(DEFAULT_GROWTH_REPLY_PROMPT_TEMPLATE_ID)
  fixedReplyText.value = '谢谢姐妹的关注～有问题随时私信我呀 💕'
  progress.value = null
  cancelled.value = false
  growthAiUnlimited.value = false
  showProgressDialog.value = false
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
    const response = await getGrowthAcquireTaskStatus()
    const status = response.status
    if (!status) return

    const wasRunning = isRunning.value
    isRunning.value = status.running
    cancelled.value = status.cancelled
    progress.value = status.progress

    if (status.running) {
      showProgressDialog.value = true
      startPolling()
      return
    }

    stopPolling()

    if (wasRunning) {
      void refreshAiQuota()
      if (status.error) {
        message.error(`自动垂直养号失败：${status.error}`)
      } else if (status.result) {
        const summary = `评论 ${status.result.commented} 条，回复 ${status.result.replied} 条`
        if (status.cancelled || status.progress?.phase === 'cancelled') {
          message.info(`自动垂直养号已停止：${summary}`)
        } else {
          message.success(`自动垂直养号结束：${summary}`)
        }
        if (status.result.replied > 0 || status.result.commented > 0) emit('completed')
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 同步后台自动垂直养号状态失败', detail, error)
  }
}

function cancelRun() {
  void stopGrowthAcquireTask()
    .then((response) => {
      cancelled.value = response.status?.cancelled ?? true
      progress.value = response.status?.progress ?? {
        phase: 'cancelled',
        message: '正在停止…',
        scanned: progress.value?.scanned ?? 0,
        skipped: progress.value?.skipped ?? 0,
        replied: progress.value?.replied ?? 0,
        commented: progress.value?.commented ?? 0,
        aiUsed: progress.value?.aiUsed ?? 0,
        remainingSec: progress.value?.remainingSec ?? 0,
      }
    })
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`停止失败：${detail}`)
    })
}

async function startRun() {
  if (isRunning.value) return

  if (!props.isXhsPage) {
    message.warning('请先打开小红书网站')
    return
  }

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

  showProgressDialog.value = true

  try {
    const response = await startGrowthAcquireTask(config)
    isRunning.value = response.status?.running ?? true
    cancelled.value = response.status?.cancelled ?? false
    progress.value = response.status?.progress ?? progress.value
    showProgressDialog.value = true
    startPolling()
    message.success('自动垂直养号已在后台开始，关闭侧栏也会继续运行')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 启动后台自动垂直养号失败', detail, error)
    message.error(`自动垂直养号失败：${detail}`)
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
    isRunning.value = false
    void refreshAiQuota()
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
  <section class="growth-collect-panel">
    <div class="dialog-scroll-body">
      <NText depth="3" class="dialog-hint">
        任务会交给后台继续运行，关闭侧栏也不会停止；运行期间请勿切换小红书标签页，注意控制频率。
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

        <div class="setting-row">
          <span class="setting-row-label">互动动作</span>
          <div class="tag-group" role="group" aria-label="互动动作">
            <button
              type="button"
              class="choice-tag"
              :class="{ 'choice-tag--active': enableComment }"
              :aria-pressed="enableComment"
              @click="enableComment = !enableComment"
            >
              发表评论
            </button>
            <button
              type="button"
              class="choice-tag"
              :class="{ 'choice-tag--active': enableReply }"
              :aria-pressed="enableReply"
              @click="enableReply = !enableReply"
            >
              回复评论
            </button>
          </div>
        </div>

        <div
          v-if="enableComment || enableReply"
          class="risk-disclaimer"
          role="note"
        >
          推荐 AI 文案；固定文案重复发送更容易触发平台风控，后果由您自行承担。
        </div>

        <template v-if="enableComment">
          <div class="setting-row setting-row--mode">
            <span class="setting-row-label">发评论方式</span>
            <div class="tag-group" role="group" aria-label="发评论方式">
              <button
                type="button"
                class="choice-tag"
                :class="{ 'choice-tag--active': commentMode === 'ai' }"
                :aria-pressed="commentMode === 'ai'"
                @click="commentMode = 'ai'"
              >
                AI 评论
              </button>
              <button
                type="button"
                class="choice-tag"
                :class="{ 'choice-tag--active': commentMode === 'fixed' }"
                :aria-pressed="commentMode === 'fixed'"
                @click="commentMode = 'fixed'"
              >
                固定评论
              </button>
            </div>
          </div>

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
              :autosize="{ minRows: 2, maxRows: 3 }"
              placeholder="例如：结合笔记内容夸赞并引导关注"
            />
          </NFormItem>

          <NFormItem v-else label="固定评论内容" required>
            <NInput
              v-model:value="fixedCommentText"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 3 }"
              placeholder="每篇笔记下发表相同评论"
            />
          </NFormItem>
        </template>

        <template v-if="enableReply">
          <div class="setting-row setting-row--mode">
            <span class="setting-row-label">回复评论方式</span>
            <div class="tag-group" role="group" aria-label="回复评论方式">
              <button
                type="button"
                class="choice-tag"
                :class="{ 'choice-tag--active': replyMode === 'ai' }"
                :aria-pressed="replyMode === 'ai'"
                @click="replyMode = 'ai'"
              >
                AI 回复
              </button>
              <button
                type="button"
                class="choice-tag"
                :class="{ 'choice-tag--active': replyMode === 'fixed' }"
                :aria-pressed="replyMode === 'fixed'"
                @click="replyMode = 'fixed'"
              >
                固定回复
              </button>
            </div>
          </div>

          <NFormItem v-if="replyMode === 'ai'" required class="reply-prompt-item">
            <template #label>
              <span class="form-label-with-tip">
                AI 回复提示词
                <InfoTip
                  :content="`约束 AI 回复风格，需已配置 API Key；${aiQuotaHint}`"
                />
              </span>
            </template>
            <div class="reply-prompt-stack">
              <div class="reply-template-panel">
                <span class="reply-template-title">回复模板</span>
                <div class="reply-template-tags" role="listbox" aria-label="AI 回复模板">
                  <button
                    v-for="template in GROWTH_REPLY_PROMPT_TEMPLATES"
                    :key="template.id"
                    type="button"
                    class="reply-template-tag"
                    :class="{ 'reply-template-tag--active': selectedReplyTemplateId === template.id }"
                    :aria-selected="selectedReplyTemplateId === template.id"
                    :title="template.description"
                    @click="applyReplyTemplate(template.id)"
                  >
                    {{ template.name }}
                  </button>
                </div>
                <NText depth="3" class="reply-template-desc">
                  {{ selectedReplyTemplate.description }}
                </NText>
              </div>
              <NInput
                v-model:value="aiReplyPrompt"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 6 }"
                placeholder="例如：用亲切语气回复，引导用户关注并私信领取资料"
              />
            </div>
          </NFormItem>

          <NFormItem v-else label="固定回复内容" required>
            <NInput
              v-model:value="fixedReplyText"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 3 }"
              placeholder="每条评论将发送相同内容"
            />
          </NFormItem>
        </template>
      </NForm>
    </div>

    <div class="dialog-footer">
      <NButton quaternary @click="resetForm">重置</NButton>
      <div class="dialog-footer-actions">
        <NButton
          type="primary"
          :disabled="aiQuotaBlocked || isRunning || !isXhsPage"
          :loading="isRunning"
          @click="startRun"
        >
          {{ isRunning ? '运行中' : '开始运行' }}
        </NButton>
      </div>
    </div>
  </section>

  <GrowthRunProgressDialog
    v-model:show="showProgressDialog"
    :progress="progress"
    :is-running="isRunning"
    @stop="cancelRun"
  />
</template>

<style scoped>
.dialog-scroll-body {
  padding-bottom: 2px;
}

.growth-collect-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  padding: 10px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #eef0f4;
  box-shadow: 0 1px 2px rgba(29, 33, 41, 0.04);
}

.growth-collect-form :deep(.n-form-item) {
  margin-bottom: 8px;
}

.growth-collect-form :deep(.n-form-item-label) {
  padding-bottom: 3px;
}

.dialog-hint {
  display: block;
  font-size: 11px;
  line-height: 1.45;
  margin-bottom: 6px;
}

.ai-quota-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 8px;
  padding: 5px 8px;
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

.setting-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 7px;
  margin-bottom: 10px;
}

.setting-row--mode {
  margin-bottom: 8px;
}

.setting-row-label {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 700;
  color: #1d2129;
}

.tag-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.reply-template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.choice-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.reply-template-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 999px;
  background: #fff;
  color: #4e5969;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.choice-tag:hover,
.reply-template-tag:hover {
  color: #ff2442;
  border-color: #ffb3c0;
  background: #fff5f6;
}

.choice-tag--active,
.choice-tag--active:hover,
.reply-template-tag--active,
.reply-template-tag--active:hover {
  color: #ff2442;
  border-color: #ffccc7;
  background: #fff1f0;
}

.reply-prompt-item :deep(.n-form-item-blank) {
  display: block;
}

.reply-prompt-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.reply-template-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
}

.reply-template-title {
  font-size: 12px;
  line-height: 1.2;
  font-weight: 700;
  color: #1d2129;
}

.reply-template-desc {
  font-size: 12px;
  line-height: 1.4;
}

.risk-disclaimer {
  margin: 0 0 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  font-size: 11px;
  line-height: 1.45;
  color: #f53f3f;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
}

.dialog-footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
