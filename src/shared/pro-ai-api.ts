/** Pro 版 OpenAI 兼容接口（内部使用，不在 UI 暴露服务商名称） */
export const PRO_AI_BASE_URL = 'https://aihubmix.com/v1'

/** 保存 Pro Key 时用于探活的轻量模型（非业务主力模型） */
export const PRO_VALIDATE_MODEL = 'deepseek-v4-flash'

/** Pro 版文本主力模型 */
export const PRO_TEXT_MODEL = 'gemini-3.5-flash'

/** Pro 版图片模型 */
export const PRO_IMAGE_MODELS = ['gemini-3.1-flash-image', 'chat-gpt-2'] as const

export type ProImageModel = (typeof PRO_IMAGE_MODELS)[number]

/** 设置页展示的 Pro 能力说明（不暴露上游服务商） */
export const PRO_CAPABILITY_SUMMARY = {
  title: 'Pro 版',
  description: '使用高级大模型，文本与识图能力更强',
  textModel: PRO_TEXT_MODEL,
  imageModels: [...PRO_IMAGE_MODELS],
  supports: ['文本分析', '配图识别', '生成类似笔记', 'AI 配图生成', '无限 AI 评论', '无限 AI 回复'],
  growthBenefit: '涨粉自动获客中的 AI 评论与 AI 回复不限次数',
  note: '免费版与 Pro 版只能二选一；保存 Pro Key 时会自动验证有效性。',
} as const

interface ProChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/** 保存前验证 Pro 版 API Key 是否可用 */
export async function validateProApiKey(apiKey: string): Promise<void> {
  const key = apiKey.trim()
  if (!key) {
    throw new Error('请输入 Pro 版 API Key')
  }

  console.info('[RedCopy] 开始验证 Pro 版 API Key', {
    model: PRO_VALIDATE_MODEL,
  })

  const response = await fetch(`${PRO_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PRO_VALIDATE_MODEL,
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
    }),
  })

  const data = (await response.json()) as ProChatCompletionResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] Pro 版 API Key 验证失败', { status: response.status, detail })
    throw new Error(`Pro 版 API Key 无效：${detail}`)
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    console.error('[RedCopy] Pro 版 API Key 验证响应异常', data)
    throw new Error('Pro 版 API Key 验证未通过，请检查 Key 是否正确')
  }

  console.info('[RedCopy] Pro 版 API Key 验证通过')
}
