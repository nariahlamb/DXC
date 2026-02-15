const fs = require('fs');
const path = require('path');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const discoveryId = `DSC-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
const targetPattern = 'components/**';
const perspectives = ['bug', 'test', 'quality'];
const outputDir = path.join('.workflow', 'issues', 'discoveries', discoveryId);
const perspectiveDir = path.join(outputDir, 'perspectives');
const analyzedAt = now.toISOString();
const filesAnalyzed = 90;

fs.mkdirSync(perspectiveDir, { recursive: true });

const perspectivePayloads = {
  bug: {
    perspective: 'bug',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: 'Fullscreen 状态在请求失败时被错误置为 true',
        priority: 'high',
        category: 'state-sync',
        description: 'requestFullscreen 采用异步 Promise，但当前实现在 Promise resolve 之前就直接 setIsFullscreen(true)。若浏览器拒绝全屏（权限或手势限制），UI 图标会与真实状态不一致。',
        file: 'components/game/TopNav.tsx',
        line: 46,
        snippet: 'setIsFullscreen(true);',
        suggested_issue: '将 isFullscreen 状态更新改为基于 fullscreenchange 事件，且仅在 requestFullscreen 成功后更新。',
        confidence: 0.93
      },
      {
        id: 'F-002',
        title: '未监听 fullscreenchange 导致 ESC 退出后图标状态滞后',
        priority: 'high',
        category: 'event-handling',
        description: '组件只在点击按钮时更新本地状态，未订阅 document.fullscreenElement 变化。用户通过 ESC 或系统手势退出全屏时，按钮图标可能仍显示“退出全屏”。',
        file: 'components/game/TopNav.tsx',
        line: 41,
        snippet: 'const [isFullscreen, setIsFullscreen] = useState(false);',
        suggested_issue: '添加 fullscreenchange 监听并以 document.fullscreenElement 作为单一真实来源。',
        confidence: 0.86
      },
      {
        id: 'F-003',
        title: '存档加载失败时仍强制打开加载弹窗',
        priority: 'medium',
        category: 'error-handling',
        description: 'loadSaveSlots 无错误处理，handleOpenLoadModal 在 finally 中无条件打开弹窗。若读取失败，用户仅看到空列表，缺少错误反馈。',
        file: 'components/Home.tsx',
        line: 69,
        snippet: 'loadSaveSlots().finally(() => {',
        suggested_issue: '为 loadSaveSlots 增加 try/catch，并在失败时显示错误提示且避免误导性打开空弹窗。',
        confidence: 0.79
      },
      {
        id: 'F-004',
        title: '逐字符渲染使用 charAt 可能破坏 emoji 等代理对字符',
        priority: 'medium',
        category: 'text-rendering',
        description: 'charAt 基于 UTF-16 code unit，遇到 emoji 或部分扩展字符时会拆分错误，导致字符显示异常。',
        file: 'components/ui/TypewriterText.tsx',
        line: 11,
        snippet: 'setDisplayedText((prev) => prev + text.charAt(index));',
        suggested_issue: '改用 Array.from(text) 或 grapheme splitter 按用户可见字符粒度渲染。',
        confidence: 0.74
      }
    ]
  },
  test: {
    perspective: 'test',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: '缺少 TopNav 全屏行为测试（成功/失败/ESC 退出）',
        priority: 'high',
        category: 'unit-coverage',
        description: '现有 TopNav 测试仅覆盖仪表盘按钮打开流程，未覆盖 requestFullscreen 失败及 fullscreenchange 同步场景。',
        file: 'components/game/TopNav.tsx',
        line: 43,
        snippet: 'const toggleFullscreen = () => {',
        suggested_issue: '新增 TopNav 单测：mock requestFullscreen/exitFullscreen/fullscreenchange，验证图标状态与真实全屏状态一致。',
        confidence: 0.9
      },
      {
        id: 'F-002',
        title: '缺少 Home 存档读取失败路径测试',
        priority: 'high',
        category: 'error-path-coverage',
        description: 'Home 已覆盖“继续冒险有最新存档”路径，但未覆盖 loadAllSaveSlots/getManagedJson 失败与坏数据分支。',
        file: 'components/Home.tsx',
        line: 68,
        snippet: 'const handleOpenLoadModal = () => {',
        suggested_issue: '补充失败分支测试：loadAllSaveSlots reject、getManagedJson 返回空或损坏数据。',
        confidence: 0.88
      },
      {
        id: 'F-003',
        title: '缺少 TypewriterText 的 Unicode 与定时器清理测试',
        priority: 'medium',
        category: 'edge-case-coverage',
        description: '未发现 TypewriterText 相关测试，无法保障 emoji 文本与组件卸载时 interval 清理行为。',
        file: 'components/ui/TypewriterText.tsx',
        line: 9,
        snippet: 'const timer = setInterval(() => {',
        suggested_issue: '增加 TypewriterText 测试：emoji 字符串渲染正确，卸载后不再触发 setState。',
        confidence: 0.78
      },
      {
        id: 'F-004',
        title: '缺少 SettingsModal 变量编辑器回归测试',
        priority: 'high',
        category: 'integration-coverage',
        description: 'SettingsModal 有 JSON 编辑与错误提示逻辑，但现有测试多为保存/头像保护场景，变量编辑器缺少行为验证。',
        file: 'components/game/modals/SettingsModal.tsx',
        line: 1060,
        snippet: 'const parsed = JSON.parse(jsonEditText);',
        suggested_issue: '新增 SettingsModal 测试：非法 JSON 给出错误，合法 JSON 更新指定变量分类。',
        confidence: 0.82
      }
    ]
  },
  quality: {
    perspective: 'quality',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: '移动端导航使用 console.log 输出异常',
        priority: 'low',
        category: 'logging',
        description: '用户侧异常采用 console.log，缺少统一日志等级与可追踪上下文。',
        file: 'components/mobile/MobileTopNav.tsx',
        line: 35,
        snippet: 'console.log(`Error attempting to enable fullscreen: ${e.message}`);',
        suggested_issue: '改为 console.warn/error 或接入统一日志函数，避免生产噪声。',
        confidence: 0.68
      },
      {
        id: 'F-002',
        title: 'CenterPanel 保留调试日志',
        priority: 'medium',
        category: 'logging',
        description: '压缩头像流程中存在调试日志，长期会污染控制台并影响问题定位效率。',
        file: 'components/game/CenterPanel.tsx',
        line: 115,
        snippet: "console.log('[AvatarUpload] Compressed size:', compressed.length);",
        suggested_issue: '移除调试日志，或以 debug 开关控制输出。',
        confidence: 0.72
      },
      {
        id: 'F-003',
        title: '使用 JSON 深拷贝默认配置，易引入隐式类型丢失',
        priority: 'high',
        category: 'data-integrity',
        description: 'JSON.parse(JSON.stringify(...)) 会丢失 undefined、Date、函数等信息，后续配置结构扩展时容易出现隐蔽问题。',
        file: 'components/game/modals/SettingsModal.tsx',
        line: 473,
        snippet: 'const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;',
        suggested_issue: '改为结构化克隆（structuredClone）或显式字段构建，避免非 JSON 字段丢失。',
        confidence: 0.84
      },
      {
        id: 'F-004',
        title: 'CombatPanel 核心交互参数广泛使用 any',
        priority: 'medium',
        category: 'type-safety',
        description: 'onPlayerAction 与 payload 使用 any，会削弱编译期约束并掩盖命令结构错误。',
        file: 'components/game/CombatPanel.tsx',
        line: 24,
        snippet: "onPlayerAction: (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => void;",
        suggested_issue: '为战斗动作定义判别联合类型（discriminated union）并替换 any。',
        confidence: 0.88
      },
      {
        id: 'F-005',
        title: 'CharacterCreation 组件内部 props 类型过宽',
        priority: 'low',
        category: 'type-safety',
        description: '展示组件使用 any 破坏了可读性和 IDE 提示，后续重构风险较高。',
        file: 'components/CharacterCreation.tsx',
        line: 347,
        snippet: 'const SectionTitle = ({ icon, title, theme }: { icon: React.ReactNode, title: string, theme: any }) => (',
        suggested_issue: '为 theme 和展示型组件 props 建立明确类型接口。',
        confidence: 0.76
      },
      {
        id: 'F-006',
        title: 'MobileTopNav 存在未使用的全屏状态与处理函数',
        priority: 'medium',
        category: 'dead-code',
        description: 'isFullscreen 和 toggleFullscreen 已定义但在 JSX 中未使用，属于残留逻辑，增加维护负担。',
        file: 'components/mobile/MobileTopNav.tsx',
        line: 30,
        snippet: 'const [isFullscreen, setIsFullscreen] = useState(false);',
        suggested_issue: '若不再支持移动端全屏，删除残留逻辑；若需要支持，补充 UI 入口并加测试。',
        confidence: 0.91
      }
    ]
  }
};

for (const perspective of perspectives) {
  const p = perspectivePayloads[perspective];
  fs.writeFileSync(
    path.join(perspectiveDir, `${perspective}.json`),
    JSON.stringify(p, null, 2) + '\n',
    'utf8'
  );
}

const baseScore = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };
const rank = { critical: 4, high: 3, medium: 2, low: 1 };

const allFindings = [];
for (const perspective of perspectives) {
  for (const finding of perspectivePayloads[perspective].findings) {
    const score = Number((baseScore[finding.priority] * finding.confidence).toFixed(3));
    allFindings.push({
      ...finding,
      perspective,
      priority_score: score,
      dedupe_key: `${finding.file}:${finding.line}`
    });
  }
}

const dedupedMap = new Map();
for (const finding of allFindings) {
  const existing = dedupedMap.get(finding.dedupe_key);
  if (!existing) {
    dedupedMap.set(finding.dedupe_key, finding);
    continue;
  }
  if (finding.priority_score > existing.priority_score) {
    dedupedMap.set(finding.dedupe_key, finding);
    continue;
  }
  if (finding.priority_score === existing.priority_score && rank[finding.priority] > rank[existing.priority]) {
    dedupedMap.set(finding.dedupe_key, finding);
  }
}

const dedupedFindings = Array.from(dedupedMap.values()).sort((a, b) => b.priority_score - a.priority_score);

const issues = dedupedFindings.filter((f) => {
  if (f.priority === 'critical' || f.priority === 'high') return true;
  if (f.priority_score >= 0.7) return true;
  if (f.priority === 'medium' && f.confidence >= 0.9) return true;
  return false;
}).map((f, i) => ({
  id: `ISS-${discoveryId}-${String(i + 1).padStart(3, '0')}`,
  discovery_id: discoveryId,
  title: f.suggested_issue,
  priority: f.priority,
  priority_score: f.priority_score,
  perspective: f.perspective,
  category: `${f.perspective}/${f.category}`,
  file: f.file,
  line: f.line,
  description: f.description,
  source_finding_id: f.id,
  confidence: f.confidence
}));

const jsonl = issues.map((issue) => JSON.stringify(issue)).join('\n');
fs.writeFileSync(path.join(outputDir, 'discovery-issues.jsonl'), jsonl + (jsonl ? '\n' : ''), 'utf8');

const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of dedupedFindings) distribution[f.priority] += 1;

const state = {
  discovery_id: discoveryId,
  target_pattern: targetPattern,
  phase: 'complete',
  created_at: analyzedAt,
  updated_at: new Date().toISOString(),
  perspectives,
  results: {
    total_findings: dedupedFindings.length,
    issues_generated: issues.length,
    priority_distribution: {
      critical: distribution.critical,
      high: distribution.high,
      medium: distribution.medium,
      low: distribution.low
    }
  }
};

fs.writeFileSync(path.join(outputDir, 'discovery-state.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');

const topFindings = dedupedFindings.slice(0, 5);
const summaryLines = [
  `# Discovery Summary: ${discoveryId}`,
  '',
  `**Target**: ${targetPattern}`,
  `**Perspectives**: ${perspectives.join(', ')}`,
  `**Total Findings**: ${dedupedFindings.length}`,
  `**Issues Generated**: ${issues.length}`,
  '',
  '## Priority Breakdown',
  `- Critical: ${distribution.critical}`,
  `- High: ${distribution.high}`,
  `- Medium: ${distribution.medium}`,
  `- Low: ${distribution.low}`,
  '',
  '## Top Findings',
  ''
];

if (topFindings.length === 0) {
  summaryLines.push('No issues found.');
} else {
  topFindings.forEach((f, idx) => {
    summaryLines.push(`${idx + 1}. **[${f.priority.toUpperCase()}] ${f.title}**`);
    summaryLines.push(`   Category: ${f.perspective}/${f.category}`);
    summaryLines.push(`   Location: ${f.file}:${f.line}`);
    summaryLines.push(`   Score: ${f.priority_score} (confidence ${f.confidence})`);
    summaryLines.push('');
  });
}

summaryLines.push('## Next Steps');
summaryLines.push('- 运行 `/issue:plan` 为高优先级问题生成修复计划。');
summaryLines.push('- 使用 `ccw view` 在面板中查看分视角 findings 与 issue 候选。');
summaryLines.push('- 先处理 Fullscreen 状态同步与 Home 存档错误路径，这两项风险最高。');
summaryLines.push('');

fs.writeFileSync(path.join(outputDir, 'summary.md'), summaryLines.join('\n'), 'utf8');

const returnSummary = {
  discovery_id: discoveryId,
  target_pattern: targetPattern,
  perspectives_analyzed: perspectives,
  total_findings: dedupedFindings.length,
  issues_generated: issues.length,
  priority_distribution: {
    critical: distribution.critical,
    high: distribution.high,
    medium: distribution.medium
  }
};

console.log(JSON.stringify({ output_dir: outputDir, summary: returnSummary }, null, 2));
