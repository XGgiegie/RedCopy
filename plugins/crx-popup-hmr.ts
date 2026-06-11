import type { Plugin } from 'vite'

const VITE_CLIENT = '/@vite/client'
const HMR_PORT = '/@crx/client-port'
const CUSTOM_ELEMENTS = '/@webcomponents/custom-elements'

/** 与 CRXJS file-writer 保持一致的模块路径映射，供 HMR 热更新匹配 */
function getCrxFileName(id: string): string {
  let fileName = id
    .replace(/t=\d+&/g, '')
    .replace(/\?t=\d+$/g, '')
    .replace(/^\//, '')
    .replace(/\?/g, '__')
    .replace(/&/g, '_')
    .replace(/=/g, '--')
    .replace(/:/g, '-')

  if (fileName.includes('node_modules/')) {
    fileName = `vendor/${fileName.split('node_modules/').pop()!.replace(/\//g, '-')}`
  } else if (fileName.startsWith('@')) {
    fileName = `vendor/${fileName.slice(1).replace(/\//g, '-')}`
  } else if (fileName.startsWith('.vite/deps/')) {
    fileName = `vendor/${fileName.slice('.vite/deps/'.length)}`
  }

  if (fileName.startsWith('_')) {
    fileName = `underscore${fileName}`
  }

  return `/${fileName}.js`
}

/** 将 Vite 注入的 createHotContext 路径改为 CRXJS dist 路径 */
function patchHotContextPaths(code: string): string {
  if (
    !code.includes('createHotContext')
    && !code.includes('__vite__createHotContext')
  ) {
    return code
  }

  const hotPathPattern =
    /(?<=createHotContext\("|__vite__createHotContext\(")([^"]+)(?="\))/g

  return code.replace(hotPathPattern, (vitePath) =>
    getCrxFileName(vitePath.replace(/t=\d+&/g, '')),
  )
}

function patchViteClient(code: string): string {
  const wsIndex = code.indexOf('new WebSocket')
  if (wsIndex === -1) return code

  return [
    `import '${CUSTOM_ELEMENTS}';`,
    `import { HMRPort } from '${HMR_PORT}';`,
    code.slice(0, wsIndex),
    'new HMRPort',
    code.slice(wsIndex + 'new WebSocket'.length),
  ].join('')
}

/**
 * Popup 经 Service Worker 代理直连 Vite 时，不会走 CRXJS file-writer 管线。
 * 本插件在 dev serve 阶段补齐 HMRPort 与 createHotContext 路径补丁。
 */
export function crxPopupHmr(): Plugin {
  return {
    name: 'redcopy:crx-popup-hmr',
    apply: 'serve',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // CRXJS 与 Vite 各注入一次 @vite/client，去重避免双连接
        let seen = false
        return html.replace(
          /<script type="module" src="\/@vite\/client"><\/script>\s*/g,
          (match) => {
            if (seen) return ''
            seen = true
            return match
          },
        )
      },
    },
    transform(code, id) {
      // transformRequest 包装对多数模块生效；此处兜底 @vite/client 直连
      if (id.includes(VITE_CLIENT) || id.includes('vite/dist/client')) {
        const patched = patchViteClient(code)
        return patched === code ? null : { code: patched, map: null }
      }
      return null
    },
    configResolved(config) {
      // 必须在 Vite 注入 createHotContext 之后再打补丁
      config.plugins.push({
        name: 'redcopy:crx-hot-patch-late',
        apply: 'serve',
        enforce: 'post',
        transform(code) {
          const patched = patchHotContextPaths(code)
          if (patched === code) return null
          return { code: patched, map: null }
        },
      })
    },
  }
}
