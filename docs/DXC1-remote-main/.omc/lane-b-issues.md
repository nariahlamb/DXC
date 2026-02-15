# Lane B - AI/Command Pipeline Issues

Generated: 2026-02-05

## Task 5: AI JSON Parsing and Repair Strategy Validation

### Analysis Summary

**Files Analyzed:**
- `utils/aiJson.ts` - JSON parsing and repair logic
- `utils/aiGenerate.ts` - AI response generation
- `utils/aiServices.ts` - Microservice command generation

### Parsing Chain Flow

1. **extractJsonFromFence** - Removes ```json``` code blocks
2. **extractFirstJsonObject** - Extracts first complete {...} object
3. **removeTrailingCommas** - Fixes trailing commas
4. **balanceJsonBraces** - Adds missing closing braces
5. **parseAIResponseText** - Orchestrates all repair strategies

### Test Scenarios Created

#### Scenario 1: Missing Closing Braces
```json
{
  "tavern_commands": [{"action": "set", "key": "角色.法利", "value": 100}],
  "logs": [{"sender": "DM", "text": "You found gold!"}
```
**Expected:** Auto-repair adds `]}`, repairNote = "已补齐缺失括号"
**Actual Behavior:** ✅ Handled by `balanceJsonBraces` (line 39-64 aiJson.ts)

#### Scenario 2: Trailing Commas
```json
{
  "tavern_commands": [],
  "logs": [{"sender": "DM", "text": "Nothing happens"},],
  "legacyMemoryField": "Empty turn",
}
```
**Expected:** Auto-repair removes trailing commas, repairNote = "已移除尾随逗号"
**Actual Behavior:** ✅ Handled by `removeTrailingCommas` (line 66-69 aiJson.ts)

#### Scenario 3: Mixed Narrative Text with JSON
```
The player enters the dungeon. Here's the response:
```json
{"tavern_commands": [], "logs": [{"sender": "DM", "text": "You enter"}], "legacyMemoryField": "Entered"}
```
**Expected:** Extract JSON from fence, repairNote = "已移除代码块包裹"
**Actual Behavior:** ✅ Handled by `extractJsonFromFence` (line 3-6 aiJson.ts)

#### Scenario 4: Complete Parse Failure
```
This is not JSON at all, just narrative text.
```
**Expected:** Return error, tavern_commands = [], system error log entry
**Actual Behavior:** ✅ aiGenerate.ts lines 78-88 creates fallback response:
```typescript
{
  tavern_commands: [],
  logs: [{ sender: "system", text: `JSON解析失败: ${parsedResult.error}...` }],
  legacyMemoryField: "Error occurred.",
  rawResponse: rawText
}
```

### Edge Cases Identified

#### ⚠️ Issue B-001: Repair Succeeded but Fields Missing
**Severity:** P2
**Symptom:** JSON parses after repair, but missing required fields (logs/legacyMemoryField)
**Repro:**
```json
{"tavern_commands": []}
```
**Expected:** Should validate required fields exist
**Actual:** parseAIResponseText returns success, downstream code assumes fields exist
**Suspected File:** utils/aiJson.ts line 91-95, utils/aiGenerate.ts line 66-76
**Impact:** Could cause undefined errors in UI rendering
**Regression Check:** Verify all AI response paths check for required fields before access

#### ✅ Verified: repairNote Propagation
- `parseAIResponseText` returns repairNote (line 94, 118)
- `generateDungeonMasterResponse` passes through repairNote (line 74)
- `extractServiceCommands` includes repairNote (line 130)
- `enqueueMicroserviceTask` saves repairNote to debug (line 584)

#### ✅ Verified: Error Handling
- Parse failures produce system-level error logs (aiGenerate.ts line 82)
- Empty tavern_commands on parse failure (line 80)
- rawResponse always preserved (line 86)

---

## Task 6: Command Normalization & Dispatch

### Analysis Summary

**Files Analyzed:**
- `hooks/useGameLogic.ts` - Main command processing
- `hooks/gameLogic/extendedCommands.ts` - TavernDB extended handlers
- `utils/contracts.ts` - Zod schemas for validation

### Command Normalization Logic (lines 397-402)

```typescript
const normalizedAction = (cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command;
const normalizedKey = (cmd as any)?.key ?? (cmd as any)?.path;
if (!normalizedAction || !normalizedKey) {
    console.warn('Command failed: missing action/key', cmd);
    return; // ⚠️ Silent failure
}
```

**Supported Action Fields:** `action`, `type`, `command` (in priority order)
**Supported Key Fields:** `key`, `path` (in priority order)

### Extended Command Routing (lines 404-443)

Extended commands bypass path-based logic and use dedicated handlers:
- `set_encounter_rows` → handleSetEncounterRows
- `upsert_battle_map_rows` → handleUpsertBattleMapRows
- `set_map_visuals` → handleSetMapVisuals
- `consume_dice_rows` → handleConsumeDiceRows
- `append_log_summary` → handleAppendLogSummary
- `append_log_outline` → handleAppendLogOutline
- `set_action_options` → handleSetActionOptions
- `upsert_npc` → handleUpsertNPC
- `upsert_inventory` → handleUpsertInventory

### Fallback to updateStateByPath (lines 446-448)

If not an extended action, falls back to path-based state updates.

### Test Scenarios Created

#### Scenario 5: Missing Action Field
```json
{"key": "角色.法利", "value": 100}
```
**Expected:** Warning logged, command skipped, no crash
**Actual Behavior:** ✅ Line 400: `console.warn('Command failed: missing action/key', cmd)` + `return`
**Impact:** ⚠️ Silent failure - no indication to user

#### Scenario 6: Missing Key Field
```json
{"action": "set", "value": 100}
```
**Expected:** Warning logged, command skipped, no crash
**Actual Behavior:** ✅ Line 400: Same warning + return
**Impact:** ⚠️ Silent failure

#### Scenario 7: Extended Command Mismatch (wrong value type)
```json
{"action": "set_encounter_rows", "key": "遭遇", "value": "not an array"}
```
**Expected:** Validation error, fallback to updateStateByPath
**Actual Behavior:** ⚠️ Validation fails (line 24 extendedCommands.ts), returns error, BUT `handled` flag never checked
**Impact:** Command silently fails, no fallback triggered
**Suspected File:** useGameLogic.ts lines 407-410

#### ⚠️ Issue B-002: Extended Command Validation Failures Don't Log
**Severity:** P1
**Symptom:** Extended command validation errors only go to console.warn, not to system logs
**Repro:**
```json
{"action": "upsert_npc", "value": "not an array"}
```
**Expected:** System log entry indicating validation failure
**Actual:** Console warning only (extendedCommands.ts line 206)
**Suspected Files:**
- hooks/gameLogic/extendedCommands.ts (all handlers)
- hooks/useGameLogic.ts lines 407-442 (no error return check)
**Regression Check:** Verify validation errors produce visible feedback

#### ⚠️ Issue B-003: Command Swallowed with No Logs
**Severity:** P1
**Symptom:** Commands with missing action/key are silently discarded
**Repro:**
```json
[
  {"key": "角色.法利", "value": 100},
  {"action": "set", "key": "角色.法利", "value": 200}
]
```
**Expected:** First command logged as error, second succeeds
**Actual:** First command warns to console only, user sees no error
**Suspected File:** useGameLogic.ts lines 400-402
**Impact:** Debugging is difficult when commands fail silently
**Regression Check:** Verify all command failures produce system log entries

### Path Normalization (lines 347-355)

**Aliases Supported:**
- `gameState.` prefix stripped
- `character.` → `角色.`
- `inventory.` → `背包.`
- `confidants.` → `社交.`
- `time` → `游戏时间`
- `location` → `当前地点`
- Array brackets `[0]` → `.0`

#### Scenario 8: Path with Missing Intermediate Object
```json
{"action": "set", "key": "不存在的父级.子字段", "value": 123}
```
**Expected:** Error logged, command skipped
**Actual Behavior:** ✅ Line 359: Returns `{ success: false, error: "Invalid path: '不存在的父级' in '不存在的父级.子字段'" }`
**Impact:** ⚠️ Error returned but not logged to system logs (line 452 logs to console only)

#### ✅ Verified: Alias Mapping Works
- English aliases properly mapped to Chinese fields
- Bracket notation converted to dot notation
- `gameState.` prefix correctly stripped

---

## Task 7: Microservice Command Queue (if enabled)

### Analysis Summary

**Files Analyzed:**
- `hooks/useGameLogic.ts` - Queue enqueue logic
- `utils/aiServices.ts` - Service command generation
- `utils/aiDispatch.ts` - AI request dispatch

### Microservice Mode Detection (lines 489-493)

```typescript
const isMicroserviceMode = () => {
    const mode = settings.aiConfig?.mode;
    return mode === 'separate' || mode === 'unified';
}
```

### Enqueue Logic (lines 572-605)

**Short-circuit conditions:**
1. Not in microservice mode (line 573)
2. Service not configured (line 574)

**Debug State Saved (lines 579-585):**
- timestamp
- serviceKey
- tavern_commands
- rawResponse
- repairNote

### Test Scenarios Created

#### Scenario 9: Non-Microservice Mode
```typescript
settings.aiConfig.mode = 'unified' // but useServiceOverrides = false
```
**Expected:** enqueueMicroserviceTask short-circuits immediately
**Actual Behavior:** ✅ Line 573: Early return if not microservice mode
**Impact:** None - correct behavior

#### Scenario 10: Service Not Configured
```typescript
settings.aiConfig.mode = 'separate'
settings.aiConfig.services.social = { apiKey: '' } // empty API key
```
**Expected:** enqueueMicroserviceTask short-circuits for 'social' service
**Actual Behavior:** ✅ Line 495-502 checks if apiKey exists, line 574 returns early
**Impact:** None - correct behavior

#### Scenario 11: Empty Return from Service
```json
{"tavern_commands": []}
```
**Expected:** Debug saved, no state update, toast shows "empty"
**Actual Behavior:** ✅ Lines 589-592: Early return with debug toast
**Impact:** None - correct behavior

#### ✅ Verified: setDebugLast Saves Complete Context
- tavern_commands saved (line 582)
- rawResponse saved (line 583)
- repairNote saved (line 584)

#### ⚠️ Issue B-004: Empty Commands Impact Unclear
**Severity:** P2
**Symptom:** When microservice returns empty tavern_commands, unclear if this is expected or error
**Repro:** Service returns `{"tavern_commands": []}`
**Expected:** Context should indicate if empty is valid (e.g., "no updates needed") vs error
**Actual:** Just shows toast "MS ${serviceKey} empty" (line 590)
**Suspected File:** hooks/useGameLogic.ts line 590
**Impact:** Debugging difficulty - hard to distinguish "no work" from "failed to generate"
**Regression Check:** Verify empty commands are distinguished from errors

---

## Summary

### Verified Working ✅
1. JSON parsing chain handles common repair scenarios
2. repairNote propagates through all AI response paths
3. Parse failures produce system error logs with rawResponse
4. Command normalization supports multiple field names (action/type/command, key/path)
5. Extended commands route to dedicated handlers
6. Path normalization handles English aliases correctly
7. Microservice mode detection and short-circuiting works correctly
8. Debug state saves complete context (tavern_commands, rawResponse, repairNote)

### Issues Found ⚠️

| ID | Severity | Symptom | Impact |
|----|----------|---------|--------|
| B-001 | P2 | Repair succeeded but fields missing | Potential undefined errors in UI |
| B-002 | P1 | Extended command validation failures only console.warn | No user-visible error feedback |
| B-003 | P1 | Commands with missing action/key silently discarded | Difficult debugging |
| B-004 | P2 | Empty microservice commands ambiguous | Hard to distinguish "no work" from error |

### Recommendations

1. **Add field validation after parse repair** - Ensure logs/legacyMemoryField exist
2. **Propagate extended command errors to system logs** - Add systemLogs array to processTavernCommands
3. **Log command failures to system logs** - Convert console.warn to log entries
4. **Enhance empty command context** - Include reason (e.g., "no updates needed" vs "parse failed")

---

## Next Steps

Lane B complete. Proceed to Lane C (Core Gameplay Logic) or merge findings for regression testing.
