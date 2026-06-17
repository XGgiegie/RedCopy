import { GROWTH_AI_ACTION_LIMIT } from './growth-acquire'
import { hasUnlimitedGrowthAi, loadAiSettings } from './ai-settings'
import {
  signIntegrityPayload,
  verifyIntegrityPayload,
} from './storage-crypto'
import { storageGet, storageSet } from './storage'

/** 获客豆包 AI 每日额度（评论 + 回复合计） */
export const GROWTH_AI_QUOTA_KEY = 'redcopy:growthAiDailyQuota'
/** 额度镜像备份，防止只删主键重置次数 */
const GROWTH_AI_QUOTA_MIRROR_KEY = 'redcopy:growthAiDailyQuotaMirror'
/** AI 调用流水账，与额度交叉校验 */
const GROWTH_AI_USAGE_LEDGER_KEY = 'redcopy:growthAiUsageLedger'

interface SignedDailyQuota {
  date: string
  used: number
  mac: string
}

interface SignedUsageLedger {
  date: string
  /** 每次 AI 调用的毫秒时间戳 */
  stamps: number[]
  mac: string
}

type QuotaPayload = SignedDailyQuota | { date: string; used: number }

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clampUsed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.min(Math.floor(value), GROWTH_AI_ACTION_LIMIT)
}

function quotaMessage(date: string, used: number): string {
  return `quota:${date}:${used}`
}

function ledgerMessage(date: string, stamps: number[]): string {
  return `ledger:${date}:${stamps.join(',')}`
}

async function sealQuota(date: string, used: number): Promise<SignedDailyQuota> {
  const normalized = clampUsed(used)
  const mac = await signIntegrityPayload(quotaMessage(date, normalized))
  return { date, used: normalized, mac }
}

async function sealLedger(date: string, stamps: number[]): Promise<SignedUsageLedger> {
  const normalized = stamps
    .filter((stamp) => Number.isFinite(stamp))
    .map((stamp) => Math.floor(stamp))
  const mac = await signIntegrityPayload(ledgerMessage(date, normalized))
  return { date, stamps: normalized, mac }
}

async function readSignedQuotaFromKey(
  key: string,
  today: string,
): Promise<{ used: number; tampered: boolean; missing: boolean }> {
  const raw = await storageGet<QuotaPayload | number>(key)

  if (raw === undefined) {
    return { used: 0, tampered: false, missing: true }
  }

  if (typeof raw === 'number') {
    return { used: 0, tampered: false, missing: false }
  }

  if (!raw || typeof raw !== 'object' || raw.date !== today) {
    return { used: 0, tampered: false, missing: true }
  }

  const used = clampUsed(raw.used)
  const mac = 'mac' in raw && typeof raw.mac === 'string' ? raw.mac : ''

  if (!mac) {
    console.info('[RedCopy][获客] 检测到未签名的 AI 额度，将在下次写入时加固', { key })
    return { used, tampered: false, missing: false }
  }

  const valid = await verifyIntegrityPayload(quotaMessage(today, used), mac)
  if (!valid) {
    console.warn('[RedCopy][获客] 检测到 AI 额度被篡改，今日将锁定 AI 功能', { key })
    return { used: GROWTH_AI_ACTION_LIMIT, tampered: true, missing: false }
  }

  return { used, tampered: false, missing: false }
}

async function readSignedLedger(today: string): Promise<{
  count: number
  tampered: boolean
  missing: boolean
  stamps: number[]
}> {
  const raw = await storageGet<SignedUsageLedger | { date: string; stamps: number[] }>(
    GROWTH_AI_USAGE_LEDGER_KEY,
  )

  if (!raw || typeof raw !== 'object' || raw.date !== today) {
    return { count: 0, tampered: false, missing: true, stamps: [] }
  }

  const stamps = Array.isArray(raw.stamps)
    ? raw.stamps.filter((stamp) => Number.isFinite(stamp)).map((stamp) => Math.floor(stamp))
    : []
  const mac = 'mac' in raw && typeof raw.mac === 'string' ? raw.mac : ''

  if (!mac) {
    return { count: stamps.length, tampered: false, missing: false, stamps }
  }

  const valid = await verifyIntegrityPayload(ledgerMessage(today, stamps), mac)
  if (!valid) {
    console.warn('[RedCopy][获客] 检测到 AI 调用流水被篡改，今日将锁定 AI 功能')
    return {
      count: GROWTH_AI_ACTION_LIMIT,
      tampered: true,
      missing: false,
      stamps,
    }
  }

  return { count: stamps.length, tampered: false, missing: false, stamps }
}

async function persistQuotaState(date: string, used: number, stamps: number[]): Promise<void> {
  const normalizedUsed = clampUsed(used)
  const normalizedStamps = stamps
    .filter((stamp) => Number.isFinite(stamp))
    .map((stamp) => Math.floor(stamp))
    .slice(-GROWTH_AI_ACTION_LIMIT)

  const sealedQuota = await sealQuota(date, normalizedUsed)
  const sealedLedger = await sealLedger(date, normalizedStamps)

  await Promise.all([
    storageSet(GROWTH_AI_QUOTA_KEY, sealedQuota),
    storageSet(GROWTH_AI_QUOTA_MIRROR_KEY, sealedQuota),
    storageSet(GROWTH_AI_USAGE_LEDGER_KEY, sealedLedger),
  ])
}

async function readEffectiveQuota(): Promise<{ date: string; used: number }> {
  const today = todayKey()
  const [primary, mirror, ledger] = await Promise.all([
    readSignedQuotaFromKey(GROWTH_AI_QUOTA_KEY, today),
    readSignedQuotaFromKey(GROWTH_AI_QUOTA_MIRROR_KEY, today),
    readSignedLedger(today),
  ])

  if (primary.tampered || mirror.tampered || ledger.tampered) {
    await persistQuotaState(today, GROWTH_AI_ACTION_LIMIT, ledger.stamps)
    return { date: today, used: GROWTH_AI_ACTION_LIMIT }
  }

  let quotaUsed = 0
  if (!primary.missing && !mirror.missing) {
    if (primary.used !== mirror.used) {
      console.warn('[RedCopy][获客] AI 额度主备不一致，以较高值为准', {
        primary: primary.used,
        mirror: mirror.used,
      })
    }
    quotaUsed = Math.max(primary.used, mirror.used)
  } else if (!primary.missing) {
    quotaUsed = primary.used
  } else if (!mirror.missing) {
    quotaUsed = mirror.used
  }

  const used = Math.max(quotaUsed, ledger.count)

  const needResync =
    used !== quotaUsed
    || primary.missing
    || mirror.missing
    || ledger.missing
    || ledger.stamps.length !== used

  if (needResync) {
    const stamps =
      ledger.stamps.length >= used
        ? ledger.stamps.slice(-used)
        : [
            ...ledger.stamps,
            ...Array.from({ length: used - ledger.stamps.length }, () => Date.now()),
          ]
    await persistQuotaState(today, used, stamps)
  }

  return { date: today, used }
}

export async function getGrowthAiUsedCount(): Promise<number> {
  const quota = await readEffectiveQuota()
  return quota.used
}

export async function getGrowthAiRemaining(): Promise<number> {
  const used = await getGrowthAiUsedCount()
  return Math.max(0, GROWTH_AI_ACTION_LIMIT - used)
}

export function isGrowthAiQuotaExhausted(used: number): boolean {
  return used >= GROWTH_AI_ACTION_LIMIT
}

/** 占用一次豆包 AI 额度；Pro 版不限次数；今日已达上限时返回 false */
export async function consumeGrowthAiSlot(): Promise<boolean> {
  const settings = await loadAiSettings()
  if (hasUnlimitedGrowthAi(settings)) {
    console.info('[RedCopy][获客] Pro 版无限 AI，跳过额度消耗')
    return true
  }

  const current = await readEffectiveQuota()
  if (isGrowthAiQuotaExhausted(current.used)) {
    console.info('[RedCopy][获客] 今日豆包 AI 额度已用完', {
      date: current.date,
      used: current.used,
      limit: GROWTH_AI_ACTION_LIMIT,
    })
    return false
  }

  const ledger = await readSignedLedger(current.date)
  const nextUsed = current.used + 1
  const nextStamps = [...ledger.stamps, Date.now()]

  await persistQuotaState(current.date, nextUsed, nextStamps)
  console.info('[RedCopy][获客] 今日豆包 AI 额度已消耗', {
    date: current.date,
    used: nextUsed,
    limit: GROWTH_AI_ACTION_LIMIT,
  })
  return true
}
