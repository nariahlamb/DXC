# sillytavern 数据库脚本（分解说明）

## 1. 文件定位

- 文件名：`sillytavern数据库脚本.js`
- 类型：Tampermonkey 用户脚本（主业务脚本，约 2 万行）。
- 角色：数据层 + 业务层 + UI 配置层 + 对外 API 层。

## 2. 总体职责

- 管理表格模板与聊天楼层中的结构化数据。
- 处理自动填表、手动填表、剧情推进、外部导入。
- 同步/注入世界书条目。
- 提供 `AutoCardUpdaterAPI` 给其他脚本（如仪表盘）调用。

## 3. 核心架构分层

### 3.1 UI 窗口系统（前段）

- 自建浮窗体系，不依赖酒馆默认弹窗。
- 功能：拖拽、缩放、最大化、状态记忆、窄屏适配。
- 代表函数：
  - `createACUWindow`
  - `closeACUWindow`
  - `saveWindowState_ACU`

### 3.2 配置存储层

- 存储优先级：SillyTavern settings -> IndexedDB 回退。
- 显式禁用浏览器 `localStorage` 作为主配置持久化（仅迁移旧数据可选）。
- 关键函数：
  - `initTavernSettingsBridge_ACU`
  - `getConfigStorage_ACU`
  - `configIdbSetCached_ACU`

### 3.3 Profile 与隔离机制

- 通过 `UNIQUE_SCRIPT_ID` + `isolation code` 实现多档案隔离。
- 每个隔离档案有独立 settings/template。
- 关键函数：
  - `normalizeIsolationCode_ACU`
  - `switchIsolationProfile_ACU`
  - `ensureProfileExists_ACU`

### 3.4 模板与预设系统

- 内置默认模板 `DEFAULT_TABLE_TEMPLATE_ACU`。
- 支持模板预设库（保存、重命名、删除、切换）。
- 关键函数：
  - `loadTemplatePresetsStore_ACU`
  - `applyTemplatePresetToCurrent_ACU`
  - `renderTemplatePresetSelect_ACU`

### 3.5 剧情推进与循环系统

- 有独立 `plotSettings` 与回环 `loopSettings`。
- 区分“用户真实发送”与后台 quiet 生成，防误触。
- 关键函数：
  - `shouldProcessPlotForGeneration_ACU`
  - `startAutoLoop_ACU`
  - `onLoopGenerationEnded_ACU`

### 3.6 填表引擎与 AI 交互

- 负责组装上下文、请求模型、解析命令、更新表格。
- 关键函数：
  - `prepareAIInput_ACU`
  - `callCustomOpenAI_ACU`
  - `parseAndApplyTableEdits_ACU`
  - `processUpdates_ACU`
  - `proceedWithCardUpdate_ACU`

### 3.7 世界书同步与导入

- 支持总结表/大纲/人物等条目注入世界书。
- 支持 TXT 外部导入、分块、断点续行、清理。
- 关键函数：
  - `updateSummaryTableEntries_ACU`
  - `updateOutlineTableEntry_ACU`
  - `processImportedTxtAsUpdates_ACU`

### 3.8 数据可视化编辑器

- 内置 `openNewVisualizer_ACU` 打开可视化编辑器。
- 可调整表结构、顺序、导出配置等。

## 4. 对外 API（重点）

脚本会暴露 `AutoCardUpdaterAPI`，典型能力包括：

- 打开设置与可视化器
- 手动触发更新/世界书同步
- 模板导入导出/重置
- 预设管理（模板预设、剧情预设）
- 表锁（行/列/单元格）
- 注册回调：
  - `registerTableUpdateCallback`
  - `registerTableFillStartCallback`

## 5. 事件链（SillyTavern）

监听关键事件：

- `CHAT_CHANGED`
- `MESSAGE_SENT`
- `GENERATION_STARTED`
- `GENERATION_AFTER_COMMANDS`
- `GENERATION_ENDED`

用途：

- 识别是否应触发剧情推进
- 识别是否应触发自动填表
- 在生成结束后落表与刷新状态

## 6. 关键可配置项

- `UNIQUE_SCRIPT_ID`：多副本隔离的核心开关。
- `FORBID_BROWSER_LOCAL_STORAGE_FOR_CONFIG_ACU`：是否禁用本地存储。
- `USE_TAVERN_SETTINGS_STORAGE_ACU`：是否优先酒馆设置存储。
- 自动填表阈值、频率、批量大小、并发数等配置项在设置 UI 可调。

## 7. 与其他文件的关系

- `DND仪表盘配套模板.json`：数据契约来源之一。
- `数据库默认索引召回预设.json` / `战斗推进v1-1.json`：剧情推进预设输入。
- `酒馆助手脚本-DND沉浸式仪表盘 v1.9.0.json`：消费本脚本 API 的前端展示层。

## 8. 建议阅读顺序

1. 常量区（ID、存储键、默认配置）。
2. 存储桥接与 profile 隔离。
3. `AutoCardUpdaterAPI` 暴露对象。
4. 事件监听与主初始化流程。
5. 填表引擎与世界书同步。

