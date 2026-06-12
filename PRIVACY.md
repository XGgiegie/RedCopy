# 薯薯小抄 隐私政策

**Privacy Policy for ShuShu XiaoChao**

最后更新 / Last updated：2026 年 6 月 12 日

---

## 概述 / Overview

「薯薯小抄」（以下简称「本扩展」/ "the Extension"）是一款浏览器扩展，帮助用户在**主动操作**下提取、分析与仿写小红书（Xiaohongshu）笔记内容，用于个人内容创作与学习参考。

**开发者不运营后端服务器，不远程收集或存储您的个人数据。**

---

## 1. 我们不收集什么 / What We Do NOT Collect

本扩展**不会**：

- 收集姓名、邮箱、手机号、地址等个人身份信息
- 将您的数据上传至开发者自有服务器
- 在后台自动爬取、批量抓取小红书内容
- 记录或上传您的完整浏览历史
- 出售、出租或与第三方共享您的数据用于广告或无关目的
- 使用您的数据评估信用或用于放贷

The Extension does **not** collect PII, upload data to the developer's servers, scrape content automatically, log browsing history, sell user data, or use data for credit/lending purposes.

---

## 2. 本机存储的数据 / Locally Stored Data

以下数据**仅**保存在您浏览器本机的 `chrome.storage.local`：

| 数据 Data | 用途 Purpose |
|-----------|--------------|
| DeepSeek API Key | 用户自愿配置，用于调用 AI 分析 / 生成 |
| AI 模型选择 | 记住您的 AI 设置 |
| 上次提取的笔记 | 侧栏重新打开时恢复预览 |
| 上次 AI 分析结果 | 侧栏重新打开时恢复 |
| 上次类似笔记草稿 | 侧栏重新打开时恢复编辑内容 |

您可通过 **卸载扩展** 或清除浏览器扩展数据删除上述信息。开发者无法远程访问或删除这些数据。

---

## 3. 何时读取页面内容 / When Page Content Is Read

本扩展**仅在您主动点击「执行提取」**时，读取**当前**小红书笔记详情页的公开可见内容：

- 标题、正文、标签
- 作者昵称、点赞/收藏/评论数
- 图片 URL

**不会在您未操作的情况下**自动读取、上传或持续监控页面。

---

## 4. 网络通信 / Network Communication

| 目标 Destination | 触发条件 Trigger | 说明 Note |
|------------------|------------------|-----------|
| `*.xiaohongshu.com` | 用户打开笔记页 / 点击提取 | 读取当前页面内容（本机处理） |
| `*.xhscdn.com` | 用户点击下载图片 | 保存图片到本机 |
| `api.deepseek.com` | 用户点击 AI 分析或生成 | 使用用户自备 API Key，本机直连 |

**除上述外，本扩展不与开发者服务器或无关第三方通信。**

---

## 5. AI 与第三方服务 / AI & Third Parties

- AI 功能需用户自行申请 [DeepSeek](https://platform.deepseek.com/) API Key
- API 费用由用户的 DeepSeek 账户承担
- 发送至 DeepSeek 的内容可能包括：提取的笔记文本、互动数据、用户可选填的推广主题/卖点、以及已有分析结果（生成时）
- DeepSeek 的数据处理受其自身隐私政策约束：[DeepSeek Privacy Policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)

本扩展当前**免费**；未来若推出付费功能，将更新本政策并另行通知。

---

## 6. 权限说明 / Permissions

| 权限 Permission | 用途 Purpose |
|-----------------|--------------|
| `sidePanel` | 显示右侧操作侧栏 |
| `storage` | 本地保存配置与结果 |
| `activeTab` / `scripting` | 用户触发时提取当前笔记 |
| `tabs` / `webNavigation` | 检测是否为笔记详情页 |
| `downloads` | 用户下载笔记图片 |

---

## 7. 数据安全 / Security

- API Key 仅存于本机，扩展代码不向开发者回传
- 建议在私人设备上使用，勿与他人共享已配置 Key 的浏览器配置文件
- 请妥善保管您的 DeepSeek API Key

---

## 8. 儿童隐私 / Children's Privacy

本扩展不面向 13 岁以下儿童，也不会故意收集儿童个人信息。

---

## 9. 政策变更 / Changes

我们可能更新本政策。重大变更将在扩展更新说明或代码仓库中公布。继续使用即表示接受更新后的政策。

---

## 10. 免责声明 / Disclaimer

- 本扩展仅供个人学习、研究与内容创作参考
- 请遵守小红书平台用户协议及适用法律法规
- 用户对提取、生成、发布的内容自行负责

---

## 11. 联系我们 / Contact

隐私相关问题 / Privacy inquiries：

- QQ：`1653444718`
- 交流群 / Group：`870774371`

---

## 12. 数据使用认证 / Data Use Certification

开发者确认：

1. 不会出于与扩展核心功能无关的目的，向第三方出售或传输用户数据  
2. 不会出于与扩展核心功能无关的目的使用或传输用户数据  
3. 不会使用或传输用户数据以确定信用度或用于放贷  

The developer certifies compliance with Chrome Web Store Developer Program Policies regarding user data.
