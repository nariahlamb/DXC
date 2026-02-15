# Consolidated Issue Summary (Lanes A/B/C)

## Severity Totals (All Lanes)
- P0: 0
- P1: 12
- P2: 10

## Top 5 Critical Issues (immediate fixes)
1) A-002 – Missing Enemy Zod schema (CombatState.敌方 unvalidated) → risk of invalid enemy data.
2) A-004 – BattleMapRow partial merge is shallow, creates invalid nested coords.
3) A-007 – Inventory upsert merges by 名称 only; causes item loss when qualities differ.
4) A-011 – Inventory push merges by 名称; loses distinct items/qualities.
5) C-10.1 – Combat cleanup fails to clear TavernDB fields (地图/视觉/上一次行动) after combat.

## Issues Grouped by Affected System
- State / Schema
  - A-001, A-002, A-004, A-005, A-006, A-007, A-008, A-009, A-010, A-011, A-012, A-013
- AI Pipeline
  - B-001, B-002, B-003, B-004
- Gameplay
  - C-8.2, C-8.3, C-9.1, C-9.2, C-10.1

## Recommended Fix Priority (P0/P1 first)
1) A-002 (Enemy schema) – blocks combat validation
2) A-004 (BattleMap partial merge)
3) A-007 (Inventory upsert merge key)
4) A-011 (Inventory push merge logic)
5) C-10.1 (Combat cleanup for TavernDB fields)
6) A-001 (Schemas for TavernDB extension fields)
7) A-005 (ConsumeDiceRows schema)
8) A-006 (NPC upsert defaults overwrite)
9) A-010 (Array index bounds in path updates)
10) A-012 (System log on path failures)
11) B-002 (Surface extended command validation errors)
12) B-003 (Log missing action/key commands)

## P1 Fix Execution Plan (12 issues)
- Scope: P1s = A-001, A-002, A-004, A-005, A-006, A-007, A-010, A-011, A-012; B-002, B-003; C-10.1.
- Plan (order):
  1) Schema hardening: A-002 → EnemySchema; A-001 → TavernDB extension field schemas; A-005 → ConsumeDiceRows schema.
  2) Merge/validation correctness: A-004 (BattleMap deep merge), A-006 (NPC defaults after spread), A-007 (Inventory upsert key strategy), A-011 (push merge logic), A-010 (array index bounds).
  3) Error surfacing: A-012 (failed path commands to system logs), B-002 (extended command validation errors to system logs), B-003 (missing action/key logged visibly).
  4) Combat cleanup: C-10.1 (clear 上一次行动/地图/视觉 on combat end).
- Outputs to verify: updated Zod schemas, extended command validators, inventory merge rules, combat cleanup, system log entries for all command validation failures.
