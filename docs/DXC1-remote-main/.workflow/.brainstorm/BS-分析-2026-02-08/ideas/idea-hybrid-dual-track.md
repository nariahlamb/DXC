# Idea Deep-Dive: Hybrid Dual-Track Adapter

## 核心概念
在不打断现有 `GameState + tavern_commands` 主链的前提下，新增 `Sheet Compatibility Adapter` 层。

## 目标
- 把 `sheet_*` 语义映射为可维护的 typed domain
- 复用现有命令处理器，减少重写
- 支持分阶段替换脚本逻辑

## 设计要点
1. `sheet registry`
   - 每张表定义字段 schema、更新策略、投影规则
2. `projection engine`
   - `GameState -> sheet view`
3. `row translator`
   - `insert/update/deleteRow` -> `tavern_commands`
4. `turn transaction`
   - 单回合内批量命令原子提交

## 风险与缓解
- 双系统长期并存 → 设定 sunset 里程碑
- 状态漂移 → invariant validator + replay log

## MVP
- 覆盖 10 张核心表
- 支持模板导入+核心映射校验

## 决策
**Recommendation**: pursue
