# RedCopy

## 技术栈

- Vue 3 + TypeScript + Vite + CRXJS
- [Naive UI](https://www.naiveui.com/) + [vfonts](https://www.npmjs.com/package/vfonts)

## 结构

```
manifest.config.ts   # 扩展配置
src/shared/naive.ts  # Naive UI 主题、中文 locale
src/popup/           # Popup 页面（Naive 已在 main.ts 全局注入）
src/background/      # 后台脚本
public/icons/        # 扩展图标
```

## Naive UI 使用说明

- 字体：`main.ts` 已引入 `vfonts/Inter.css` 与 `FiraCode.css`
- 主题：`src/shared/naive.ts` 中配置小红书红色 `#ff2442`
- 中文：`zhCN` / `dateZhCN` 已在 `NConfigProvider` 中启用
- 在组件里按需 `import { NButton, ... } from 'naive-ui'`，`useMessage` 等 hook 可直接使用

## 开发

```bash
npm install
npm run dev
```

然后在 Chrome 打开 `chrome://extensions/` → 开发者模式 → 加载已解压的扩展 → 选择 `dist` 目录。

### 外部硬盘开发（/Volumes/...）

macOS 对外部盘的原生文件监听不可靠，本项目已做兼容：

- `vite.config.ts` → `watch.usePolling: true`
- `npm run dev` → 环境变量 `CHOKIDAR_USEPOLLING=true`

**推荐流程：**

1. `npm run dev` 启动后，在 `chrome://extensions/` 刷新扩展
2. 打开 Popup → 右键 → 检查，保持 DevTools 开着
3. 改代码保存，终端应出现 `[vite] hmr update`

**若 HMR 仍不稳定**，用备用方案（保存后自动重新构建，手动刷新 Popup 即可）：

```bash
npm run dev:watch
```

**最省心方案**：把项目拷到本机内置盘（如 `~/Projects/RedCopy`）开发，代码用 Git 同步；外部盘只作备份/存档。

## 构建

```bash
npm run build
```
