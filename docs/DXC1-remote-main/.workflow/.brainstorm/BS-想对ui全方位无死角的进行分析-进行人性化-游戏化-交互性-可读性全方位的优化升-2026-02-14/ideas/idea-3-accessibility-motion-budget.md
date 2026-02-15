# idea-3: 可访问性设置扩展 + 动效预算治理

## Concept
把现有 fontSize 扩展为阅读体验中心：字号、行高、对比度、动效等级、信息密度统一配置。

## Requirements
- AppSettings 扩展字段与迁移策略。
- CenterPanel / LogEntry / TasksModal 首批支持。
- 动效等级按设备性能和用户偏好自动调整。

## Risk Matrix
- 设置复杂度上升：低 -> 提供预设模式（舒适/平衡/沉浸）。
- 视觉割裂：中 -> token 化动效与对比度策略。

## MVP
1. 行高 + 对比度 + 动效强度。
2. 三档预设。
3. 设置持久化兼容。

## Success Metrics
- 长时间阅读场景中退出率下降。
- 低性能设备卡顿反馈下降。

## Recommendation
pursue
