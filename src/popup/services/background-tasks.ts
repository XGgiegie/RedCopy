import type {
  AnalyzeGenerateMode,
  AnalyzeGenerateTaskResponse,
  AnalyzeGenerateTaskStatusesResponse,
  AutoCollectTaskResponse,
  GrowthAcquireTaskResponse,
} from '../../shared/messages'
import type { CreationPurposeKey } from '../../shared/creation-intent'
import {
  GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE,
  GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE,
  GET_AUTO_COLLECT_TASK_STATUS_MESSAGE,
  GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE,
  START_ANALYZE_GENERATE_TASK_MESSAGE,
  START_AUTO_COLLECT_TASK_MESSAGE,
  START_GROWTH_ACQUIRE_TASK_MESSAGE,
  STOP_AUTO_COLLECT_TASK_MESSAGE,
  STOP_GROWTH_ACQUIRE_TASK_MESSAGE,
} from '../../shared/messages'
import type { AutoCollectConfig } from '../../shared/auto-collect'
import type { GrowthAcquireConfig } from '../../shared/growth-acquire'

async function sendTaskMessage<TResponse>(
  payload: Record<string, unknown>,
): Promise<TResponse> {
  let response: TResponse | undefined
  try {
    response = (await chrome.runtime.sendMessage(payload)) as TResponse | undefined
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`与后台通信失败：${detail}`)
  }

  if (!response) throw new Error('后台无响应，请刷新扩展后重试')
  return response
}

function assertOk<T extends { ok: boolean; error?: string }>(response: T): T {
  if (!response.ok) throw new Error(response.error ?? '后台任务失败')
  return response
}

export async function startAutoCollectTask(
  config: AutoCollectConfig,
): Promise<AutoCollectTaskResponse> {
  return assertOk(
    await sendTaskMessage<AutoCollectTaskResponse>({
      type: START_AUTO_COLLECT_TASK_MESSAGE,
      config,
    }),
  )
}

export async function stopAutoCollectTask(): Promise<AutoCollectTaskResponse> {
  return assertOk(
    await sendTaskMessage<AutoCollectTaskResponse>({
      type: STOP_AUTO_COLLECT_TASK_MESSAGE,
    }),
  )
}

export async function getAutoCollectTaskStatus(): Promise<AutoCollectTaskResponse> {
  return assertOk(
    await sendTaskMessage<AutoCollectTaskResponse>({
      type: GET_AUTO_COLLECT_TASK_STATUS_MESSAGE,
    }),
  )
}

export async function startGrowthAcquireTask(
  config: GrowthAcquireConfig,
): Promise<GrowthAcquireTaskResponse> {
  return assertOk(
    await sendTaskMessage<GrowthAcquireTaskResponse>({
      type: START_GROWTH_ACQUIRE_TASK_MESSAGE,
      config,
    }),
  )
}

export async function stopGrowthAcquireTask(): Promise<GrowthAcquireTaskResponse> {
  return assertOk(
    await sendTaskMessage<GrowthAcquireTaskResponse>({
      type: STOP_GROWTH_ACQUIRE_TASK_MESSAGE,
    }),
  )
}

export async function getGrowthAcquireTaskStatus(): Promise<GrowthAcquireTaskResponse> {
  return assertOk(
    await sendTaskMessage<GrowthAcquireTaskResponse>({
      type: GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE,
    }),
  )
}

export async function startAnalyzeGenerateTask(payload: {
  taskId: string
  mode?: AnalyzeGenerateMode
  purpose?: CreationPurposeKey
  topic?: string
  imageUrls?: string[]
}): Promise<AnalyzeGenerateTaskResponse> {
  return assertOk(
    await sendTaskMessage<AnalyzeGenerateTaskResponse>({
      type: START_ANALYZE_GENERATE_TASK_MESSAGE,
      ...payload,
    }),
  )
}

export async function getAnalyzeGenerateTaskStatus(
  taskId: string,
): Promise<AnalyzeGenerateTaskResponse> {
  return assertOk(
    await sendTaskMessage<AnalyzeGenerateTaskResponse>({
      type: GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE,
      taskId,
    }),
  )
}

export async function getAnalyzeGenerateTaskStatuses():
  Promise<AnalyzeGenerateTaskStatusesResponse> {
  return assertOk(
    await sendTaskMessage<AnalyzeGenerateTaskStatusesResponse>({
      type: GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE,
    }),
  )
}
