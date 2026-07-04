const KEEPALIVE_INTERVAL_MS = 20000

function pingBackground() {
  chrome.runtime.sendMessage({ type: 'redcopy:background-keepalive' }).catch(() => {})
}

pingBackground()
setInterval(pingBackground, KEEPALIVE_INTERVAL_MS)
