import {
  STORAGE_GET_MESSAGE,
  STORAGE_SET_MESSAGE,
  type StorageGetResponse,
  type StorageSetResponse,
} from './messages'

function canUseRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

/** 判断当前上下文能否直接访问 chrome.storage.local */
function hasDirectStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage != null &&
    chrome.storage.local != null
  )
}

async function sendStorageMessage<T>(
  payload: Record<string, unknown>,
): Promise<T> {
  if (!canUseRuntime()) {
    throw new Error('扩展运行时不可用，请在侧栏内保存设置或刷新扩展后重试')
  }

  let response: T | undefined
  try {
    response = (await chrome.runtime.sendMessage(payload)) as T | undefined
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 存储消息发送失败', detail, error)
    throw new Error(`与后台通信失败：${detail}`)
  }

  if (response === undefined) {
    throw new Error('后台无响应，请在 chrome://extensions 重新加载扩展后重试')
  }

  return response
}

/** 读取本地存储；无法直接访问时通过 background 代理 */
export async function storageGet<T = unknown>(
  key: string,
): Promise<T | undefined> {
  if (hasDirectStorage()) {
    const data = await chrome.storage.local.get(key)
    return data[key] as T | undefined
  }

  console.info('[RedCopy] chrome.storage 不可用，改用 background 代理读取', {
    key,
  })

  const response = await sendStorageMessage<StorageGetResponse>({
    type: STORAGE_GET_MESSAGE,
    key,
  })

  if (!response.ok) {
    throw new Error(response.error ?? '读取存储失败')
  }
  return response.value as T | undefined
}

/** 写入本地存储；无法直接访问时通过 background 代理 */
export async function storageSet(key: string, value: unknown): Promise<void> {
  if (hasDirectStorage()) {
    await chrome.storage.local.set({ [key]: value })
    return
  }

  console.info('[RedCopy] chrome.storage 不可用，改用 background 代理写入', {
    key,
  })

  const response = await sendStorageMessage<StorageSetResponse>({
    type: STORAGE_SET_MESSAGE,
    key,
    value,
  })

  if (!response.ok) {
    throw new Error(response.error ?? '写入存储失败')
  }
}
