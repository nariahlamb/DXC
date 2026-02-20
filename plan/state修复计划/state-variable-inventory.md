# State变量域清单与最小必填集（模板）

## 文档信息

- 项目：DXC
- 文档版本：v0.1
- 负责人：
- 创建日期：
- 最近更新：
- 对应计划：`plan/state-variable-repair-phase-checklist.md`

## 使用说明

- 本文档只覆盖变量块，不覆盖剧情文案、UI样式、性能优化。
- 填写时必须遵守四服务分工：`story/state/memory/map` 各司其职。
- `memory` 独立，不得回退到 `state`。
- 正文不得直接写业务 state 变量。

## 全局规则确认

- [ ] 已确认 `memory` 不走 `state` 回退。
- [ ] 已确认世界/论坛按 UI 的“世界更新间隔回合”更新。
- [ ] 已确认 state 业务变量只走 state writer 链路。
- [ ] 已确认 legacy path 仅用于兼容/拦截，不承担业务写入。

## 变量域总览

| 域 | 主要对象/表 | 主要前端模块 | 来源服务 | 写入入口 | 备注 |
|---|---|---|---|---|---|
| SYS | SYS_GlobalState | 主界面状态栏 | state | state writer | 核心全局变量 |
| 世界 | WORLD_* | DynamicWorldModal | state | state writer + cadence | 受轮次控制 |
| 论坛 | FORUM_* | SocialPhoneModal | state | state writer + cadence | 与世界轮次联动 |
| 手机 | PHONE_* | SocialPhoneModal | state | state writer | 不允许 story path 直写 |
| 社交 | NPC_*/REL_* | 社交相关面板 | state | state writer | 包含关系与互动记录 |
| 任务 | QUEST_* | 任务面板 | state | state writer | 进度字段需可追踪 |
| 背包 | ITEM_* | 背包面板 | state | state writer | 数量与来源要可校验 |
| 经济 | ECON_* | 经济与资源面板 | state | state writer | 增减记录需完整 |

## 字段级清单（最小必填集 MRS）

| 字段ID | 变量域 | 字段路径/列名 | 级别 | 来源服务 | 写入入口 | 前端使用位置 | 默认值策略 | 校验规则 | 当前状态 | 问题ID | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MRS-SYS-001 | SYS | gameState.回合数 | 必填 | state | state writer | 顶部状态/轮次逻辑 | 无默认，缺失即失败 | number>=0 | 待确认 |  |  |
| MRS-WLD-001 | 世界 | gameState.世界.下次更新回合 | 必填 | state | cadence写回 | DynamicWorldModal | interval=0时可空 | number>=0或undefined | 待确认 |  |  |
| MRS-FOR-001 | 论坛 | gameState.手机.论坛.* | 必填 | state | state writer | SocialPhoneModal | 空数组兜底仅展示 | 结构与schema一致 | 待确认 |  |  |
| MRS-PHN-001 | 手机 | gameState.手机.会话列表 | 必填 | state | state writer | SocialPhoneModal | 空数组兜底仅展示 | array of thread | 待确认 |  |  |
| MRS-QST-001 | 任务 | gameState.任务.* | 必填 | state | state writer | 任务面板 | 空数组兜底仅展示 | schema校验通过 | 待确认 |  |  |
| MRS-INV-001 | 背包 | gameState.背包.* | 必填 | state | state writer | 背包面板 | 空数组兜底仅展示 | item结构完整 | 待确认 |  |  |
| MRS-ECO-001 | 经济 | gameState.眷族.资金 | 必填 | state | state writer | 经济显示 | 无默认，缺失即失败 | number | 待确认 |  |  |

## 缺失矩阵

| 问题ID | 变量域 | 缺失字段 | 触发场景 | 来源服务 | 预期行为 | 实际行为 | 影响页面 | 严重级别 | 复现步骤 | 责任Phase | 修复状态 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SV-MISS-001 |  |  |  |  |  |  |  |  |  |  | 待处理 |

## Legacy拦截核对

| 规则ID | 命令类型 | 路径示例 | 是否业务域 | 预期处理 | 实际处理 | 结果 |
|---|---|---|---|---|---|---|
| LGC-001 | set | gameState.任务.主线[0].状态 | 是 | 拦截并报错 |  |  |
| LGC-002 | push | gameState.处理中.队列 | 否(UI瞬态) | 允许 |  |  |

## 验收门槛

- [ ] 所有“必填”字段都有明确来源与校验规则。
- [ ] 缺失字段均有问题ID并可复现。
- [ ] 每个问题都映射到修复Phase与负责人。
- [ ] 变量清单与前端显示使用点已一一对应。

## 变更记录

| 日期 | 修改人 | 变更内容 | 关联问题 |
|---|---|---|---|
|  |  | 初始化模板 |  |
