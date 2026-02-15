# 📋 实施计划：战斗地图/视觉数据缺失修复

## 任务类型
- [ ] 前端 (→ Gemini)
- [ ] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 技术方案
通过“诊断 + 兼容层 + 规范统一”的组合方案修复战斗地图/视觉数据缺失：
1) 在命令处理层增加最小化诊断日志，确认 set_map_visuals / upsert_battle_map_rows 是否到达并为何失败。
2) 为 set_map_visuals 增加兼容映射（支持旧版 VisualJSON.dimensions 结构），避免 MapVisualsSchema 校验失败。
3) 统一 prompts/commands 与 aiGenerate 的地图视觉结构为 MapVisualsSchema（地图尺寸.宽度/高度）。
4) 检查微服务过滤逻辑是否误丢战斗地图指令。
5) 完整回归验证战斗进入流程与 UI 渲染。

## 实施步骤

### 1) 诊断链路（入口确认）
**目标**：确认 set_map_visuals / upsert_battle_map_rows 是否进入 processTavernCommands，以及是否被过滤/校验失败。

- 文件：`hooks/useGameLogic.ts`
- 位置：`processTavernCommands()` 与 microservice 过滤逻辑
- 伪代码：
```ts
for (cmd of tavern_commands) {
  const action = normalizeAction(cmd);
  if (['set_map_visuals','upsert_battle_map_rows'].includes(action)) {
    log('map_cmd_received', { action, key: cmd.key, valueKeys: Object.keys(cmd.value ?? {}) });
  }
  const result = dispatch(action, cmd.value);
  if (!result.success) log('map_cmd_rejected', { action, error: result.error });
}
```

### 2) 兼容层：set_map_visuals 结构映射
**目标**：兼容 `VisualJSON.dimensions.width/height` → `地图尺寸.宽度/高度`，避免 schema 验证失败。

- 文件：`hooks/gameLogic/extendedCommands.ts`
- 伪代码：
```ts
function normalizeMapVisuals(raw) {
  if (raw?.地图尺寸) return raw;
  if (raw?.VisualJSON?.dimensions) {
    return {
      地图尺寸: {
        宽度: raw.VisualJSON.dimensions.width,
        高度: raw.VisualJSON.dimensions.height
      },
      地形描述: raw.VisualJSON.ground ?? raw.SceneName ?? raw.VisualJSON.mapName,
      特殊区域: (raw.VisualJSON.terrain_objects ?? []).map(o => ({
        名称: o.type,
        位置: { x: o.x, y: o.y },
        范围: Math.max(o.w ?? 1, o.h ?? 1),
        效果: o.color
      }))
    };
  }
  return raw;
}

const normalized = normalizeMapVisuals(value);
validateSchema(MapVisualsSchema, normalized);
```

### 3) 统一 Prompt Contract
**目标**：消除 prompts/commands 与 aiGenerate 中 set_map_visuals 格式不一致问题。

- 文件：
  - `prompts/commands.ts`
  - `prompts/logic.ts`
  - `utils/aiGenerate.ts`
- 规范目标示例：
```json
{"action":"set_map_visuals","key":"gameState.战斗.视觉","value":{"地图尺寸":{"宽度":20,"高度":15},"地形描述":"..."}}
```

### 4) 微服务过滤检查
**目标**：确认 world service / other service 过滤逻辑不会丢弃地图指令。

- 文件：`hooks/useGameLogic.ts`
- 检查点：serviceKey 过滤规则是否依赖 cmd.key 字段，而 set_map_visuals/upsert_battle_map_rows 可能无 key。
- 伪代码：
```ts
const allowlist = new Set(['set_map_visuals','upsert_battle_map_rows']);
if (serviceKey === 'world' && allowlist.has(action)) bypassKeyFilter();
```

### 5) 验证与回归
**目标**：确认战斗进入后战术地图可见，且无警告提示。

- 手动流程：
  1. 进入战斗 → 检查 BattleStage 是否显示战术地图
  2. CombatPanel 不再显示“地图数据缺失”提示
  3. BattleTimeline 显示先攻

- 命令：
  - `npx tsc --noEmit`
  - `npm run build`

### 6)（可选）单测/日志固化
- 为 MapVisuals 兼容映射添加最小单测或日志断言，防止回归。

## 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| hooks/useGameLogic.ts | 修改 | 诊断日志 + 过滤逻辑校验 |
| hooks/gameLogic/extendedCommands.ts | 修改 | set_map_visuals 兼容映射 |
| prompts/commands.ts | 修改 | 统一 set_map_visuals 示例 |
| prompts/logic.ts | 修改 | 强化战斗开始必需输出规范 |
| utils/aiGenerate.ts | 修改 | MAP_SCHEMA_INSTRUCTION 规范对齐 |

## 风险与缓解
| 风险 | 缓解措施 |
|------|----------|
| AI 输出结构仍不一致 | 增加兼容映射 + 强制 prompt 示例 |
| 微服务过滤丢命令 | 添加 allowlist 或 bypass 规则 |
| 坐标越界导致 upsert 失败 | 在日志中明确提示并要求 AI 修正 |

## SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019c3582-39f4-76d1-ad2b-7e13719d4eda
- GEMINI_SESSION: 034a8bbd-b409-4fad-bbbd-3896fae65b8c
