# Idea Deep-Dive: Template Studio Incremental

## 核心概念
将参考脚本中的模板/预设/隔离能力拆成可分期实施的配置工作流。

## 分期策略
- Phase 1: 模板导入导出 + JSON校验 + 差异提示
- Phase 2: 预设管理（保存/切换/回滚）
- Phase 3: profile隔离（按角色/存档）
- Phase 4: 可视化编辑器

## 数据设计
- `templateRegistry`
- `presetStore`
- `profileKeyResolver`
- `migrationPipeline`

## 风险与缓解
- 配置复杂度高 → 简版向导 + 高级模式
- 迁移失败 → 版本标记 + 自动回滚

## MVP
- 支持导入 `DND仪表盘配套模板.json`
- 将 10 张核心表映射到现有状态

## 决策
**Recommendation**: pursue incrementally
