/** 本地存储加密信封：防止在 DevTools 中直接读取明文用户数据 */
const ENCRYPTED_MARKER = '__enc' as const
const ENCRYPTED_VERSION = 1 as const

export interface EncryptedStorageValue {
  [ENCRYPTED_MARKER]: typeof ENCRYPTED_VERSION
  iv: string
  ct: string
}

export function isEncryptedStorageValue(
  value: unknown,
): value is EncryptedStorageValue {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record[ENCRYPTED_MARKER] === ENCRYPTED_VERSION
    && typeof record.iv === 'string'
    && typeof record.ct === 'string'
  )
}

let cachedKey: Promise<CryptoKey> | null = null

function resolveExtensionSeed(): string {
  const id =
    typeof chrome !== 'undefined' && chrome.runtime?.id
      ? chrome.runtime.id
      : 'redcopy-offline-dev'
  return `${id}:redcopy-storage-v1`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveAesGcmKey(seed: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${seed}:薯薯小抄:local-storage`),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('redcopy:v1:storage-salt'),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function getCryptoKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = deriveAesGcmKey(resolveExtensionSeed())
  }
  return cachedKey
}

export async function encryptStorageValue(
  value: unknown,
): Promise<EncryptedStorageValue> {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  return {
    [ENCRYPTED_MARKER]: ENCRYPTED_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptStorageValue(
  payload: EncryptedStorageValue,
): Promise<unknown> {
  const key = await getCryptoKey()
  const iv = base64ToBytes(payload.iv)
  const ciphertext = base64ToBytes(payload.ct)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  const text = new TextDecoder().decode(plaintext)
  return JSON.parse(text) as unknown
}

let cachedHmacKey: Promise<CryptoKey> | null = null

async function deriveHmacKey(seed: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${seed}:薯薯小抄:quota-hmac`),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('redcopy:v1:quota-hmac-salt'),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  )
}

async function getHmacKey(): Promise<CryptoKey> {
  if (!cachedHmacKey) {
    cachedHmacKey = deriveHmacKey(resolveExtensionSeed())
  }
  return cachedHmacKey
}

/** 为本地额度等敏感计数生成 HMAC，用于检测篡改 */
export async function signIntegrityPayload(message: string): Promise<string> {
  const key = await getHmacKey()
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return bytesToBase64(new Uint8Array(signature))
}

/** 校验 HMAC；失败表示数据可能被手动修改 */
export async function verifyIntegrityPayload(
  message: string,
  mac: string,
): Promise<boolean> {
  try {
    const key = await getHmacKey()
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64ToBytes(mac),
      new TextEncoder().encode(message),
    )
  } catch {
    return false
  }
}
