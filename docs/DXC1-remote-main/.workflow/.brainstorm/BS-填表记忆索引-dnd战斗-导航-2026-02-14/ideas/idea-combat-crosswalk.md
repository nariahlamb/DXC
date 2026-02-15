# Idea Deep Dive - 战斗推进对照导航

## 核心概念

将“战斗推进预设规则”映射到 DXC 的战斗命令处理与 UI 展示，形成可追踪闭环。

## 实施要求

- 预设字段到命令映射：`set_encounter_rows`、`upsert_battle_map_rows`、`set_map_visuals`、`set_initiative`、`append_combat_resolution`。
- 明确 battle map 兼容规则：配置行、坐标边界、视觉层还原。

## 风险与缓解

- 风险：预设语言与实现字段语义漂移。
- 缓解：在 crosswalk 中固定最小字段集与可选字段集。

## MVP

1. 手册补战斗闭环章节。
2. 增加战斗相关常见故障排查模板。

## 成功指标

- 战斗类问题可按“预设->命令->UI”顺序完成定位。

## 结论

应与主手册同步上线。
