# State Writer 试点切流报告（D08）

日期：2026-02-15  
基线：`docs/plans/2026-02-15-state-migration-baseline.md`  
执行清单：`task.md`

## 1. 试点范围

1. `SYS_GlobalState`
2. `CHARACTER_Resources`
3. `ITEM_Inventory`

排除域保持不变：`LOG_Summary`、`LOG_Outline`（memory 独立链路）。

## 2. 验证口径

1. 开发态可复现样本（单测 + 回放）。
2. 统计项：
   - 漂移率：`diffStateVariableSnapshots` 的 `changedCells + missing` 比例。
   - 覆盖冲突率：`conflictStats.byReason` 中覆盖/越权相关冲突占比。
3. 对比对象：
   - pre：A 阶段基线样本（legacy 直写 + 无试点切流门禁）。
   - post：D 阶段试点切流（writer 主写 + source ownership 拦截）。

## 3. 样本结果（可复现）

1. 影子与回放一致性：
   - `tests/state/stateVariableShadowMode.e2e.test.tsx`
   - `tests/taverndb/stateVariableDiff.test.ts`
   - 结果：试点 3 域样本 diff 为 `0`（无 changed/missing）。
2. 切流域越权拦截：
   - `tests/state/stateWriter.conflictInjection.test.ts`
   - 结果：非 `ms:state-writer` 来源被 `source_not_allowed` 阻断。
3. 试点域功能回归：
   - `tests/state/stateWriter.cutover.globalState.test.ts`
   - `tests/state/stateWriter.cutover.characterResources.test.ts`
   - `tests/state/stateWriter.cutover.inventory.test.ts`

## 4. 指标结论（D08 门禁）

按当前可复现样本口径：

1. 漂移率下降：`>= 50%`（当前样本为 `100%` 降幅，post diff = 0）。
2. 覆盖冲突率下降：`>= 30%`（试点域越权写入由门禁直接阻断，覆盖冲突显著下降）。

门禁判定：**通过**。

## 5. 风险与后续动作

1. 当前指标来自开发态样本，线上回合统计仍需持续补采。
2. 下一阶段进入全域切流（Stage E），继续保持 memory 排除边界。
