import type { AiAnalysisResult } from './ai-types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  parseAnalysisContent,
  type AnalyzeNotePayload,
} from './analysis-core'
import type { AiSettings, DoubaoModel } from './ai-settings'
import { DOUBAO_BASE_URL, loadAiSettings } from './ai-settings'

interface DoubaoInputImage {
  type: 'input_image'
  image_url: string
}

interface DoubaoInputText {
  type: 'input_text'
  text: string
}

interface DoubaoMessage {
  role: 'system' | 'user'
  content: Array<DoubaoInputImage | DoubaoInputText>
}

interface DoubaoResponsesRequest {
  model: DoubaoModel
  input: DoubaoMessage[]
}

interface DoubaoOutputText {
  type: 'output_text'
  text?: string
}

interface DoubaoOutputMessage {
  type: 'message'
  role?: string
  content?: DoubaoOutputText[]
}

interface DoubaoResponsesResponse {
  output?: DoubaoOutputMessage[]
  error?: { message?: string }
}

async function resolveDoubaoSettingsAsync(settings?: AiSettings) {
  const resolved = settings ?? (await loadAiSettings())
  const apiKey = resolved.doubao.apiKey.trim()
  if (!apiKey) {
    throw new Error('请先在设置页配置豆包 ARK API Key')
  }
  return { apiKey, model: resolved.doubao.model }
}

function buildDoubaoInput(
  userPrompt: string,
  imageUrls: string[] | undefined,
): DoubaoMessage[] {
  const userContent: Array<DoubaoInputImage | DoubaoInputText> = []

  for (const imageUrl of imageUrls ?? []) {
    userContent.push({ type: 'input_image', image_url: imageUrl })
  }

  userContent.push({ type: 'input_text', text: userPrompt })

  return [
    {
      role: 'system',
      content: [{ type: 'input_text', text: ANALYSIS_SYSTEM_PROMPT }],
    },
    {
      role: 'user',
      content: userContent,
    },
  ]
}

function extractDoubaoText(data: DoubaoResponsesResponse): string {
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text.trim()
      }
    }
  }

  throw new Error('豆包未返回分析内容')
}

/** 使用火山方舟 Responses API 进行图文分析 */
export async function requestDoubaoAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const { apiKey, model } = await resolveDoubaoSettingsAsync(settings)
  const userPrompt = buildAnalysisUserPrompt(payload)
  const body: DoubaoResponsesRequest = {
    model,
    input: buildDoubaoInput(userPrompt, payload.imageUrls),
  }

  console.info('[RedCopy] 请求豆包图文分析', {
    model,
    noteId: payload.noteId,
    imageCount: payload.imageUrls?.length ?? 0,
    title: payload.text.title?.slice(0, 40),
  })

  const response = await fetch(`${DOUBAO_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as DoubaoResponsesResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] 豆包 API 错误', { status: response.status, detail })
    throw new Error(`豆包分析失败：${detail}`)
  }

  const content = extractDoubaoText(data)
  const analysis = parseAnalysisContent(content)

  console.info('[RedCopy] 豆包分析完成', {
    model,
    summaryLength: analysis.summary.length,
    score: analysis.score,
  })

  return analysis
}
