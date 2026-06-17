/**
 * 涨粉获客操作的随机等待区间（毫秒），模拟真人节奏，降低固定间隔被识别风险。
 * 区间为闭区间 [min, max]。
 */
export const GROWTH_TIMING = {
  /** 打开笔记后等待评论区渲染 */
  commentSettle: { min: 1_500, max: 3_500 },
  /** 发表评论 / 回复评论之间的间隔 */
  actionInterval: { min: 2_500, max: 6_500 },
  /** 关闭详情后、打开下一篇前的间隔 */
  nextOpenDelay: { min: 2_000, max: 5_500 },
  /** 浏览笔记详情停留时间 */
  viewDetail: { min: 4_000, max: 12_000 },
  /** 搜索页首屏加载后额外等待 */
  afterSearchLoad: { min: 800, max: 1_800 },
  /** 分页滚动后等待 */
  afterScrollStep: { min: 900, max: 2_200 },
  /** 每处理多少篇笔记后触发一次长休息 */
  restEveryNotes: 5,
  /** 长休息时长 */
  restBurst: { min: 8_000, max: 22_000 },
} as const

export type GrowthTimingRange = { min: number; max: number }

/** 在 [min, max] 内取随机整数毫秒 */
export function randomMs(range: GrowthTimingRange): number {
  const { min, max } = range
  if (max <= min) return min
  return Math.floor(min + Math.random() * (max - min + 1))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 随机等待并返回实际等待毫秒数（便于日志） */
export async function randomSleep(range: GrowthTimingRange): Promise<number> {
  const ms = randomMs(range)
  await sleep(ms)
  return ms
}
