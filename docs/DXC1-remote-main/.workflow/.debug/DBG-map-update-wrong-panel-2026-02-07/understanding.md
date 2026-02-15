# Understanding Document

**Session ID**: DBG-map-update-wrong-panel-2026-02-07
**Bug Description**: 关注右上角的地图更新按钮，我点击后更新到了如图的“世界情报监测”部分或者“公会公告”部分。期望应当是正确的更新地图模块的小地图和中地图，使之正确生成svg绘制地图的效果。
**Started**: 2026-02-07T06:10:04+08:00

---

## Exploration Timeline

### Iteration 1 - Initial Exploration (2026-02-07 06:10)

#### Current Understanding

- Update trigger lives in components/game/modals/DynamicWorldModal.tsx and calls onSilentWorldUpdate from the “世界情报监测” modal.
- onSilentWorldUpdate maps to handleSilentWorldUpdate in hooks/useGameLogic.ts, which calls handleWorldInfoUpdate with reason 请求生成详细的战术地图数据(Tactical Map SVG Layout).
- handleWorldInfoUpdate runs world AI (generateWorldInfoResponse or generateServiceCommands('world')) and applies tavern_commands via processTavernCommands.
- Map SVG updates only occur when commands include upsert_exploration_map, handled by handleUpsertExplorationMapStructure to write mapStructure into gameState.地图.smallLocations/midLocations.

#### Evidence from Code Search

DynamicWorldModal.tsx
- Update button (RefreshCw) is in headerActions and fires onSilentWorldUpdate (title: “立即更新情报”).

useGameLogic.ts
- handleSilentWorldUpdate -> handleWorldInfoUpdate('请求生成详细的战术地图数据(Tactical Map SVG Layout)').
- handleWorldInfoUpdate processes aiResponse.tavern_commands using processTavernCommands.
- processTavernCommands routes upsert_exploration_map to handleUpsertExplorationMapStructure.

MapModal.tsx
- Map rendering uses MapStructureSVG/LocalMapSVG from worldMap data.

#### Hypotheses Generated

- H1: Map update button routes through world info update pipeline; output focuses on world intel/guild, not map.
- H2: AI response lacks upsert_exploration_map (or uses unexpected action/key), so map data never updates.
- H3: upsert_exploration_map exists but fails validation (missing MapStructureJSON / LocationName mismatch), so map update is dropped.

#### Next Steps

- Add NDJSON debug logging around handleSilentWorldUpdate, handleWorldInfoUpdate, and handleUpsertExplorationMapStructure.
- Reproduce by clicking the update button.
- Analyze logs for command actions and map update results.

---

## Current Consolidated Understanding

### What We Know
- Update trigger in “世界情报监测” calls handleSilentWorldUpdate.
- Map SVG rendering depends on upsert_exploration_map updating gameState.地图.*.mapStructure.

### What Was Disproven
- (none yet)

### Current Investigation Focus
- Whether tavern_commands contain valid upsert_exploration_map and whether they apply successfully.

### Remaining Questions
- Do world update commands include map updates?
- If included, do they pass validation and target the correct location?

### Iteration 2 - Evidence Analysis (2026-02-07 06:20)

#### Log Analysis Results

**H1**: CONFIRMED
- Evidence: handleWorldInfoUpdate invoked with input “世界情报更新：debug-force”, useWorldService=true, mode=separate
- Reasoning: Update button uses world info pipeline (microservice world) rather than a dedicated map generator.

**H2**: CONFIRMED
- Evidence: tavern_commands count=5, hasMapCommand=false; actions only target gameState.世界.*
- Reasoning: No upsert_exploration_map or set_map_visuals emitted.

**H3**: INCONCLUSIVE
- Evidence: No map commands emitted, so mapStructure handler not invoked.
- Reasoning: Cannot validate mapStructure handling without map commands.

#### Corrected Understanding

- ~~世界更新会自动返回地图指令~~ → 微服务 world 响应仅返回世界情报指令，未包含地图指令
  - Why wrong: 实际 tavern_commands 只有世界字段；map command 缺失
  - Evidence: H2 log summary shows hasMapCommand=false

- ~~世界更新指令格式会被正常应用~~ → 微服务返回使用 mode/path，但 processTavernCommands 只识别 action/type/command
  - Why wrong: 控制台出现 “Command failed: missing action/key”
  - Evidence: Multiple console errors for mode/path commands

#### New Insights

- Map update button触发的是 world service 流程；在微服务模式下没有 map schema 注入。
- 微服务输出格式与 parser 不匹配（mode/path vs action/key），导致世界指令也可能无法落地。

#### Root Cause Identified

**Primary**: 微服务 world 更新未输出地图指令（缺少 upsert_exploration_map），因此地图不更新。
**Secondary**: 微服务命令格式使用 mode/path，导致 processTavernCommands 丢弃指令。

---

## Current Consolidated Understanding (Updated)

### What We Know
- 更新按钮走 handleWorldInfoUpdate（world microservice）。
- microservice 输出仅世界情报指令，缺少 map 指令。
- processTavernCommands 不识别 mode/path，导致指令丢弃。

### What Was Disproven
- ~~世界更新会自动返回地图指令~~
- ~~微服务指令会被正确执行~~

### Current Investigation Focus
- 修复 map 更新路径与命令兼容性，然后验证 mapStructure 是否写入小/中地图。

### Remaining Questions
- 若强制 map schema 输出，是否能正确命中当前地点 locationName？

### Iteration 3 - Evidence Analysis (2026-02-07 06:25)

#### Log Analysis Results

**H1**: CONFIRMED
- Evidence: handleWorldInfoUpdate invoked with map request; useWorldService=false
- Reasoning: Map request now bypasses microservice and uses map schema path.

**H2**: CONFIRMED (resolved)
- Evidence: tavern_commands count=1, hasMapCommand=true, action=upsert_exploration_map
- Reasoning: Map command is now emitted successfully.

**H3**: CONFIRMED (partial)
- Evidence: mapStructure handler created fallback small location (locationName not matched)
- Reasoning: LocationName from AI did not match existing small/mid entries; fallback created.

#### Corrected Understanding

- ~~地图更新仍走 world microservice~~ → 地图更新已改为走非微服务路径，并输出 map command
  - Why wrong: useWorldService=false 且 hasMapCommand=true
  - Evidence: H1/H2 logs

- ~~地图指令完全无法落地~~ → 地图指令落地，但 locationName 匹配失败导致 fallback 创建
  - Why wrong: handleUpsertExplorationMapStructure 被调用并创建 fallback
  - Evidence: H3 logs

#### New Insights

- Map 生成已成功，但 locationName 可能与现有地图节点不一致（导致 fallback）
- Dev 模式下可能触发重复 fallback 创建（StrictMode 双调用）

#### Next Steps

- 优先确保 mapStructure 写入“当前地点”匹配项，减少 fallback
- 复测地图模块是否显示 SVG

---

## Current Consolidated Understanding (Updated)

### What We Know
- 地图更新已输出 upsert_exploration_map 指令
- 指令能进入 handler，但 locationName 未命中已有节点

### What Was Disproven
- ~~地图更新仍走 world microservice~~
- ~~地图指令完全无法落地~~

### Current Investigation Focus
- locationName 对齐当前地点，确保地图模块可见更新

### Remaining Questions
- 修正 locationName 后，小/中地图是否正确显示 SVG？
