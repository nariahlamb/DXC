const fs = require('fs');
const path = require('path');

const readTrim = (p) => fs.readFileSync(p, 'utf8').trim();

const discoveryId = readTrim(path.join('.tmp', 'current_discovery_id.txt'));
const outDir = readTrim(path.join('.tmp', 'current_discovery_dir.txt'));
const perspectivesDir = path.join(outDir, 'perspectives');
fs.mkdirSync(perspectivesDir, { recursive: true });

const now = new Date().toISOString();
const targetPattern = 'components/**, hooks/**, utils/**, adapters/**, prompts/**, types/**, App.tsx, index.tsx';
const filesAnalyzed = 192;

const perspectiveData = {
  bug: [
    {
      id: 'F-001',
      title: 'Home 页面传入空头像导致无效图片请求',
      priority: 'high',
      category: 'invalid-image-src',
      description: 'Home 将 avatarUrl 固定传空字符串，SettingsModal 无条件渲染 <img src={avatarPreview}>，测试运行也出现空 src 警告。',
      file: 'components/Home.tsx',
      line: 110,
      snippet: 'avatarUrl=""',
      suggested_issue: '在 SettingsModal 渲染头像前增加非空校验，并避免在 Home 传递空字符串头像。',
      confidence: 0.96,
    },
    {
      id: 'F-002',
      title: '主菜单设置中的变量编辑会意外触发开局',
      priority: 'high',
      category: 'callback-miswire',
      description: 'Home 将 SettingsModal 的 onUpdateGameState 绑定为 onStart。点击“应用修改”会直接进入游戏，和设置预期不一致。',
      file: 'components/Home.tsx',
      line: 117,
      snippet: 'onUpdateGameState={(newState) => onStart(newState)}',
      suggested_issue: '将 Home 场景下 onUpdateGameState 改为仅更新预览状态，避免直接调用 onStart。',
      confidence: 0.95,
    },
    {
      id: 'F-003',
      title: '主菜单设置中的“保存”按钮为静默空操作',
      priority: 'medium',
      category: 'dead-action',
      description: 'Home 传给 SettingsModal 的 onSaveGame 是空函数，UI 仍展示“保存”按钮，用户点击后无实际持久化行为。',
      file: 'components/Home.tsx',
      line: 112,
      snippet: 'onSaveGame={() => {}}',
      suggested_issue: '在 Home 场景提供真实保存实现，或在该场景隐藏/禁用保存按钮并提示不可用。',
      confidence: 0.91,
    },
    {
      id: 'F-004',
      title: '性能模式检测在非浏览器上下文缺少保护',
      priority: 'high',
      category: 'runtime-environment-guard',
      description: 'detectPerformanceMode 直接读取 navigator，getStoredMode 直接读 localStorage，在 SSR/预渲染或受限环境可能抛错。',
      file: 'hooks/usePerformanceMode.ts',
      line: 19,
      snippet: 'const nav = navigator as any;',
      suggested_issue: '在读取 navigator/localStorage 前加入 typeof window 判定与异常兜底。',
      confidence: 0.88,
    },
    {
      id: 'F-005',
      title: '打开读档弹窗的异步失败可能产生未处理拒绝',
      priority: 'medium',
      category: 'async-error-handling',
      description: 'handleOpenLoadModal 仅使用 finally 打开弹窗，若 loadSaveSlots 抛错会形成未处理 Promise rejection，且用户无错误提示。',
      file: 'components/Home.tsx',
      line: 63,
      snippet: 'loadSaveSlots().finally(() => { setIsLoadModalOpen(true); });',
      suggested_issue: '改为 try/catch 或 .catch(...)，并向用户显示读档失败原因。',
      confidence: 0.86,
    },
  ],
  test: [
    {
      id: 'F-001',
      title: 'InventoryModal 测试是占位实现且无断言',
      priority: 'high',
      category: 'missing-assertions',
      description: '测试文件保留 TODO 与注释掉的 render/expect，当前用例始终通过，无法覆盖真实行为。',
      file: 'components/game/modals/InventoryModal.test.tsx',
      line: 5,
      snippet: '// TODO: Configure Vitest or Jest to run these tests.',
      suggested_issue: '替换为真实渲染测试，至少覆盖打开、关闭、使用/装备交互。',
      confidence: 0.98,
    },
    {
      id: 'F-002',
      title: 'SocialPhoneModal 核心流程缺少组件测试',
      priority: 'high',
      category: 'missing-core-ui-tests',
      description: 'SocialPhoneModal.tsx 体量大且交互复杂（聊天、联系人、帖子），未发现对应测试文件。',
      file: 'components/game/modals/SocialPhoneModal.tsx',
      line: 56,
      snippet: 'export const SocialPhoneModal: React.FC<SocialPhoneModalProps> = ({',
      suggested_issue: '新增 SocialPhoneModal 关键路径测试：线程切换、发送消息、回复流转与筛选。',
      confidence: 0.9,
    },
    {
      id: 'F-003',
      title: 'MapModal 地图交互缺少自动化覆盖',
      priority: 'medium',
      category: 'missing-interaction-tests',
      description: '地图模块涉及缩放、居中与楼层切换，当前未发现对应测试，重构后容易出现交互回归。',
      file: 'components/game/modals/MapModal.tsx',
      line: 1,
      snippet: 'import React, { useEffect, useMemo, useRef, useState } from "react";',
      suggested_issue: '补充 MapModal 交互测试：初始定位、楼层切换、玩家居中与按钮行为。',
      confidence: 0.88,
    },
    {
      id: 'F-004',
      title: 'DynamicWorldModal 缺少状态筛选与渲染测试',
      priority: 'medium',
      category: 'missing-feature-tests',
      description: '动态世界面板包含多过滤条件与长列表渲染，未发现对应测试覆盖。',
      file: 'components/game/modals/DynamicWorldModal.tsx',
      line: 1,
      snippet: 'import React, { useMemo, useState } from "react";',
      suggested_issue: '增加 DynamicWorldModal 的筛选逻辑和空态/边界数据测试。',
      confidence: 0.85,
    },
    {
      id: 'F-005',
      title: 'SettingsModal 测试存在 act 警告与噪声日志',
      priority: 'medium',
      category: 'test-stability',
      description: 'Vitest 运行出现“update not wrapped in act(...)”与空 src 警告，说明测试对异步状态变化等待不足。',
      file: 'components/game/modals/SettingsModal.test.tsx',
      line: 44,
      snippet: 'render(<SettingsModal {...createProps({ initialView: "STORAGE" })} />);',
      suggested_issue: '使用 waitFor/act 包裹异步状态变化，并修正触发 warning 的输入数据。',
      confidence: 0.9,
    },
  ],
  quality: [
    {
      id: 'F-001',
      title: 'useGameLogic 文件过大且类型逃逸严重',
      priority: 'high',
      category: 'complexity-hotspot',
      description: 'useGameLogic.ts 约 8805 行，any 使用约 343 处，单文件承载过多职责，变更成本高。',
      file: 'hooks/useGameLogic.ts',
      line: 513,
      snippet: 'export const useGameLogic = (initialState?: GameState, onExitCb?: () => void) => {',
      suggested_issue: '按领域拆分 hook（存储、AI、战斗、社交）并减少 any。',
      confidence: 0.95,
    },
    {
      id: 'F-002',
      title: 'extendedCommands 过度集中导致维护风险',
      priority: 'high',
      category: 'god-module',
      description: 'extendedCommands.ts 约 4365 行，any 使用约 385 处，命令处理、校验、数据转换混合在同一模块。',
      file: 'hooks/gameLogic/extendedCommands.ts',
      line: 1,
      snippet: 'import type { GameState } from "../../types/gamestate";',
      suggested_issue: '按命令域拆分模块（combat/social/storage），并抽离公共校验与转换层。',
      confidence: 0.94,
    },
    {
      id: 'F-003',
      title: 'tableProjection 复杂度高且弱类型较多',
      priority: 'medium',
      category: 'weak-typing',
      description: 'tableProjection.ts 约 1460 行，any 使用约 85 处，投影规则扩展时容易引入隐式类型错误。',
      file: 'utils/taverndb/tableProjection.ts',
      line: 1,
      snippet: 'import type { GameState } from "../../types/gamestate";',
      suggested_issue: '分离投影子模块并为核心映射结构补充显式类型。',
      confidence: 0.89,
    },
    {
      id: 'F-004',
      title: '联系人“在场判定”逻辑重复',
      priority: 'medium',
      category: 'duplication',
      description: 'isContactNearby 在 SocialPhoneModal 与 ContactsView 中重复实现，规则变更容易出现行为不一致。',
      file: 'components/game/modals/SocialPhoneModal.tsx',
      line: 244,
      snippet: 'const isContactNearby = (c: Confidant) => c.是否在场 || (c as any).当前状态 === "在场";',
      suggested_issue: '抽取为共享工具函数并补充单元测试。',
      confidence: 0.92,
    },
    {
      id: 'F-005',
      title: '技能消耗格式化逻辑重复',
      priority: 'medium',
      category: 'duplication',
      description: 'formatCost 在 CharacterView 与 SkillsContent 重复定义，维护时容易出现格式差异。',
      file: 'components/game/views/CharacterView.tsx',
      line: 60,
      snippet: 'const formatCost = (cost: any) => {',
      suggested_issue: '统一提取到共享 formatter（如 utils/skillFormat.ts）。',
      confidence: 0.9,
    },
  ],
};

for (const [name, findings] of Object.entries(perspectiveData)) {
  const data = {
    perspective: name,
    analyzed_at: now,
    files_analyzed: filesAnalyzed,
    findings,
  };
  fs.writeFileSync(path.join(perspectivesDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const weights = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };
const allFindings = [];
for (const [perspective, findings] of Object.entries(perspectiveData)) {
  for (const f of findings) allFindings.push({ ...f, perspective });
}

const dedup = new Map();
for (const f of allFindings) {
  const key = `${f.file}:${f.line}`;
  const score = (weights[f.priority] || 0) * f.confidence;
  const prev = dedup.get(key);
  if (!prev || score > prev.score) dedup.set(key, { finding: f, score });
}

const dedupFindings = Array.from(dedup.values()).map((x) => x.finding);
const scored = dedupFindings
  .map((f) => ({ finding: f, score: Number((((weights[f.priority] || 0) * f.confidence)).toFixed(4)) }))
  .sort((a, b) => b.score - a.score);

const issues = [];
let issueIndex = 1;
for (const item of scored) {
  const f = item.finding;
  const isIssue =
    f.priority === 'critical' ||
    f.priority === 'high' ||
    item.score >= 0.7 ||
    (f.priority === 'medium' && f.confidence >= 0.9);

  if (!isIssue) continue;
  issues.push({
    id: `ISS-${discoveryId}-${String(issueIndex).padStart(3, '0')}`,
    discovery_id: discoveryId,
    title: f.title,
    priority: f.priority,
    perspective: f.perspective,
    category: f.category,
    description: f.description,
    file: f.file,
    line: f.line,
    snippet: f.snippet,
    suggested_issue: f.suggested_issue,
    confidence: f.confidence,
    priority_score: item.score,
  });
  issueIndex += 1;
}

const priorityDistribution = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of dedupFindings) {
  if (priorityDistribution[f.priority] !== undefined) priorityDistribution[f.priority] += 1;
}

const issuesPath = path.join(outDir, 'discovery-issues.jsonl');
const jsonl = issues.map((x) => JSON.stringify(x)).join('\n');
fs.writeFileSync(issuesPath, jsonl ? `${jsonl}\n` : '', 'utf8');

const state = {
  discovery_id: discoveryId,
  target_pattern: targetPattern,
  phase: 'complete',
  created_at: now,
  updated_at: now,
  perspectives: ['bug', 'test', 'quality'],
  results: {
    total_findings: dedupFindings.length,
    issues_generated: issues.length,
    priority_distribution: priorityDistribution,
  },
};
fs.writeFileSync(path.join(outDir, 'discovery-state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');

const summary = `# Discovery Summary: ${discoveryId}

**Target**: ${targetPattern}
**Perspectives**: bug, test, quality
**Total Findings**: ${dedupFindings.length}
**Issues Generated**: ${issues.length}

## Priority Breakdown
- Critical: ${priorityDistribution.critical}
- High: ${priorityDistribution.high}
- Medium: ${priorityDistribution.medium}
- Low: ${priorityDistribution.low}

## Top Findings

1. **[High] 主菜单设置中的变量编辑会意外触发开局**
   Category: bug/callback-miswire
   File: components/Home.tsx:117

2. **[High] Home 页面传入空头像导致无效图片请求**
   Category: bug/invalid-image-src
   File: components/Home.tsx:110

3. **[High] useGameLogic 文件过大且类型逃逸严重**
   Category: quality/complexity-hotspot
   File: hooks/useGameLogic.ts:513

4. **[High] InventoryModal 测试是占位实现且无断言**
   Category: test/missing-assertions
   File: components/game/modals/InventoryModal.test.tsx:5

## Next Steps
- 运行 /issue:plan 为高优先级 issue 生成修复计划
- 使用 ccw view 在 dashboard 中查看 discovery 结果
- 优先处理 Home 设置回调错配与空头像 src 两个用户可感知问题
`;
fs.writeFileSync(path.join(outDir, 'summary.md'), summary, 'utf8');

console.log(`discovery_id=${discoveryId}`);
console.log(`out_dir=${outDir}`);
console.log(`total_findings=${dedupFindings.length}`);
console.log(`issues_generated=${issues.length}`);
console.log(`priority_distribution=${JSON.stringify(priorityDistribution)}`);
