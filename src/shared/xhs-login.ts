/** 小红书首页（用于引导登录） */
export const XHS_HOME_URL = 'https://www.xiaohongshu.com'

export type XhsLoginDetectSource =
  | 'user_id'
  | 'nickname'
  | 'api'
  | 'profile_link'
  | 'login_wall'
  | 'none'

/** 页面注入脚本的返回结构（须可 JSON 序列化） */
export interface XhsLoginInjectResult {
  loggedIn: boolean
  nickname?: string
  source: XhsLoginDetectSource
}

/**
 * 页面注入：检测当前是否已登录小红书。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectCheckXhsLogin(): Promise<XhsLoginInjectResult> {
  function norm(s: string) {
    return s.replace(/\s+/g, ' ').trim()
  }

  function pickNickname(data: Record<string, unknown>): string | undefined {
    const candidates = [data.nickname, data.nickName, data.nick_name, data.name]
    for (const raw of candidates) {
      if (typeof raw === 'string' && norm(raw)) return norm(raw)
    }
    return undefined
  }

  function pickUserId(data: Record<string, unknown> | undefined): string | undefined {
    if (!data) return undefined
    const candidates = [data.userId, data.user_id, data.id, data.redId, data.red_id]
    for (const raw of candidates) {
      if (typeof raw === 'string' && raw.trim()) return raw.trim()
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return String(raw)
    }
    return undefined
  }

  if (/\/login(?:\/|$|\?)/i.test(location.pathname)) {
    console.info('[RedCopy][登录] 当前位于登录页')
    return { loggedIn: false, source: 'login_wall' }
  }

  const win = window as Window & {
    __INITIAL_STATE__?: {
      user?: {
        loggedIn?: boolean
        guest?: boolean
        userId?: string | number
        userInfo?: {
          userId?: string | number
          nickname?: string
          nickName?: string
          name?: string
        }
        nickname?: string
        nickName?: string
        name?: string
      }
      main?: {
        userInfo?: {
          userId?: string | number
          nickname?: string
          nickName?: string
        }
      }
    }
  }

  const state = win.__INITIAL_STATE__
  const userState = state?.user

  if (userState?.loggedIn === false || userState?.guest === true) {
    console.info('[RedCopy][登录] __INITIAL_STATE__ 标记未登录', {
      loggedIn: userState.loggedIn,
      guest: userState.guest,
    })
    return { loggedIn: false, source: 'login_wall' }
  }

  const stateUserId =
    pickUserId(userState as Record<string, unknown> | undefined)
    ?? pickUserId(userState?.userInfo as Record<string, unknown> | undefined)
    ?? pickUserId(state?.main?.userInfo as Record<string, unknown> | undefined)

  if (userState?.loggedIn === true || stateUserId) {
    const nicknameCandidates: unknown[] = [
      userState?.userInfo?.nickname,
      userState?.userInfo?.nickName,
      userState?.userInfo?.name,
      userState?.nickname,
      userState?.nickName,
      userState?.name,
      state?.main?.userInfo?.nickname,
      state?.main?.userInfo?.nickName,
    ]
    let nickname: string | undefined
    for (const raw of nicknameCandidates) {
      if (typeof raw === 'string' && norm(raw)) {
        nickname = norm(raw)
        break
      }
    }
    console.info('[RedCopy][登录] __INITIAL_STATE__ 标记已登录', {
      userId: stateUserId,
      nickname,
    })
    return { loggedIn: true, nickname, source: 'user_id' }
  }

  const meEndpoints = [
    'https://edith.xiaohongshu.com/api/sns/web/v2/user/me',
    'https://www.xiaohongshu.com/api/sns/web/v2/user/me',
    'https://edith.xiaohongshu.com/api/sns/web/v1/user/selfinfo',
    'https://www.xiaohongshu.com/api/sns/web/v1/user/selfinfo',
  ]

  for (const endpoint of meEndpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      })

      if (!resp.ok) {
        console.info('[RedCopy][登录] /user/me 响应非 2xx', {
          endpoint,
          status: resp.status,
        })
        continue
      }

      const json = await resp.json() as {
        data?: Record<string, unknown> & { guest?: boolean }
      }
      const data = json?.data
      if (!data || typeof data !== 'object') continue

      if (data.guest === false || pickUserId(data)) {
        const nickname = pickNickname(data)
        console.info('[RedCopy][登录] /user/me 确认已登录', {
          endpoint,
          nickname,
          guest: data.guest,
        })
        return { loggedIn: true, nickname, source: 'api' }
      }

      if (data.guest === true) {
        console.info('[RedCopy][登录] /user/me 确认游客态', { endpoint })
        return { loggedIn: false, source: 'api' }
      }
    } catch (error) {
      console.warn('[RedCopy][登录] /user/me 请求失败', { endpoint, error })
    }
  }

  const profileLink = document.querySelector<HTMLAnchorElement>(
    'header a[href*="/user/profile/"], nav a[href*="/user/profile/"], a[href*="/user/profile/"]',
  )
  const profileHref = profileLink?.getAttribute('href') ?? ''
  if (profileHref && !profileHref.includes('/user/profile/self')) {
    const nickname = norm(profileLink?.textContent ?? '')
    console.info('[RedCopy][登录] 检测到个人主页入口', {
      href: profileHref.slice(0, 80),
      nickname: nickname || undefined,
    })
    return {
      loggedIn: true,
      nickname: nickname && nickname.length <= 30 ? nickname : undefined,
      source: 'profile_link',
    }
  }

  const profileEl =
    document.querySelector<HTMLElement>('[class*="user-name"]')
    || document.querySelector<HTMLElement>('[class*="username"]')
    || document.querySelector<HTMLElement>('header [class*="name"]')

  const fromDom = norm(profileEl?.textContent ?? '')
  if (fromDom && fromDom.length <= 30 && fromDom !== '登录' && fromDom !== '立即登录') {
    console.info('[RedCopy][登录] 从 DOM 识别登录昵称', { nickname: fromDom })
    return { loggedIn: true, nickname: fromDom, source: 'nickname' }
  }

  const header = document.querySelector('header') ?? document.body
  const headerLoginBtn = Array.from(
    header.querySelectorAll<HTMLElement>('button, a'),
  ).find((el) => {
    const text = norm(el.textContent ?? '')
    return text === '登录' || text === '立即登录'
  })

  if (headerLoginBtn) {
    console.info('[RedCopy][登录] 顶栏仍显示登录按钮')
    return { loggedIn: false, source: 'login_wall' }
  }

  console.info('[RedCopy][登录] 未能确认登录态，保守判定未登录')
  return { loggedIn: false, source: 'none' }
}

/** 打开或聚焦小红书首页，便于用户完成登录 */
export async function openXhsHomePage(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*' })
  const existing = tabs.find(
    (tab) => tab.id && /xiaohongshu\.com/i.test(tab.url ?? ''),
  )

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: XHS_HOME_URL })
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
    console.info('[RedCopy][登录] 已聚焦小红书页面', { tabId: existing.id })
    return
  }

  const tab = await chrome.tabs.create({ url: XHS_HOME_URL, active: true })
  console.info('[RedCopy][登录] 已打开小红书页面', { tabId: tab.id })
}
