import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'RedCopy',
  version: '1.0.0',
  description: '浏览器扩展空模板',
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
    default_title: 'RedCopy',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'activeTab',
    'scripting',
    'sidePanel',
    'storage',
    'tabs',
    'webNavigation',
  ],
  host_permissions: [
    '*://*.xiaohongshu.com/*',
    'http://localhost:5173/*',
    'http://127.0.0.1:5173/*',
    'https://api.deepseek.com/*',
  ],
})
