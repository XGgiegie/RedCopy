import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'
import { crxPopupHmr } from './plugins/crx-popup-hmr'

// 固定 dev server 端口，避免 CRXJS popup HMR WebSocket 连错端口
const DEV_PORT = 5173

export default defineConfig({
  // crx 必须在前，确保扩展 HMR 虚拟模块先注册
  plugins: [crx({ manifest }), vue(), crxPopupHmr()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    // 项目在外部磁盘时，原生文件监听常失效，改用轮询以确保 HMR 触发
    watch: {
      usePolling: true,
      interval: 300,
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: DEV_PORT,
      clientPort: DEV_PORT,
    },
    cors: true,
  },
})
