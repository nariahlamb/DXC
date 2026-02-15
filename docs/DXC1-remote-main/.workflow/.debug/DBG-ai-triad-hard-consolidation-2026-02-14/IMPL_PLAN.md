# IMPL Plan - 3AI 硬合并执行

## Scope

基于 `execution-plan.md`，将系统从“3AI UI + 旧模式运行时兼容”收敛为“3AI 唯一可达模式”。

## Ordered Tasks

1. `IMPL-1`：类型与配置收敛（仅 3 服务）
2. `IMPL-2`：路由/分发/Prompt 去旧模式化
3. `IMPL-3`：主流程删除 legacy 执行与 fallback 入口
4. `IMPL-4`：服务输入与命令守卫收敛到 triad
5. `IMPL-5`：测试与文档同步 + 验证
