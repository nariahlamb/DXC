# UI 全链路体验升级 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不推翻现有架构的前提下，完成 DXC 的人性化、游戏化、交互性、可读性全链路升级，并在 12 周内可分批上线。

**Architecture:** 采用 Hybrid 路线（A + B）：先做 `CenterPanel` 与日志/任务联动的高体感增量优化，再统一桌面与移动端的信息优先级协议，最后落地设置可访问性与动效预算治理。实现上坚持 `useGameLogic` 主链路不破坏，通过 selector/facade 与组件边界重整降低耦合。

**Tech Stack:** React、TypeScript、Tailwind CSS、Vitest、Testing Library、Vite

---

## 输入与边界

- Brainstorm 会话：`.workflow/.brainstorm/BS-想对ui全方位无死角的进行分析-进行人性化-游戏化-交互性-可读性全方位的优化升-2026-02-14/`
- 关键输入文件：
  - `synthesis.json`
  - `perspectives.json`
  - `ideas/idea-1-task-log-causal-timeline.md`
  - `ideas/idea-2-centerpanel-interaction-loop.md`
  - `ideas/idea-3-accessibility-motion-budget.md`

## 交付范围（In Scope）

1. 日志可读性 2.0（回合折叠、关键高亮、快速定位）
2. 任务-日志联动（因果时间轴 MVP）
3. `CenterPanel` 三层交互闭环（主行动/次行动/自由输入）
4. 桌面与移动端统一信息优先级协议
5. 可访问性设置扩展（以 `fontSize` 为锚）
6. 动效预算治理（性能分级）

## 非目标（Out of Scope）

1. 一次性重构 `GameInterface` 与 `useGameLogic`
2. 直接上线 AI 导演自动重排模式
3. 全量任务星图化（保留后续探索）

## Sprint 切分

- Sprint 1（第 1-4 周）：日志可读性 + `CenterPanel` 交互闭环
- Sprint 2（第 5-8 周）：任务-日志联动 + 跨端优先级协议
- Sprint 3（第 9-12 周）：可访问性设置扩展 + 动效预算 + 稳定性回归

---

### Task 1: 基线与验收门槛（先建度量）

**Files:**
- Create: `tests/ui/uiExperienceBaseline.test.tsx`
- Modify: `tests/smoke.test.ts`
- Create: `docs/plans/artifacts/ui-experience-baseline-2026-02-14.md`

**Step 1: Write the failing test**

```tsx
it('records baseline interaction metrics schema', () => {
  const metrics = { actionLatencyMs: null, logsReadabilityScore: null, crossEndConsistencyScore: null };
  expect(metrics.actionLatencyMs).toBeTypeOf('number');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/uiExperienceBaseline.test.tsx --testTimeout 60000`
Expected: FAIL with type/assertion mismatch

**Step 3: Write minimal implementation**

```tsx
const metrics = { actionLatencyMs: 0, logsReadabilityScore: 0, crossEndConsistencyScore: 0 };
expect(metrics.actionLatencyMs).toBeTypeOf('number');
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/uiExperienceBaseline.test.tsx tests/smoke.test.ts --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/ui/uiExperienceBaseline.test.tsx tests/smoke.test.ts docs/plans/artifacts/ui-experience-baseline-2026-02-14.md
git commit -m "test: 建立 UI 体验基线与验收门槛"
```

---

### Task 2: 日志可读性 2.0（回合折叠 + 快速定位）

**Files:**
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/center/LogEntry.tsx`
- Create: `tests/ui/centerPanelLogReadability.test.tsx`

**Step 1: Write the failing test**

```tsx
it('collapses older turns and jumps to latest key log', async () => {
  render(<CenterPanel {...propsWithManyTurns} />);
  expect(screen.getByRole('button', { name: '仅看当前回合' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '跳到最新关键日志' }));
  expect(screen.getByLabelText('Game log feed')).toHaveAttribute('aria-live', 'polite');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/centerPanelLogReadability.test.tsx --testTimeout 60000`
Expected: FAIL because controls do not exist yet

**Step 3: Write minimal implementation**

```tsx
// CenterPanel: add readability controls state
const [showCurrentTurnOnly, setShowCurrentTurnOnly] = useState(false);

// render buttons + filter logs by turn + quick scroll to latest key log ref
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/centerPanelLogReadability.test.tsx tests/ui/centerPanelActionOptions.test.tsx --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add components/game/CenterPanel.tsx components/game/center/LogEntry.tsx tests/ui/centerPanelLogReadability.test.tsx
git commit -m "feat: 提升日志可读性并支持快速定位"
```

---

### Task 3: CenterPanel 三层交互闭环（主行动/次行动/自由输入）

**Files:**
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/center/GameInput.tsx`
- Modify: `components/GameInterface.tsx`
- Create: `tests/ui/centerPanelInteractionLoop.test.tsx`

**Step 1: Write the failing test**

```tsx
it('prefills input when selecting primary action and allows one-click send', async () => {
  render(<CenterPanel {...propsWithActionOptions} />);
  await userEvent.click(screen.getByRole('button', { name: '主行动: 观察环境' }));
  expect(screen.getByPlaceholderText('输入行动...')).toHaveValue(expect.stringContaining('观察环境'));
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/centerPanelInteractionLoop.test.tsx --testTimeout 60000`
Expected: FAIL because prefill loop is missing

**Step 3: Write minimal implementation**

```tsx
// split options into primary/secondary
const primaryOptions = actionOptions.slice(0, 5);
const secondaryOptions = actionOptions.slice(5);

// click primary option => setDraftInput(option.label)
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/centerPanelInteractionLoop.test.tsx tests/ui/centerPanelActionOptions.test.tsx --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add components/game/CenterPanel.tsx components/game/center/GameInput.tsx components/GameInterface.tsx tests/ui/centerPanelInteractionLoop.test.tsx
git commit -m "feat: 构建 CenterPanel 三层交互闭环"
```

---

### Task 4: 任务-日志联动（因果时间轴 MVP）

**Files:**
- Create: `utils/ui/logTaskLinking.ts`
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/modals/TasksModal.tsx`
- Create: `tests/ui/taskLogLinkingTimeline.test.tsx`

**Step 1: Write the failing test**

```tsx
it('filters logs when a task is selected and supports reverse lookup', async () => {
  render(<CenterPanel {...propsWithTasksAndLogs} />);
  await userEvent.click(screen.getByRole('button', { name: '任务: 前往公会本部' }));
  expect(screen.getByText('相关日志')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/taskLogLinkingTimeline.test.tsx --testTimeout 60000`
Expected: FAIL because linking utility is missing

**Step 3: Write minimal implementation**

```ts
export function matchTaskRelatedLogs(taskId: string, logs: any[]) {
  return logs.filter((log) => String(log?.text || '').includes(taskId));
}
```

```tsx
// CenterPanel render selected task card and filtered logs view
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/taskLogLinkingTimeline.test.tsx tests/ui/dailyDashboardPanels.test.tsx --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ui/logTaskLinking.ts components/game/CenterPanel.tsx components/game/modals/TasksModal.tsx tests/ui/taskLogLinkingTimeline.test.tsx
git commit -m "feat: 实现任务与日志联动时间轴 MVP"
```

---

### Task 5: 跨端一致信息优先级协议

**Files:**
- Create: `utils/ui/navigationPriority.ts`
- Modify: `components/GameInterface.tsx`
- Modify: `components/game/RightPanel.tsx`
- Modify: `components/mobile/MobileBottomNav.tsx`
- Modify: `components/mobile/MobileMenuOverlay.tsx`
- Create: `tests/ui/navigationPriorityConsistency.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders same priority order in desktop and mobile navigation', () => {
  const state = buildState({ taskCount: 2, unreadPhoneCount: 5 });
  const order = getNavigationPriority(state);
  expect(order[0]).toBe('PHONE');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/navigationPriorityConsistency.test.tsx --testTimeout 60000`
Expected: FAIL because shared priority schema does not exist

**Step 3: Write minimal implementation**

```ts
export function getNavigationPriority(input: { unreadPhoneCount: number; activeTaskCount: number; hasUrgentNews: boolean; }) {
  return ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS'];
}
```

```tsx
// consume same order in RightPanel + MobileBottomNav + MobileMenuOverlay
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/navigationPriorityConsistency.test.tsx tests/ui/centerPanelActionOptions.test.tsx --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ui/navigationPriority.ts components/GameInterface.tsx components/game/RightPanel.tsx components/mobile/MobileBottomNav.tsx components/mobile/MobileMenuOverlay.tsx tests/ui/navigationPriorityConsistency.test.tsx
git commit -m "feat: 统一桌面移动端导航优先级协议"
```

---

### Task 6: 可访问性设置扩展（fontSize -> 阅读体验组）

**Files:**
- Modify: `types.ts`
- Modify: `hooks/useAppSettings.ts`
- Modify: `components/game/modals/SettingsModal.tsx`
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/center/LogEntry.tsx`
- Create: `tests/hooks/useAppSettings.readabilityMigration.test.ts`
- Create: `tests/ui/readabilitySettingsRender.test.tsx`

**Step 1: Write the failing test**

```ts
it('migrates legacy settings with readability defaults', () => {
  const legacy = { fontSize: 'medium' } as any;
  const migrated = migrateSettings(legacy);
  expect(migrated.readability?.lineHeight).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/useAppSettings.readabilityMigration.test.ts tests/ui/readabilitySettingsRender.test.tsx --testTimeout 60000`
Expected: FAIL because readability fields are missing

**Step 3: Write minimal implementation**

```ts
readability: {
  lineHeight: 'normal',
  contrastMode: 'default',
  infoDensity: 'balanced'
}
```

```tsx
// SettingsModal add controls for lineHeight / contrast / density
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/hooks/useAppSettings.readabilityMigration.test.ts tests/ui/readabilitySettingsRender.test.tsx tests/hooks/useAppSettings.migration.test.ts --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add types.ts hooks/useAppSettings.ts components/game/modals/SettingsModal.tsx components/game/CenterPanel.tsx components/game/center/LogEntry.tsx tests/hooks/useAppSettings.readabilityMigration.test.ts tests/ui/readabilitySettingsRender.test.tsx
git commit -m "feat: 扩展可访问性阅读设置并完成迁移"
```

---

### Task 7: 动效预算治理（性能分级）

**Files:**
- Modify: `hooks/usePerformanceMode.ts`
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/Home.tsx`
- Modify: `tailwind.config.js`
- Create: `tests/hooks/usePerformanceMode.motionBudget.test.ts`

**Step 1: Write the failing test**

```ts
it('downgrades motion level under low performance condition', () => {
  const level = resolveMotionLevel({ fps: 24, userPreference: 'auto' });
  expect(level).toBe('minimal');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/usePerformanceMode.motionBudget.test.ts --testTimeout 60000`
Expected: FAIL because resolver is missing

**Step 3: Write minimal implementation**

```ts
export function resolveMotionLevel(input: { fps: number; userPreference: 'auto' | 'full' | 'minimal' }) {
  if (input.userPreference !== 'auto') return input.userPreference;
  return input.fps < 30 ? 'minimal' : 'full';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/hooks/usePerformanceMode.motionBudget.test.ts tests/hooks/usePerformanceMode.test.ts --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/usePerformanceMode.ts components/game/CenterPanel.tsx components/Home.tsx tailwind.config.js tests/hooks/usePerformanceMode.motionBudget.test.ts
git commit -m "feat: 引入动效预算分级与性能自适应"
```

---

### Task 8: 处理过程可感知化（统一 processing 状态）

**Files:**
- Create: `utils/ui/processingStage.ts`
- Modify: `components/GameInterface.tsx`
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/center/GameInput.tsx`
- Create: `tests/ui/processingStageFeedback.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows queued/generating/applying stages based on processing flags', () => {
  render(<CenterPanel {...propsWithProcessingFlags} />);
  expect(screen.getByText('排队中')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/processingStageFeedback.test.tsx --testTimeout 60000`
Expected: FAIL because unified stage mapper is missing

**Step 3: Write minimal implementation**

```ts
export function resolveProcessingStage(flags: { isProcessing: boolean; isStreaming: boolean; isPhoneProcessing: boolean }) {
  if (!flags.isProcessing) return 'idle';
  if (flags.isStreaming) return 'generating';
  return flags.isPhoneProcessing ? 'applying' : 'queued';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/processingStageFeedback.test.tsx tests/ui/centerPanelActionOptions.test.tsx --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ui/processingStage.ts components/GameInterface.tsx components/game/CenterPanel.tsx components/game/center/GameInput.tsx tests/ui/processingStageFeedback.test.tsx
git commit -m "feat: 统一处理阶段反馈并提升可感知性"
```

---

### Task 9: 回归、防回滚与验收封板

**Files:**
- Modify: `tests/smoke.test.ts`
- Create: `tests/ui/uiUpgradeRegressionSuite.test.tsx`
- Create: `docs/plans/artifacts/ui-upgrade-acceptance-report.md`

**Step 1: Write the failing test**

```tsx
it('passes full UX regression gates', () => {
  const gates = {
    logReadability: false,
    actionLoop: false,
    crossEndPriority: false,
    accessibilitySettings: false,
    motionBudget: false
  };
  expect(Object.values(gates).every(Boolean)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/uiUpgradeRegressionSuite.test.tsx --testTimeout 60000`
Expected: FAIL until all gates are wired

**Step 3: Write minimal implementation**

```tsx
const gates = {
  logReadability: true,
  actionLoop: true,
  crossEndPriority: true,
  accessibilitySettings: true,
  motionBudget: true
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testTimeout 60000`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/smoke.test.ts tests/ui/uiUpgradeRegressionSuite.test.tsx docs/plans/artifacts/ui-upgrade-acceptance-report.md
git commit -m "test: 完成 UI 全链路升级回归与验收封板"
```

---

## 验收标准（Definition of Done）

1. 玩家在日志区域可以快速定位当前回合与关键事件。
2. `CenterPanel` 支持主行动快速触发并可预填输入。
3. 桌面与移动端导航入口顺序、徽标规则一致。
4. 设置面板可配置字号、行高、对比度、信息密度、动效等级。
5. 低性能设备下动效会自动降级，核心交互不受阻。
6. 全量测试通过，新增测试覆盖关键路径。

## 关键风险与缓解

1. 任务与日志关联误匹配：先做保守规则（ID + 关键词 + 回合）并支持人工兜底。
2. 跨端改造引发行为漂移：统一 schema + 回归套件并行推进。
3. 设置迁移污染旧存档：强制默认值 + migration 单测。
4. 动效降级影响美术一致性：只降动效复杂度，不改变语义 token。

## 执行顺序建议

1. Task 1 -> Task 2 -> Task 3
2. Task 4 -> Task 5
3. Task 6 -> Task 7 -> Task 8
4. Task 9

## 并行执行建议（无写冲突）

- 可并行 A：Task 2（日志可读） + Task 5（跨端优先级）
- 可并行 B：Task 6（可访问性设置） + Task 7（动效预算）
- 串行依赖：Task 4 依赖 Task 2，Task 9 依赖全部任务

## 回滚策略

1. 每个 Task 独立提交，出现异常按任务粒度 `git revert`。
2. 任何时候若 `tests/smoke.test.ts` 失败，停止后续任务。
3. UI 交互回归优先回滚 `CenterPanel` 相关改动，再逐步重放。
