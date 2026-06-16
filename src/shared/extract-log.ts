import type { NoteExtractResult } from './note-types'

/** 提取结果中用于调试输出的 JSON 载荷 */
export interface ExtractContentPayload {
  ok: boolean
  noteId: string | null
  url: string
  noteType: NoteExtractResult['noteType']
  source: NoteExtractResult['source']
  text: NoteExtractResult['text']
  structured: Record<string, unknown> | null
  error?: string
}

export function buildExtractContentPayload(
  extract: NoteExtractResult,
  options?: { includeStructured?: boolean },
): ExtractContentPayload {
  return {
    ok: extract.ok,
    noteId: extract.noteId,
    url: extract.url,
    noteType: extract.noteType,
    source: extract.source,
    text: extract.text,
    structured:
      options?.includeStructured === false ? null : extract.structured,
    ...(extract.error ? { error: extract.error } : {}),
  }
}

/** 安全序列化为 JSON 字符串（避免循环引用导致抛错） */
export function safeJsonStringify(value: unknown, space = 2): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      return val
    },
    space,
  )
}

/** 在控制台打印提取内容 JSON（对象 + 可复制字符串） */
export function logExtractContentJson(
  extract: NoteExtractResult,
  tag = '[RedCopy]',
): void {
  const payload = buildExtractContentPayload(extract)
  // 使用 console.log，避免部分环境过滤 console.info
  console.log(`${tag} 提取内容 JSON`, payload)
  console.log(`${tag} 提取内容 JSON（可复制）\n${safeJsonStringify(payload)}`)
}
