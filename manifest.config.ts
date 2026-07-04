import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '薯薯小抄',
  version: '1.5.0',
  description: '一键提取小红书图文笔记，复制 Markdown，AI 帮你读懂爆款笔记',
  icons: {
    16: 'public/icons/icon-16.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_icon: {
      16: 'public/icons/icon-16.png',
      48: 'public/icons/icon-48.png',
      128: 'public/icons/icon-128.png',
    },
    default_title: '薯薯小抄',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['*://*.xiaohongshu.com/*'],
      js: ['src/content/xhs-detail-download-enhancer.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'activeTab',
    'downloads',
    'offscreen',
    'scripting',
    'sidePanel',
    'storage',
    'unlimitedStorage',
    'tabs',
    'webNavigation',
    'webRequest',
  ],
  host_permissions: [
    '*://*.xiaohongshu.com/*',
    '*://*.xhscdn.com/*',
    'https://ark.cn-beijing.volces.com/*',
    'https://*.tos-cn-beijing.volces.com/*',
    'https://aihubmix.com/*',
  ],
})
