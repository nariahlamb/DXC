# UI 体验基线与验收门槛（2026-02-14）

## 基线指标

- `actionLatencyMs`：行动触发到 UI 响应的延迟（毫秒）。
- `logsReadabilityScore`：日志可读性评分（0-100，后续由规则计算）。
- `crossEndConsistencyScore`：桌面与移动端一致性评分（0-100，后续由规则计算）。

## 当前默认值（Task 1 最小实现）

```ts
{
  actionLatencyMs: 0,
  logsReadabilityScore: 0,
  crossEndConsistencyScore: 0
}
```

## 验收门槛

- 测试层确保 3 个指标字段类型为 `number`。
- `smoke` 级别提供最小防回归断言，防止字段回退为 `null` 或丢失。
