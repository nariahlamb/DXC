[根目录](../CLAUDE.md) > **mobile-demo**

# mobile-demo 模块

## 模块职责
独立的旧版 React/Vite 演示工程，用于移动端实验或历史原型验证，不参与主应用运行链路。

## 入口与启动
- `mobile-demo/src/main.tsx`
- `mobile-demo/src/App.tsx`

## 对外接口
- 无对主应用直接导出的运行时接口

## 关键依赖与配置
- React 17 + Vite 1（与主项目 React 19/Vite 6 存在版本差异）
- 独立 `mobile-demo/package.json`

## 数据模型
- 演示组件计数器，无业务状态模型

## 测试与质量
- 当前未发现独立测试文件

## 常见问题 (FAQ)
- Q: 是否可直接复用到主应用？
  - A: 不建议直接复用，需先做版本与样式体系对齐。

## 相关文件清单
- `mobile-demo/package.json`
- `mobile-demo/src/main.tsx`
- `mobile-demo/src/App.tsx`

## 变更记录 (Changelog)
- **2026-02-15 14:59:52**: 新建 mobile-demo 模块文档，标注其为独立旧版实验工程。
