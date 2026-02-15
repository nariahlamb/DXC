# 酒馆助手脚本 - DND 沉浸式仪表盘 v1.9.0（分解说明）

## 1. 文件定位

- 文件类型：脚本导出 JSON（不是源码工程）。
- 顶层结构：
  - `type`: `script`
  - `enabled`: 是否启用
  - `name`: 脚本名称
  - `id`: 脚本唯一 ID
  - `content`: 真正脚本内容（长度约 80 万字符，已压缩）
  - `info`: 使用说明（依赖数据库插件、配套模板、版本要求）
  - `button`: 脚本按钮配置
  - `data`: 额外数据（当前为空对象）

## 2. 核心用途

- 提供 DND 风格 UI 仪表盘（HUD、角色卡、面板、弹窗）。
- 读取并可视化数据库脚本中的表格数据。
- 管理骰子池、快捷动作、法术/技能快捷入口。
- 与 SillyTavern 设置进行同步，支持离线队列补偿同步。

## 3. `content` 脚本内模块拆解

### 3.1 日志模块

- 暴露：`window.DND_Dashboard_Logger`。
- 支持 `error/warn/info/debug/diagnose` 分级日志。
- `diagnose()` 用于快速检查 jQuery、AutoCardUpdaterAPI、iframe 环境等。

### 3.2 本地存储模块（IndexedDB）

- 数据库名：`DND_Immersive_DB`。
- 主要 store：
  - `avatars`
  - `settings`
  - `svg_maps`
- 支持迁移旧 `localStorage` 的 `dnd_` 前缀数据。

### 3.3 酒馆设置同步模块（TavernSettingsSync）

- 核心作用：本地设置与 SillyTavern `extensionSettings` 双向兜底。
- 有同步队列：离线先入队，恢复连接后批量回放。
- 状态能力：`connected / pendingSync / statusText`。

### 3.4 常量与主题系统

- 常量域：
  - `STORAGE_KEYS`
  - `DICE_POOL`
  - `UI_SCALE`
  - `MAP_ZOOM`
  - `DYNAMIC_BG`
  - `PRESET_SWITCHING`
- 主题：`THEMES` 内置多个视觉方案（如暗黑、森林、奥术等）。

### 3.5 UI 渲染器模块

- 暴露：`window.DND_Dashboard_UI`。
- 可见功能（从符号和调用可确认）：
  - HUD 渲染
  - 快速骰子弹窗（`showQuickDice/rollDice/rollCustomDice`）
  - 快捷栏（`renderQuickBar/executeQuickSlot`）
  - 快捷项选择器（物品/技能/法术）
  - 动态背景更新（`updateDynamicBackground`）

### 3.6 与数据库脚本的耦合

- 依赖 `window.AutoCardUpdaterAPI`（由数据库脚本提供）。
- 会调用：
  - `exportTableAsJson`
  - `registerTableUpdateCallback`
- 说明：仪表盘是“前端可视层”，数据库脚本是“数据与业务层”。

## 4. 初始化流程（简化）

1. 等待 `jQuery` 与 `body` 可用。
2. 注入样式。
3. 初始化 UI 与 HUD。
4. 初始化本地存储和同步模块。
5. 连接 `AutoCardUpdaterAPI`，注册数据更新回调。

## 5. 依赖与使用注意

- 强依赖：数据库脚本（`sillytavern数据库脚本.js` 提供 API）。
- 强依赖：配套模板（`DND仪表盘配套模板.json` 的表结构）。
- 版本提示：`info` 中写明预设切换需要数据库版本 `10.8+`。
- 当前文件 `content` 为压缩代码，建议仅作为“发布包”存档，不适合作为主开发源码。

