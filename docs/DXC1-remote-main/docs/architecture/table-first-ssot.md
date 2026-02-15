# DXC 表驱动 SSOT 架构规范

## 1. 目标与边界
- SSOT：业务事实以 `TavernDB sheet rows` 为唯一事实源。
- 映射：模块对象（`gameState.*`）仅作为投影/运行态映射，不作为事实主源。
- 写入：业务写入统一通过 `upsert_sheet_rows` / `delete_sheet_rows` 或其等价专用命令。
- 兼容策略：禁止新增旧式 `set/add/push/delete gameState.*` 业务路径写入。

## 2. 数据流
1. AI/系统产生命令（table-first）。
2. `processTavernCommands` 校验命令白名单与载荷。
3. `handleUpsertSheetRows/handleDeleteSheetRows` 更新表行并回写映射模块。
4. `applyTurnTransaction` 原子提交 patch，冲突则回滚。
5. `projectGameStateToTavernTables` 输出 UI/检索投影（含缓存与失效键）。

## 3. 命令规范
- 推荐命令：
  - `upsert_sheet_rows`
  - `delete_sheet_rows`
  - `append_econ_ledger`
  - `apply_econ_delta`
  - `append_log_summary`
  - `append_log_outline`
- 命令载荷约束：
  - `sheetId` 必须在 `TAVERNDB_TEMPLATE_SHEET_IDS` 内。
  - `rows` 必须为对象数组。
  - `rowIds` 必须为字符串/数字数组。
  - `expectedSheetVersion` / `expectedRowVersion` 用于 optimistic check。

## 4. 冲突与错误码
- `TDB-001` `sheet_version_conflict`：sheet 版本不匹配。
- `TDB-002` `row_version_conflict`：行版本不匹配。
- `TDB-003` `row_locked`：行锁冲突。
- `TDB-004` `cell_locked`：字段锁冲突。
- `TDB-005` `invalid_sheet_payload`：载荷结构错误（如 rows 非对象数组）。
- `TDB-006` `unknown_sheet_id`：未知 sheet。
- `TDB-007` `legacy_path_blocked`：业务路径写入被阻断。

## 5. 事务审计与回放
- 审计表：`SYS_TransactionAudit`。
- 运行时轨迹：`__tableMeta.txJournal`。
  - 字段：`txId/status/commandCount/patchCount/patches/sources/reason`。
- Devtools：MemoryModal 的 `Transaction Replay` 面板可按 patch 步进回放并跳转受影响表。

## 6. 性能约定
- 投影缓存：`tableProjection` 以 `sheetVersions + shadowRows length + turn/time/location` 生成失效键。
- 大表渲染：MemoryModal 采用分页（默认 25 行/页）。
- 检索：优先按模式化策略与分表权重召回，避免全量暴力扫描。

## 7. 新增表接入清单
1. 在 `types/taverndb.ts` 注册 sheet id。
2. 在 `sheetRegistry.ts` 定义列与 domain mapping。
3. 在 `extendedCommands.ts` 增加 upsert/delete 映射回写。
4. 在 `tableProjection.ts` 增加投影 row builder。
5. 增加测试：写入、投影、事务冲突、UI 可视化。

## 8. 当前约束（多 API 最小集）
- `story`：只负责叙事与少量非填表变量。
- `memory`：负责记忆填表（LOG/AM 相关）。
- `map`：负责地图生成。
- 其余微服务默认关闭或不参与主链路。
