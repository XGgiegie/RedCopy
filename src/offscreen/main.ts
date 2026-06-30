import { BACKGROUND_KEEPALIVE_MESSAGE } from '../shared/messages'

const KEEPALIVE_INTERVAL_MS = 20_000

function pingBackground() {
  void chrome.runtime.sendMessage({ type: BACKGROUND_KEEPALIVE_MESSAGE }).catch(() => {
    /* 后台重启间隙可忽略 */
  })
}

pingBackground()
setInterval(pingBackground, KEEPALIVE_INTERVAL_MS)
