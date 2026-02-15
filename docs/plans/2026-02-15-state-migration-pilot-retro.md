# State Writer 试点复盘（D11）

日期：2026-02-15  
关联报告：`docs/plans/2026-02-15-state-migration-pilot-report.md`

## 1. 本阶段完成项

1. 试点 3 域切流：`SYS_GlobalState`、`CHARACTER_Resources`、`ITEM_Inventory`。
2. 非 writer 来源拒绝：切流域启用 `sourceOwnershipRules`。
3. 冲突注入、切流回归、memory 回归全部通过。

## 2. 异常样本与处理

1. 样本：切流域存在非 writer 来源写入。
2. 处理：事务层统一阻断并写入 `source_not_allowed` 统计。
3. 结果：避免“旁路写入”覆盖 writer 输出。

## 3. 经验总结

1. 切流必须和 source ownership 同步开启，否则会出现绕写风险。
2. memory 体系需严格保持独立，禁止纳入 writer 路由。
3. 不引入 fallback 兜底时，冲突可见性更清晰，便于快速定位。

## 4. 待持续跟踪项

1. 线上真实回合漂移率追踪。
2. writer backlog 与重试分布趋势。
3. 高并发回合下的冲突曲线。
