# 灰度开关策略（F05）

日期：2026-02-15

## 1. 开关维度

1. 按域开关：`stateVarWriter.cutoverDomains`。
2. 按环境开关：开发 / 测试 / 生产可配置不同默认值。
3. 按账号开关：通过运行时配置注入测试账号白名单（如接入账号层策略）。

## 2. 推荐顺序

1. 先开 `shadowMode=true` 做对账。
2. 再按域逐波次加入 `cutoverDomains`。
3. 仅在切流域开启 `rejectNonWriterForCutoverDomains=true`。

## 3. 回滚策略（无 fallback 兜底）

1. 关闭 `stateVarWriter.enabled`，立即退出 writer 主写。
2. 或清空 `cutoverDomains`，仅保留影子观测。
3. 发现异常时优先阻断并告警，不做跨 API fallback 兜底。
