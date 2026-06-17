/** 笔记详情弹窗内的一条可回复评论 */
export interface NoteCommentItem {
  index: number
  author: string
  text: string
}

export interface CollectCommentsResult {
  items: NoteCommentItem[]
  reason?: string
}

export interface ReplyCommentResult {
  replied: boolean
  reason?: string
}

export interface PostCommentResult {
  posted: boolean
  reason?: string
}

/** 采集评论时的过滤条件（须可 JSON 序列化传给 executeScript） */
export interface InjectCollectCommentsFilter {
  maxCount?: number
  /** 跳过这些昵称（通常为当前登录用户） */
  skipAuthors?: string[]
  /** 跳过正文完全匹配的评论（如本会话刚发表的） */
  skipTexts?: string[]
}

/**
 * 页面注入：获取当前登录用户昵称。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export function injectGetLoggedInNickname(): string | null {
  function norm(s: string) {
    return s.replace(/\s+/g, ' ').trim()
  }

  const win = window as Window & {
    __INITIAL_STATE__?: {
      user?: {
        userInfo?: { nickname?: string; nickName?: string; name?: string }
        nickname?: string
        nickName?: string
        name?: string
      }
      main?: {
        userInfo?: { nickname?: string; nickName?: string; name?: string }
      }
    }
  }

  const candidates: unknown[] = [
    win.__INITIAL_STATE__?.user?.userInfo?.nickname,
    win.__INITIAL_STATE__?.user?.userInfo?.nickName,
    win.__INITIAL_STATE__?.user?.userInfo?.name,
    win.__INITIAL_STATE__?.user?.nickname,
    win.__INITIAL_STATE__?.user?.nickName,
    win.__INITIAL_STATE__?.user?.name,
    win.__INITIAL_STATE__?.main?.userInfo?.nickname,
    win.__INITIAL_STATE__?.main?.userInfo?.nickName,
  ]

  for (const raw of candidates) {
    if (typeof raw === 'string' && norm(raw)) {
      console.info('[RedCopy][获客] 已识别当前登录昵称', { nickname: norm(raw) })
      return norm(raw)
    }
  }

  const profileEl =
    document.querySelector<HTMLElement>('[class*="user-name"]')
    || document.querySelector<HTMLElement>('[class*="username"]')
    || document.querySelector<HTMLElement>('header [class*="name"]')

  const fromDom = norm(profileEl?.textContent ?? '')
  if (fromDom && fromDom.length <= 30) {
    console.info('[RedCopy][获客] 从 DOM 识别当前昵称', { nickname: fromDom })
    return fromDom
  }

  return null
}

/**
 * 页面注入：在笔记详情弹窗底部发表评论（顶层评论，非回复）。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectPostNoteComment(commentText: string): Promise<PostCommentResult> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const randomMs = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min + 1))

  function fireHumanClick(el: Element) {
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', init))
    el.dispatchEvent(new MouseEvent('mouseup', init))
    el.dispatchEvent(new MouseEvent('click', init))
  }

  function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, value)
    } else {
      el.value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function setContentEditable(el: HTMLElement, value: string) {
    el.focus()
    el.textContent = value
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
  }

  function findModalRoot(): Element {
    return (
      document.querySelector('.note-detail-mask')
      || document.querySelector('[class*="note-detail"]')
      || document.querySelector('.close-box')?.closest('[class*="container"]')
      || document.body
    )
  }

  function findSendButton(modal: Element): Element | null {
    return (
      [...modal.querySelectorAll('button')].find((el) => {
        const label = (el.textContent ?? '').trim()
        return label === '发送' || label === '发布' || label === '评论'
      })
      || modal.querySelector('[class*="send"]')
    )
  }

  function fillActiveInput(modal: Element, text: string): HTMLElement | null {
    const inputEl =
      modal.querySelector<HTMLTextAreaElement>('textarea:not([disabled])')
      || modal.querySelector<HTMLInputElement>('input[type="text"]:not([disabled])')
      || modal.querySelector<HTMLElement>('[contenteditable="true"]')

    if (!inputEl) return null

    if (inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLInputElement) {
      inputEl.focus()
      setInputValue(inputEl, text)
    } else {
      setContentEditable(inputEl, text)
    }
    return inputEl
  }

  const modal = findModalRoot()

  const commentArea =
    modal.querySelector('[class*="comment"]')
    || modal.querySelector('[class*="interaction"]')
    || modal
  commentArea.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior })
  await sleep(randomMs(300, 700))

  const inputCandidates: Element[] = [
    ...modal.querySelectorAll('[class*="comment-input"]'),
    ...modal.querySelectorAll('[class*="input-box"]'),
    ...modal.querySelectorAll('textarea'),
    ...modal.querySelectorAll('[contenteditable="true"]'),
  ]

  let inputTrigger: Element | null = null
  for (const el of inputCandidates) {
    const placeholder =
      el.getAttribute('placeholder')
      || el.querySelector('[placeholder]')?.getAttribute('placeholder')
      || ''
    const hint = (el.textContent ?? '') + placeholder
    if (
      /说点什么|发表评论|留下你的想法|写评论|评论/i.test(hint)
      || el.tagName === 'TEXTAREA'
      || el.getAttribute('contenteditable') === 'true'
    ) {
      inputTrigger = el
      break
    }
  }

  if (!inputTrigger) {
    inputTrigger =
      modal.querySelector('[class*="comment-input"]')
      || modal.querySelector('[class*="input-box"]')
      || modal.querySelector('textarea')
      || modal.querySelector('[contenteditable="true"]')
  }

  if (!inputTrigger) {
    console.info('[RedCopy][获客] 未找到发评论输入框')
    return { posted: false, reason: 'comment-input-not-found' }
  }

  fireHumanClick(inputTrigger)
  await sleep(randomMs(400, 900))

  const filled = fillActiveInput(modal, commentText)
  if (!filled) {
    return { posted: false, reason: 'comment-input-not-found' }
  }

  await sleep(randomMs(250, 600))

  const sendBtn = findSendButton(modal)
  if (!sendBtn) {
    return { posted: false, reason: 'send-button-not-found' }
  }

  fireHumanClick(sendBtn)
  await sleep(randomMs(600, 1200))

  console.info('[RedCopy][获客] 已发表评论', { length: commentText.length })
  return { posted: true }
}

/**
 * 页面注入：采集当前笔记详情弹窗内可见、可回复的顶层评论。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export function injectCollectReplyableComments(
  filter: InjectCollectCommentsFilter = {},
): CollectCommentsResult {
  function norm(s: string) {
    return s.replace(/\s+/g, ' ').trim()
  }

  function namesMatch(a: string, b: string): boolean {
    const left = norm(a).toLowerCase()
    const right = norm(b).toLowerCase()
    return Boolean(left && right && left === right)
  }

  function detectSelfNickname(): string | null {
    const win = window as Window & {
      __INITIAL_STATE__?: {
        user?: {
          userInfo?: { nickname?: string; nickName?: string }
          nickname?: string
          nickName?: string
        }
      }
    }
    const fromState =
      win.__INITIAL_STATE__?.user?.userInfo?.nickname
      ?? win.__INITIAL_STATE__?.user?.userInfo?.nickName
      ?? win.__INITIAL_STATE__?.user?.nickname
      ?? win.__INITIAL_STATE__?.user?.nickName
    if (typeof fromState === 'string' && norm(fromState)) return norm(fromState)
    return null
  }

  const maxCount = filter.maxCount ?? 5
  const skipAuthors = [...(filter.skipAuthors ?? [])]
  const selfNick = detectSelfNickname()
  if (selfNick && !skipAuthors.some((name) => namesMatch(name, selfNick))) {
    skipAuthors.push(selfNick)
  }
  const skipTexts = (filter.skipTexts ?? []).map((t) => norm(t)).filter(Boolean)

  const modal =
    document.querySelector('.note-detail-mask')
    || document.querySelector('[class*="note-detail"]')
    || document.querySelector('.close-box')?.closest('[class*="container"]')
    || document.body

  const commentSelectors = [
    '.parent-comment',
    '.comment-item',
    '[class*="comment-item"]',
    '[class*="CommentItem"]',
    '.comment-list > div',
    '.comments-container > div',
  ]

  let commentNodes: Element[] = []
  for (const selector of commentSelectors) {
    const found = modal.querySelectorAll(selector)
    if (found.length > 0) {
      commentNodes = [...found]
      break
    }
  }

  if (commentNodes.length === 0) {
    console.info('[RedCopy][获客] 未找到评论节点')
    return { items: [], reason: 'no-comment-nodes' }
  }

  const items: NoteCommentItem[] = []

  for (let i = 0; i < commentNodes.length && items.length < maxCount; i++) {
    const node = commentNodes[i]

    const authorEl =
      node.querySelector('[class*="name"]')
      || node.querySelector('[class*="author"]')
      || node.querySelector('a[href*="/user/profile"]')
    const author = (authorEl?.textContent ?? '').replace(/\s+/g, ' ').trim()

    const textEl =
      node.querySelector('[class*="content"]')
      || node.querySelector('[class*="text"]')
      || node.querySelector('p')
    let text = (textEl?.textContent ?? '').replace(/\s+/g, ' ').trim()

    if (!text) {
      const full = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      text = full.replace(author, '').replace(/回复|点赞|展开|收起/g, '').trim()
    }

    if (!text || text.length < 2) continue

    if (skipAuthors.some((name) => namesMatch(author, name))) {
      console.info('[RedCopy][获客] 跳过自己的评论', { author })
      continue
    }

    if (skipTexts.some((own) => own && norm(text) === own)) {
      console.info('[RedCopy][获客] 跳过刚发表的评论', { text: text.slice(0, 20) })
      continue
    }

    const isOwnCommentNode =
      node.matches('[class*="self"], [class*="mine"], [class*="my-comment"]')
      || Boolean(node.querySelector('[class*="self-comment"], [class*="my-comment"]'))
      || node.getAttribute('data-is-self') === 'true'
      || node.getAttribute('data-self') === 'true'
    if (isOwnCommentNode) {
      console.info('[RedCopy][获客] 跳过标记为本人的评论节点')
      continue
    }

    // 跳过已有子回复的评论（简单启发式：存在嵌套回复块）
    const hasSubReply = node.querySelector(
      '[class*="sub-comment"], [class*="reply-comment"], [class*="child-comment"]',
    )
    if (hasSubReply) continue

    items.push({ index: i, author, text })
  }

  console.info('[RedCopy][获客] 采集到可回复评论', {
    count: items.length,
    skipAuthors,
  })
  return { items }
}

/**
 * 页面注入：对指定序号的评论点击回复并发送内容。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectReplyToCommentAtIndex(
  commentIndex: number,
  replyText: string,
): Promise<ReplyCommentResult> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const randomMs = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min + 1))

  function fireHumanClick(el: Element) {
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', init))
    el.dispatchEvent(new MouseEvent('mouseup', init))
    el.dispatchEvent(new MouseEvent('click', init))
  }

  function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, value)
    } else {
      el.value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function setContentEditable(el: HTMLElement, value: string) {
    el.focus()
    el.textContent = value
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
  }

  function findModalRoot(): Element {
    return (
      document.querySelector('.note-detail-mask')
      || document.querySelector('[class*="note-detail"]')
      || document.querySelector('.close-box')?.closest('[class*="container"]')
      || document.body
    )
  }

  function findSendButton(modal: Element): Element | null {
    return (
      [...modal.querySelectorAll('button')].find((el) => {
        const label = (el.textContent ?? '').trim()
        return label === '发送' || label === '发布' || label === '回复'
      })
      || modal.querySelector('[class*="send"]')
    )
  }

  function fillActiveInput(modal: Element, text: string): HTMLElement | null {
    const inputEl =
      modal.querySelector<HTMLTextAreaElement>('textarea:not([disabled])')
      || modal.querySelector<HTMLInputElement>('input[type="text"]:not([disabled])')
      || modal.querySelector<HTMLElement>('[contenteditable="true"]')

    if (!inputEl) return null

    if (inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLInputElement) {
      inputEl.focus()
      setInputValue(inputEl, text)
    } else {
      setContentEditable(inputEl, text)
    }
    return inputEl
  }

  const modal = findModalRoot()

  const commentSelectors = [
    '.parent-comment',
    '.comment-item',
    '[class*="comment-item"]',
    '[class*="CommentItem"]',
    '.comment-list > div',
    '.comments-container > div',
  ]

  let commentNodes: Element[] = []
  for (const selector of commentSelectors) {
    const found = modal.querySelectorAll(selector)
    if (found.length > 0) {
      commentNodes = [...found]
      break
    }
  }

  const commentNode = commentNodes[commentIndex]
  if (!commentNode) {
    return { replied: false, reason: 'comment-not-found' }
  }

  commentNode.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  await sleep(randomMs(200, 500))

  const replyBtn =
    [...commentNode.querySelectorAll('button, span, a, div')].find((el) =>
      (el.textContent ?? '').trim() === '回复',
    )
    || commentNode.querySelector('[class*="reply"]')

  if (!replyBtn) {
    return { replied: false, reason: 'reply-button-not-found' }
  }

  fireHumanClick(replyBtn)
  await sleep(randomMs(400, 900))

  const filled = fillActiveInput(modal, replyText)
  if (!filled) {
    return { replied: false, reason: 'input-not-found' }
  }

  await sleep(randomMs(250, 600))

  const sendBtn = findSendButton(modal)
  if (!sendBtn) {
    return { replied: false, reason: 'send-button-not-found' }
  }

  fireHumanClick(sendBtn)
  await sleep(randomMs(600, 1200))

  console.info('[RedCopy][获客] 已发送评论回复', {
    commentIndex,
    replyLength: replyText.length,
  })
  return { replied: true }
}
