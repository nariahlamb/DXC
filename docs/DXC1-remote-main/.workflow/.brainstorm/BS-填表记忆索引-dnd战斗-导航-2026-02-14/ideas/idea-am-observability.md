# Idea Deep Dive - AM 链路可观测性

## 核心概念

围绕 `AMxxxx` 建立跨模块可追踪链路：摘要、纲要、索引召回、战斗输出。

## 实施要求

- 在导航中显式列出 AM 生成、校验、检索、消费四阶段。
- 输出最小链路日志（文本版），后续再可视化。

## 风险与缓解

- 风险：日志过多影响可读性。
- 缓解：仅保留 topK 与关键 AM。

## MVP

1. 手册中增加 AM 链路章节。
2. 保留关键函数锚点：`normalizeAmIndex`、`assignAmIndexesForLogCommands`、`buildMemoryIndexProjection`、`retrieveMemoryByQuery`。

## 成功指标

- 出现“召回异常”时，5 分钟内可定位到链路断点。

## 结论

可作为第二阶段增强。
