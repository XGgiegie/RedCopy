/** 去掉 LLM 输出外层的 markdown 代码块包裹 */
export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/**
 * 将 JSON 字符串字面量内的裸换行/制表符转义。
 * 模型常在 body 等长文本字段里直接换行，导致 JSON.parse 失败。
 */
export function repairJsonStringNewlines(json: string): string {
  let result = ''
  let inString = false
  let escape = false

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]

    if (inString) {
      if (escape) {
        result += ch
        escape = false
        continue
      }
      if (ch === '\\') {
        result += ch
        escape = true
        continue
      }
      if (ch === '"') {
        inString = false
        result += ch
        continue
      }
      if (ch === '\n') {
        result += '\\n'
        continue
      }
      if (ch === '\r') {
        continue
      }
      if (ch === '\t') {
        result += '\\t'
        continue
      }
      result += ch
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      continue
    }

    result += ch
  }

  return result
}

/** 从混合文本中提取首个完整 JSON 对象子串 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

/** 解析 LLM 返回的 JSON 对象，兼容代码块包裹与裸换行 */
export function parseLlmJsonObject(content: string): Record<string, unknown> | null {
  const stripped = stripCodeFences(content)
  const extracted = extractJsonObject(stripped)
  const candidates = [stripped, extracted].filter(
    (item): item is string => Boolean(item),
  )

  for (const candidate of candidates) {
    for (const json of [candidate, repairJsonStringNewlines(candidate)]) {
      try {
        const parsed = JSON.parse(json) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // 尝试下一种修复策略
      }
    }
  }

  return null
}
