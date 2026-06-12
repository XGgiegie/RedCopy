# 薯薯小抄

小红书笔记提取与 AI 解析浏览器扩展。一键复制 Markdown，AI 分析笔记，生成可编辑的类似笔记。

**交流反馈**：QQ `1653444718` · 群 `870774371`

---

## 功能一览

- 提取小红书笔记标题、正文、标签、图片、互动数据
- 复制 Markdown / 正文 / 图片链接
- 批量或单张下载笔记图片
- AI 分析笔记结构与传播逻辑
- 生成类似笔记（可填推广主题，支持编辑）
- 视频笔记支持文案提取（AI 文本分析）

---

## 用户文档

| 文档 | 说明 |
|------|------|
| [用户使用说明](docs/用户使用说明.md) | 安装、配置、功能与常见问题 |
| [Chrome 商店上架说明](docs/Chrome商店上架说明.md) | 商店文案、权限说明、上架清单 |
| [隐私政策](PRIVACY.md) | 隐私权政策（商店必填） |

---

## 安装与打包

### 用户手动安装

```bash
npm run package
```

在 `chrome://extensions` 开启开发者模式，加载 `dist` 目录；或分发 `薯薯小抄-v1.0.0.zip`。

### 开发者

```bash
npm install
npm run dev          # 开发模式
npm run build        # 仅构建
npm run icons        # 重新生成图标
npm run package      # 图标 + 构建 + 打 zip 包
```

---

## 技术栈

- Vue 3 + TypeScript + Vite + CRXJS
- [Naive UI](https://www.naiveui.com/) + [vfonts](https://www.npmjs.com/package/vfonts)
- DeepSeek API（用户自备 Key）

## 项目结构

```
manifest.config.ts      # 扩展配置
src/popup/              # 侧栏主界面
src/background/         # 后台脚本
src/shared/             # 提取、AI、存储、导出
public/icons/           # 扩展图标（红底白字「抄」）
docs/                   # 用户与上架说明
```

---

## 开发说明

### 本地加载

`npm run dev` 后，在 `chrome://extensions/` 加载 `dist` 目录。

### 外部硬盘开发

macOS 对外部盘文件监听不可靠，已启用 `CHOKIDAR_USEPOLLING`。若 HMR 不稳定，使用：

```bash
npm run dev:watch
```

### Naive UI

- 主题色：`#ff2442`
- 中文 locale 已在 `NConfigProvider` 中启用
