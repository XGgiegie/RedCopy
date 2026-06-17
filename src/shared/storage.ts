import {
  STORAGE_GET_MESSAGE,
  STORAGE_REMOVE_MESSAGE,
  STORAGE_SET_MESSAGE,
  type StorageGetResponse,
  type StorageRemoveResponse,
  type StorageSetResponse,
} from './messages'
import {
  decryptStorageValue,
  encryptStorageValue,
  isEncryptedStorageValue,
} from './storage-crypto'

const REDCOPY_KEY_PREFIX = 'redcopy:'

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

function shouldEncryptKey(key: string): boolean {
  return key.startsWith(REDCOPY_KEY_PREFIX)
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

async function decodeStoredValue<T>(key: string, raw: unknown): Promise<T | undefined> {
  if (raw === undefined) return undefined

  if (!shouldEncryptKey(key)) {
    return raw as T
  }

  if (isEncryptedStorageValue(raw)) {
    try {
      return (await decryptStorageValue(raw)) as T
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 解密本地存储失败', { key, detail }, error)
      throw new Error('读取本地数据失败，请尝试重新保存设置或重新安装扩展')
    }
  }

  // 兼容旧版明文：下次写入时自动加密
  console.info('[RedCopy] 检测到明文本地存储，将在下次写入时加密', { key })
  return raw as T
}

async function encodeStoredValue(key: string, value: unknown): Promise<unknown> {
  if (!shouldEncryptKey(key)) return value
  return encryptStorageValue(value)
}

async function rawStorageGet(key: string): Promise<unknown> {
  if (hasDirectStorage()) {
    const data = await chrome.storage.local.get(key)
    return data[key]
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
  return response.value
}

async function rawStorageSet(key: string, value: unknown): Promise<void> {
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

/** 读取本地存储；无法直接访问时通过 background 代理 */
export async function storageGet<T = unknown>(
  key: string,
): Promise<T | undefined> {
  const raw = await rawStorageGet(key)
  return decodeStoredValue<T>(key, raw)
}

/** 写入本地存储；无法直接访问时通过 background 代理 */
export async function storageSet(key: string, value: unknown): Promise<void> {
  const encoded = await encodeStoredValue(key, value)
  await rawStorageSet(key, encoded)
}

/** 删除本地存储项；无法直接访问时通过 background 代理 */
export async function storageRemove(key: string): Promise<void> {
  if (hasDirectStorage()) {
    await chrome.storage.local.remove(key)
    return
  }

  console.info('[RedCopy] chrome.storage 不可用，改用 background 代理删除', {
    key,
  })

  const response = await sendStorageMessage<StorageRemoveResponse>({
    type: STORAGE_REMOVE_MESSAGE,
    key,
  })

  if (!response.ok) {
    throw new Error(response.error ?? '删除存储失败')
  }
}

/** 将旧版明文 redcopy:* 数据批量加密（安装/更新时调用） */
export async function migratePlainStorageToEncrypted(): Promise<void> {
  if (!hasDirectStorage()) return

  const all = await chrome.storage.local.get(null)
  let migrated = 0

  for (const [key, value] of Object.entries(all)) {
    if (!shouldEncryptKey(key)) continue
    if (isEncryptedStorageValue(value)) continue

    try {
      await storageSet(key, value)
      migrated += 1
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 明文存储迁移加密失败', { key, detail }, error)
    }
  }

  if (migrated > 0) {
    console.info('[RedCopy] 已完成本地存储加密迁移', { migrated })
  }
}
