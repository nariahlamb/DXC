# Idea Deep Dive - Manifest 驱动导航

## 核心概念

以 `ref-manifest` 作为说明书导航的 SSOT，管理：参考文件、实现锚点、对照关系、阅读路径。

## 实施要求

- 定义实体：`reference`, `implementation`, `crosswalk`, `anchors`。
- 每条 crosswalk 至少包含：`ref_file`, `runtime_file`, `key_symbols`, `risk_notes`。
- 提供死链检测脚本与测试。

## 风险与缓解

- 风险：人工维护成本高。
- 缓解：生成脚本 + 自动测试。

## MVP

1. 先覆盖四主链（记忆、召回、DND、战斗）。
2. 产出自动生成目录页。
3. 加入基础漂移测试。

## 成功指标

- 新成员可在 10 分钟内定位任意主链入口。
- 参考文件重命名后测试可立即报错。

## 结论

建议立即推进。
