# DXC - DanMachi AI冒险系统

> **沉浸式AI文本冒险 · 基于《在地下城寻求邂逅是否搞错了什么》世界观**

DXC 是一款完全由 AI 驱动的文本冒险游戏系统，以《地错》世界为舞台，通过严格的"叙事/指令分离"JSON 协议，实现一致且可追溯的剧情与状态更新。

---

## 🆕 本次更新（2026-02-06）

- **Issue 闭环执行完成**：完成 `DSC-20260206-134100` 发现问题的 8 条 issue（从计划、绑定到执行完成）。
- **记忆系统表格化**：移除旧短中长期记忆链路，统一改为 `LOG_Summary/LOG_Outline` 表格写入与检索。
- **核心流程容错增强**：`hooks/useGameLogic.ts` 增加 world update Promise reject 的保护处理，并补充自动存档依赖字段（`gameState.角色.等级`）。
- **类型安全改进**：`components/CharacterCreation.tsx` 移除 `@ts-ignore` 与 `as any`，减少隐式类型绕过。
- **测试补齐**：新增/增强 `tests/useGameLogic.legacy-save.test.tsx`、`components/game/modals/SettingsModal.test.tsx`。
- **验证结果**：`npm test -- tests/useGameLogic.legacy-save.test.tsx`、`npm test -- components/game/modals/SettingsModal.test.tsx`、`npm run build` 均通过（构建存在 chunk size 提示，不影响产物生成）。

### 🔧 增量修复（本会话）
- **3AI 硬合并完成**：运行时只保留 `story/state/map` 三入口。删除 unified/override 与 legacy path 执行通道，不再提供隐藏或关闭旧模式的入口。
- **弹窗遮挡修复**：统一提升通用弹窗层级，避免右侧模块打开后被顶部栏遮罩遮挡（`components/ui/ModalWrapper.tsx`）。
- **在场状态兼容**：补齐 `是否在场` 与 `当前状态` 的双向兼容与归一化，修复“对话 NPC 不显示在周围的人”问题（`hooks/gameLogic/state.ts`、`hooks/useGameLogic.ts`、`components/game/modals/social/ContactsView.tsx`）。
- **社交指令放行策略**：微服务模式下保留必要社交白名单（新增 NPC、在场/位置字段），避免主叙事新增 NPC 被错误过滤（`hooks/useGameLogic.ts`）。
- **首轮角色 IP 补全**：新增首轮自动补全能力，优先通过当前 AI 服务提取著名 IP 的服装/常用物品/武器，并回填角色与背包（`utils/ipCharacterEnrichment.ts`）。
- **流式 DONE 容错**：主叙事 JSON 请求增加 `data: [DONE]` 空响应兜底重试，减少“只出系统日志、正文丢失”的异常（`utils/aiGenerate.ts`）。

---

## ✨ 核心特性

### 🎭 叙事与指令严格分离
- **logs（日志）**：纯叙事内容，记录剧情与对白
- **tavern_commands（指令）**：纯状态更新，确保数据一致性
- 两者分离保证了剧情流畅性与游戏状态的可靠性

### 🧠 多段思考链
- 支持 `thinking_pre`（决策前思考）和 `think_post`（决策后反思）
- AI 先思考，再生成叙事与指令，确保逻辑连贯

### 📦 模块化提示词体系
```
prompts/
├── system.ts      # 系统身份与核心规则
├── world_values.ts # 世界观与背景设定
├── logic.ts       # 判定规则与战斗机制
├── story.ts       # 写作风格与叙事准则
├── commands.ts    # 指令示例库
└── schema.ts      # 数据结构定义
```
分模块管理，易于维护与扩展

### ⚔️ 战斗与结算闭环
- **战斗面板**：实时显示敌我状态、回合顺序、位置信息
- **战斗地图**：支持网格定位（1格=5尺）与单位管理
- **掉落结算**：自动生成战利品并归档
- **骰池系统**：支持 DND5E 风格骰子机制

### 💭 记忆系统
- **表格写入**：记忆统一通过 `append_log_summary` / `append_log_outline` 写入 TavernDB 表。
- **表格检索**：叙事与手机上下文优先从 `LOG_Summary/LOG_Outline` 召回。
- **一致性约束**：记忆写入与 `tavern_commands` 同步，避免叙事与状态分叉。

### 🤖 3AI 职责边界（triad-only）
- **story（主叙事）**：仅输出 `logs` 与 `action_options`，必须返回空 `tavern_commands`。
- **state（填表召回）**：负责叙事后批次并发填表，以及叙事前 AM 索引召回相关状态写入。
- **map（地图生成）**：仅负责地图命令（`upsert_exploration_map` / `set_map_visuals` / `upsert_battle_map_rows`）。
- 非 `story/map` 服务键在运行时统一路由到 `state`，不存在 unified 或 legacy-memory 回退。

### 📱 手机系统
- **对话**：与 NPC 短信互动
- **朋友圈**：查看 NPC 动态
- **公共频道**：世界新闻与传闻
- **论坛**：冒险者社区讨论

### 📝 新增功能
- **情报笔记**：可搜索、标签分类、重要标记
- **日志筛选**：按类型、时间、关键词筛选
- **战术摘要**：右侧面板显示关键信息

---

## 🚀 快速开始

### 环境要求
- Node.js 16+
- Google Gemini API Key（或兼容的 AI 服务）

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/DXC.git
   cd DXC
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置 API**
   - 创建 `.env.local` 文件
   - 添加 `VITE_GEMINI_API_KEY=你的API密钥`
   - 或在游戏内设置面板配置其他模型

4. **启动开发服务**
   ```bash
   npm run dev
   ```

5. **访问游戏**
   - 打开浏览器访问 `http://localhost:5173`
   - 创建角色并开始冒险！

---

## 📁 项目结构

```
DXC/
├── components/          # UI 组件
│   ├── game/           # 游戏界面
│   │   ├── modals/    # 弹窗（背包、状态、眷族等）
│   │   ├── CenterPanel.tsx    # 主游戏面板
│   │   └── CombatPanel.tsx    # 战斗界面
│   └── ui/             # 通用 UI 组件
├── prompts/            # AI 提示词模块 ⚠️
│   ├── index.ts       # 提示词聚合器
│   ├── system.ts      # 核心规则
│   ├── world_values.ts # 世界观
│   ├── logic.ts       # 判定逻辑
│   ├── story.ts       # 写作准则
│   ├── commands.ts    # 指令示例
│   └── schema.ts      # 数据结构
├── hooks/              # 游戏逻辑
│   ├── useGameLogic.ts         # 核心状态管理
│   └── gameLogic/             # 扩展指令处理
│       └── extendedCommands.ts
├── types/              # TypeScript 类型定义
│   ├── gamestate.ts   # 游戏状态
│   ├── combat.ts      # 战斗系统
│   ├── item.ts        # 物品系统
│   ├── social.ts      # NPC 与社交
│   └── extended.ts    # TavernDB 扩展
├── utils/              # 工具函数
│   ├── ai.ts          # AI 服务集成
│   ├── contracts.ts   # Zod 数据验证
│   └── dataMapper.ts  # 数据映射
└── public/             # 静态资源
```

### 关键文件说明
- **prompts/** ⚠️ 修改这里会直接影响 AI 行为！
- **types/** 定义游戏状态结构，需与 prompts/schema.ts 保持一致
- **hooks/useGameLogic.ts** 核心状态管理与指令路由
- **components/game/** 所有游戏界面组件

---

## 🎮 游戏机制

### 角色成长
- **恩惠系统**：力量、耐久、灵巧、敏捷、魔力五维属性
- **技能觉醒**：通过战斗与事件触发
- **魔法习得**：需要魔法栏位与咏唱
- **发展能力**：升级时解锁特殊能力

### 战斗系统
- **回合制**：按先攻顺序行动
- **位置系统**：支持移动与距离判定
- **骰池机制**：支持 d20 检定与伤害骰
- **状态效果**：Buff/Debuff 管理

### 经济系统
- **法利（货币）**：购买装备与道具
- **战利品**：战斗掉落自动归档
- **商店系统**：购买、出售、修理

### 社交系统
- **好感度**：影响剧情分支
- **互动记忆**：每次交互自动记录
- **手机联络**：短信、朋友圈、论坛

---

## 🛠️ 开发指南

### 修改游戏规则
1. 编辑 `prompts/logic.ts` 修改判定规则
2. 编辑 `prompts/world_values.ts` 修改世界观
3. 刷新页面使更改生效

### 添加新物品/NPC
1. 在游戏内直接通过 AI 生成
2. 或编辑 `prompts/world_values.ts` 预设

### 扩展指令系统
1. 在 `types/extended.ts` 添加新类型
2. 在 `utils/contracts.ts` 添加 Zod 验证
3. 在 `hooks/gameLogic/extendedCommands.ts` 实现处理逻辑
4. 在 `prompts/commands.ts` 添加示例
5. 在 `prompts/schema.ts` 更新数据结构文档

### 测试与调试
- **类型检查**：`npx tsc --noEmit`
- **构建检查**：`npm run build`
- **查看AI提示词**：游戏内设置 → Schema Docs

---

## ⚠️ 协议约束

### 叙事/指令分离原则
- ✅ **正确**：叙事描述敌人倒下，指令删除敌人状态
- ❌ **错误**：叙事中嵌入状态变化说明

### 指令格式要求
所有状态更新必须通过 `tavern_commands` JSON 数组：
```json
{
  "logs": ["叙事内容..."],
  "tavern_commands": [
    {
      "action": "upsert_sheet_rows",
      "value": {
        "sheetId": "SYS_GlobalState",
        "rows": [{ "id": "global", "当前地点": "巴别塔入口" }]
      }
    }
  ]
}
```

### 可选字段约定
- 所有 TavernDB 扩展字段均为**可选**（带 `?` 标记）
- 不会破坏现有存档兼容性
- 老存档加载时自动补全缺失字段

---

## 📚 更多资源

- **开发文档**：见根目录 `DEVREADME.md`
- **架构文档**：见各模块目录下的 `CLAUDE.md`
- **参考方法论**：见 `docs/ref/METHODOLOGY_EXTRACTION.md`
- **问题反馈**：提交 GitHub Issue

---

## 📜 许可证

MIT License

---

## 🙏 致谢

- 基于《在地下城寻求邂逅是否搞错了什么》世界观
- AI 驱动：Google Gemini / OpenAI / Anthropic Claude
- UI 框架：React 19 + Vite + Tailwind CSS 4
- 类型安全：TypeScript + Zod

---

**开始你的欧拉丽冒险吧！** 🗡️⚔️🛡️
