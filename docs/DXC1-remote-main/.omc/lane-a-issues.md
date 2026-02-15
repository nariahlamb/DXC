# Lane A - State/Data Consistency Issues

**Date**: 2026-02-05
**Plan**: docs/TASK_PLAN_DEBUGGING.md
**Lane**: A - 状态/数据一致性

---

## Task 2: GameState ↔ Schema Alignment Matrix

### Analysis Summary

Compared the following sources:
- `types/gamestate.ts` (TS interfaces)
- `types/extended.ts` (TavernDB extension types)
- `utils/contracts.ts` (Zod schemas)
- `prompts/schema.ts` (AI instruction schema - P_DATA_STRUCT)
- `components/game/modals/schemaDocs.ts` (UI schema documentation)

### Core GameState Fields (types/gamestate.ts)

| Field | Type | Notes |
|-------|------|-------|
| 当前界面 | Screen | ✓ |
| 游戏难度 | Difficulty | ✓ |
| 处理中 | boolean | ✓ |
| 角色 | CharacterStats | ✓ |
| 背包 | InventoryItem[] | ✓ |
| 日志 | LogEntry[] | ✓ |
| 游戏时间 | string | ✓ |
| 当前日期 | string | ✓ |
| 当前地点 | string | ✓ |
| 当前楼层 | number | ✓ |
| 天气 | string | ✓ |
| 世界坐标 | GeoPoint | ✓ |
| 战利品 | InventoryItem[] | ✓ |
| 公共战利品 | InventoryItem[] | ✓ |
| 战利品背负者 | string | ✓ |
| 社交 | Confidant[] | ✓ |
| 手机 | PhoneState | ✓ |
| 世界 | WorldState | ✓ |
| 地图 | WorldMapData | ✓ |
| 任务 | Task[] | ✓ |
| 技能 | Skill[] | ✓ |
| 剧情 | StoryState | ✓ |
| 契约 | Contract[] | ✓ |
| 眷族 | FamiliaState | ✓ |
| 笔记 | NoteEntry[] | ✓ |
| 记忆 | MemorySystem | ✓ |
| 战斗 | CombatState | ✓ |
| 回合数 | number | ✓ |
| 系统设置 | SystemSettings (optional) | ✓ |

### TavernDB Extension Fields (types/gamestate.ts optional)

| Field | Type | Schema Exists | Notes |
|-------|------|---------------|-------|
| 遭遇 | EncounterRow[] | ✓ EncounterRowSchema | Optional |
| 骰池 | DicePool | ✓ DicePoolSchema | Optional |
| 可选行动列表 | ActionOptions | ✓ ActionOptionsSchema | Optional |
| 日志摘要 | LogSummary[] | ✓ LogSummarySchema | Optional |
| 日志大纲 | LogOutline[] | ✓ LogOutlineSchema | Optional |
| 势力 | Faction[] | ✓ FactionSchema | Optional |
| 增强任务 | QuestEnhanced[] | ✓ QuestSchema | Optional |
| 场景描述 | string | ❌ No Zod schema | Optional, P_DATA_STRUCT only |
| 上轮时间 | string | ❌ No Zod schema | Optional, P_DATA_STRUCT only |
| 流逝时长 | string | ❌ No Zod schema | Optional, P_DATA_STRUCT only |
| 战斗模式 | string enum | ❌ No Zod schema | Optional, P_DATA_STRUCT only |
| 系统通知 | string | ❌ No Zod schema | Optional, P_DATA_STRUCT only |

### CombatState Sub-fields (types/combat.ts)

| Field | Type | Schema Exists | Notes |
|-------|------|---------------|-------|
| 是否战斗中 | boolean | ❌ No top-level schema | Core field |
| 敌方 | Enemy[] \| null | ❌ No Enemy schema | Core field |
| 战斗记录 | string[] | ❌ No schema | Core field |
| 上一次行动 | string (optional) | ❌ No schema | Core field |
| 地图 | BattleMapRow[] | ✓ BattleMapRowSchema | TavernDB extension |
| 视觉 | MapVisuals | ✓ MapVisualsSchema | TavernDB extension |

### INCONSISTENCIES FOUND

#### Issue A-001: Missing Zod Schemas for Global State Extensions
**Severity**: P1 (Logic error/state pollution)
**Symptom**: TavernDB global state extensions (场景描述, 上轮时间, 流逝时长, 战斗模式, 系统通知) documented in P_DATA_STRUCT but have no Zod validation schemas in contracts.ts.
**Repro Steps**:
1. AI generates command with `{"action": "set", "key": "场景描述", "value": "..."}`.
2. Command bypasses Zod validation (no schema exists).
3. Value may be malformed but is accepted silently.

**Expected**: All documented fields in P_DATA_STRUCT should have corresponding Zod schemas.
**Actual**: 5 global state extension fields lack Zod schemas.
**Suspected Files**: utils/contracts.ts, hooks/gameLogic/extendedCommands.ts
**Regression Check**: Add validation for these fields, verify AI commands are validated properly.

---

#### Issue A-002: Missing Zod Schema for Enemy Type
**Severity**: P1 (Logic error/state pollution)
**Symptom**: `CombatState.敌方` uses Enemy[] type but no EnemySchema exists in contracts.ts.
**Repro Steps**:
1. AI generates enemy data in tavern_commands.
2. Enemy fields are set without validation.
3. Missing required fields (名称, 描述) may cause runtime errors.

**Expected**: Enemy type should have a Zod schema for validation.
**Actual**: No EnemySchema in contracts.ts.
**Suspected Files**: utils/contracts.ts, types/combat.ts
**Regression Check**: Create EnemySchema, validate enemy updates.

---

#### Issue A-003: Inconsistent Field Naming (CN vs EN Aliases)
**Severity**: P2 (Minor logic deviation)
**Symptom**: P_DATA_STRUCT (prompts/schema.ts) uses only Chinese keys, but schemaDocs.ts mixes Chinese keys with English descriptions. Some TS types use both (e.g., Enemy has both `生命值` and `当前生命值`).
**Repro Steps**:
1. Review Enemy interface in types/combat.ts.
2. Note: `生命值`, `当前生命值`, `最大生命值`, `精神力`, `当前精神MP` all coexist.
3. AI might use either naming convention, causing ambiguity.

**Expected**: Consistent naming convention across all schemas.
**Actual**: Mixed Chinese/English and duplicate fields (old vs new naming).
**Suspected Files**: types/combat.ts, prompts/schema.ts
**Regression Check**: Standardize Enemy fields, remove deprecated aliases.

---

#### Issue A-004: BattleMapRowUpsertSchema Uses Partial but No Validation Strategy
**Severity**: P1 (Logic error/state pollution)
**Symptom**: BattleMapRowUpsertSchema in contracts.ts uses `.partial()` for all fields except UNIT_ID, but merge logic in extendedCommands.ts uses spread operator without field-level validation.
**Repro Steps**:
1. AI sends partial BattleMapRow update: `{"UNIT_ID": "U001", "位置": {"x": 5}}`.
2. Missing `y` coordinate in 位置.
3. Merge spreads partial data: `{...existing, ...newRow}`.
4. 位置 becomes `{x: 5}` (missing y).

**Expected**: Partial updates should validate nested object completeness or use deep merge.
**Actual**: Shallow spread may create invalid nested objects.
**Suspected Files**: hooks/gameLogic/extendedCommands.ts (line 70), utils/contracts.ts
**Regression Check**: Test partial BattleMapRow updates with incomplete nested objects.

---

## Task 3: TavernDB Extension Field Validation

### Analysis Summary

Reviewed extended command handlers in `hooks/gameLogic/extendedCommands.ts` and their Zod schemas in `utils/contracts.ts`.

### Schema Validation Coverage

| Handler | Schema Used | validateSchema Called | Merge Strategy |
|---------|-------------|----------------------|----------------|
| handleSetEncounterRows | EncounterRowSchema | ✓ (line 28) | Full replace (line 36) |
| handleUpsertBattleMapRows | BattleMapRowUpsertSchema | ✓ (line 48) | By UNIT_ID merge (line 64-74) |
| handleSetMapVisuals | MapVisualsSchema | ✓ (line 84) | Full replace (line 91) |
| handleConsumeDiceRows | ❌ No schema | ❌ Payload parsing only | Filter by ID/count (line 108-116) |
| handleAppendLogSummary | LogSummarySchema | ✓ (line 133) | Push append (line 144) |
| handleAppendLogOutline | LogOutlineSchema | ✓ (line 152) | Push append (line 163) |
| handleSetActionOptions | ActionOptionSchema | ✓ (line 182) | Full replace (line 190) |
| handleUpsertNPC | NPCTavernDBSchema | ✓ (line 202) | By id merge (line 217-231) |
| handleUpsertInventory | InventoryItemTavernDBSchema | ✓ (line 245) | By id/名称 merge (line 259-278) |

### INCONSISTENCIES FOUND

#### Issue A-005: handleConsumeDiceRows Missing Validation
**Severity**: P1 (Logic error/state pollution)
**Symptom**: `handleConsumeDiceRows` accepts payload `{ids: string[]}` or `{count: number}` but does not validate input structure with Zod schema.
**Repro Steps**:
1. AI sends malformed payload: `{"action": "consume_dice_rows", "value": {"count": "five"}}`.
2. Line 113 checks `typeof payload?.count === 'number'` → false.
3. Line 118 returns error: "consume_dice_rows requires ids array or count number".
4. No schema validation ensures payload structure is correct.

**Expected**: Payload structure validated with Zod schema before processing.
**Actual**: Manual type checks only; malformed payloads not caught early.
**Suspected Files**: hooks/gameLogic/extendedCommands.ts (line 95-127), utils/contracts.ts
**Regression Check**: Create ConsumeDicePayloadSchema, test malformed inputs.

---

#### Issue A-006: upsert_npc Default Values May Overwrite Existing Data
**Severity**: P1 (Logic error/state pollution)
**Symptom**: When creating new NPC in `handleUpsertNPC` (line 221-230), default values are applied BEFORE spread of `npc` data. If `npc` has partial data, defaults may be overwritten incorrectly.
**Repro Steps**:
1. AI sends: `{"action": "upsert_npc", "value": [{"id": "Char001", "姓名": "Bell"}]}`.
2. Line 221-229: `newConfidant = { 记忆: [], 好感度: 0, 关系状态: '普通', ...npc }`.
3. Default `关系状态: '普通'` is set.
4. If AI intended to keep existing `关系状态`, it's overwritten.

**Expected**: Defaults should be applied only for truly missing fields (use logical OR or schema defaults).
**Actual**: Object spread order may unintentionally overwrite AI-intended values.
**Suspected Files**: hooks/gameLogic/extendedCommands.ts (line 221-230)
**Regression Check**: Test NPC upsert with partial data, verify existing fields not overwritten.

---

#### Issue A-007: upsert_inventory Merge by 名称 Has No Conflict Resolution
**Severity**: P1 (Logic error/state pollution)
**Symptom**: When `item.id` is missing, `handleUpsertInventory` merges by `名称` (line 264). If multiple items have same `名称` but different attributes (e.g., different `品质`), only the first match is updated.
**Repro Steps**:
1. Inventory has: `[{名称: "短剑", 品质: "Common"}, {名称: "短剑", 品质: "Rare"}]`.
2. AI sends: `{"action": "upsert_inventory", "value": [{"名称": "短剑", "数量": 5}]}`.
3. Line 264: `findIndex(existing => existing.名称 === item.名称)` → matches first item.
4. First "短剑" (Common) gets updated to 数量: 5.
5. Second "短剑" (Rare) is untouched.

**Expected**: Merge by unique identifier (id) or use composite key (名称 + 品质).
**Actual**: Merge by 名称 alone causes ambiguity with stacked items of different qualities.
**Suspected Files**: hooks/gameLogic/extendedCommands.ts (line 259-278), utils/itemUtils.ts
**Regression Check**: Test inventory upsert with duplicate 名称 but different 品质.

---

#### Issue A-008: Validation Errors Only Logged as Warnings
**Severity**: P2 (Minor logic deviation)
**Symptom**: All extended command handlers log validation errors with `console.warn` but return `{success: false, error: ...}`. Errors are not propagated to UI or game logs, making debugging difficult.
**Repro Steps**:
1. AI sends invalid EncounterRow: `{"action": "set_encounter_rows", "value": [{"名称": "测试", "类型": "INVALID"}]}`.
2. Line 32 logs: `console.warn('set_encounter_rows validation errors: ...')`.
3. Line 33 returns error, but no LogEntry is created.
4. User sees no feedback about validation failure.

**Expected**: Validation errors should create system LogEntry for visibility.
**Actual**: Errors only logged to console, invisible to user.
**Suspected Files**: hooks/gameLogic/extendedCommands.ts (all handlers)
**Regression Check**: Trigger validation errors, verify system log entries are created.

---

## Task 4: updateStateByPath Path Normalization

### Analysis Summary

Reviewed `updateStateByPath` function in `hooks/useGameLogic.ts` (lines 347-389).

### Path Normalization Rules

| Input Pattern | Normalized To | Notes |
|---------------|---------------|-------|
| `gameState.X` | `X` | Strip prefix (line 348) |
| `character.X` | `角色.X` | English → Chinese (line 349) |
| `inventory.X` | `背包.X` | English → Chinese (line 350) |
| `confidants.X` | `社交.X` | English → Chinese (line 351) |
| `time` | `游戏时间` | English → Chinese (line 352) |
| `location` | `当前地点` | English → Chinese (line 353) |
| `path[0].field` | `path.0.field` | Array index normalization (line 354) |

### Error Handling

- **Intermediate Object Missing** (line 359): Returns `{success: false, error: "Invalid path: 'X' in 'Y'"}`.
- **Type Mismatch** (line 371): Returns `{success: false, error: "Target 'X' is not array"}`.
- **Exception Catch** (line 388): Returns `{success: false, error: e.message}`.

### INCONSISTENCIES FOUND

#### Issue A-009: Path Normalization Only Handles Prefix Aliases
**Severity**: P2 (Minor logic deviation)
**Symptom**: Path normalization only handles English prefixes at the START of the path (line 349-353). Mixed CN/EN paths mid-way are not normalized.
**Repro Steps**:
1. AI sends: `{"action": "set", "key": "角色.character.name", "value": "Bell"}`.
2. Path normalization: `角色.character.name` → `角色.character.name` (no change).
3. Line 359 tries to access `state.角色.character` → undefined.
4. Error: "Invalid path: 'character' in '角色.character.name'".

**Expected**: Recursively normalize all English aliases in path segments.
**Actual**: Only normalizes path prefix, not mid-path segments.
**Suspected Files**: hooks/useGameLogic.ts (line 347-389)
**Regression Check**: Test paths like `角色.equipment.weapon`, `背包.items.0.name`.

---

#### Issue A-010: Array Index Path Normalization Fragile
**Severity**: P1 (Logic error/state pollution)
**Symptom**: Array index normalization (line 354) converts `[N]` to `.N`, but doesn't validate that `N` is within bounds.
**Repro Steps**:
1. Inventory has 3 items (indices 0-2).
2. AI sends: `{"action": "set", "key": "背包[99].数量", "value": 10}`.
3. Path normalizes to `背包.99.数量`.
4. Line 359 tries to access `state.背包[99]` → undefined.
5. Error: "Invalid path: '99' in '背包.99.数量'".

**Expected**: Validate array index is within bounds before attempting access.
**Actual**: Out-of-bounds index causes error but no bounds check.
**Suspected Files**: hooks/useGameLogic.ts (line 354-361)
**Regression Check**: Test out-of-bounds array indices, verify clear error messages.

---

#### Issue A-011: updateStateByPath "push" Action Has Item Merge Logic Hardcoded
**Severity**: P1 (Logic error/state pollution)
**Symptom**: When action is "push" and target is inventory-related (line 373-381), items with same `名称` are merged by incrementing `数量`. This conflicts with unique item IDs and different qualities.
**Repro Steps**:
1. Inventory: `[{id: "Itm001", 名称: "短剑", 品质: "Common", 数量: 1}]`.
2. AI sends: `{"action": "push", "key": "背包", "value": {"名称": "短剑", 品质: "Rare", 数量: 1}}`.
3. Line 376: `findIndex((i) => i.名称 === compItem.名称)` → matches "短剑" (Common).
4. Line 377: `current[lastKey][existingIdx].数量 += 1` → Common 短剑 becomes 数量: 2.
5. Rare 短剑 is never added.

**Expected**: Push should add new item if attributes differ (品质, id).
**Actual**: Merge by 名称 alone causes item loss.
**Suspected Files**: hooks/useGameLogic.ts (line 373-381), utils/itemUtils.ts
**Regression Check**: Test push with items of same name but different quality/id.

---

#### Issue A-012: Silent Failures When Path Traversal Fails
**Severity**: P1 (Logic error/state pollution)
**Symptom**: When `updateStateByPath` returns `{success: false, error: ...}`, the error is logged (line 452) but does NOT create a system LogEntry. User has no visibility into failed commands.
**Repro Steps**:
1. AI sends: `{"action": "set", "key": "角色.不存在字段.value", "value": 10}`.
2. Line 359 returns: `{success: false, error: "Invalid path: '不存在字段' in '角色.不存在字段.value'"}`.
3. Line 452 logs: `console.warn('Command failed: set 角色.不存在字段.value', e)`.
4. No LogEntry created, user unaware of failure.

**Expected**: Failed commands should create system LogEntry for transparency.
**Actual**: Errors only logged to console.
**Suspected Files**: hooks/useGameLogic.ts (line 447-453)
**Regression Check**: Trigger path errors, verify system log entries created.

---

#### Issue A-013: updateStateByPath "add" Action Assumes Numeric Values
**Severity**: P2 (Minor logic deviation)
**Symptom**: When action is "add" (line 365-367), function assumes target is numeric. If target is string or object, behavior is undefined.
**Repro Steps**:
1. State: `{角色: {姓名: "Bell"}}`.
2. AI sends: `{"action": "add", "key": "角色.姓名", "value": " Cranel"}`.
3. Line 366: `oldVal = "Bell"` (not number).
4. Line 367: `current[lastKey] = oldVal + (typeof value === 'number' ? value : parseFloat(value) || 0)`.
5. `parseFloat(" Cranel")` → NaN → 0.
6. Result: `姓名: "Bell0"` (string + number coercion).

**Expected**: "add" action should only work on numeric fields or error out.
**Actual**: Type coercion causes unexpected results on non-numeric fields.
**Suspected Files**: hooks/useGameLogic.ts (line 365-367)
**Regression Check**: Test "add" action on string/object fields, verify proper error handling.

---

## Summary Statistics

| Category | Count | Severity Breakdown |
|----------|-------|-------------------|
| Total Issues Found | 13 | P0: 0, P1: 9, P2: 4 |
| Missing Schemas | 3 | A-001, A-002, A-005 |
| Merge/Validation Logic | 5 | A-004, A-006, A-007, A-011, A-013 |
| Error Handling | 3 | A-008, A-012, A-003 |
| Path Normalization | 2 | A-009, A-010 |

### Critical Path (P0/P1 Issues Requiring Immediate Fix)

1. **A-002**: Create EnemySchema (blocks combat validation)
2. **A-004**: Fix BattleMapRow partial merge (causes invalid combat state)
3. **A-007**: Fix inventory merge conflicts (causes item loss)
4. **A-011**: Fix inventory push merge logic (causes item loss)
5. **A-010**: Add array bounds validation (prevents crashes)
6. **A-012**: Add system log entries for failed commands (user visibility)

### Regression Test Cases

1. **Schema Coverage**: All TavernDB extension fields have Zod schemas.
2. **Partial Update Safety**: BattleMapRow/NPC/Inventory partial updates preserve nested object integrity.
3. **Merge Conflict Resolution**: Items with same name but different quality/id are handled correctly.
4. **Path Normalization**: Mixed CN/EN paths, array indices, out-of-bounds indices all handled gracefully.
5. **Error Visibility**: Failed commands create system LogEntry visible in UI.

---

**Next Steps**:
- Lane B (AI/指令管线) analysis
- Lane C (核心玩法逻辑) analysis
- Consolidate all lane issues into unified regression checklist
