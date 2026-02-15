const fs = require('fs');
const path = require('path');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const discoveryId = `DSC-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
const targetPattern = 'hooks/gameLogic/**,utils/ai*.ts,utils/memory/**,utils/taverndb/**';
const perspectives = ['performance', 'bug', 'test', 'quality', 'maintainability'];
const outputDir = path.join('.workflow', 'issues', 'discoveries', discoveryId);
const perspectiveDir = path.join(outputDir, 'perspectives');
const analyzedAt = now.toISOString();
const filesAnalyzed = 119;

fs.mkdirSync(perspectiveDir, { recursive: true });

const perspectivePayloads = {
  performance: {
    perspective: 'performance',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: '流式回调重复传递 fullText，放大渲染与字符串复制开销',
        priority: 'high',
        category: 'streaming-render',
        description: '流式阶段每次 emit 都传整段 fullText，UI 侧再整体 setState，文本越长成本越高，容易出现对话生成过程卡顿。',
        file: 'utils/aiDispatch.ts',
        line: 218,
        snippet: 'emitter.emit(fullText);',
        suggested_issue: '将流式回调改为增量 chunk 协议（delta），并在 UI 端按增量拼接，避免反复全量拷贝。',
        confidence: 0.95
      },
      {
        id: 'F-002',
        title: '流式展示阶段每次都写入整段响应文本',
        priority: 'high',
        category: 'state-update-frequency',
        description: '上层 onStream 回调直接 setLastAIResponse(chunk)，其中 chunk 为全量文本；长输出时 React 重渲染压力明显。',
        file: 'hooks/gameLogic/useGameLogicCore.ts',
        line: 7575,
        snippet: 'setLastAIResponse(chunk);',
        suggested_issue: '将 `lastAIResponse` 的更新策略切换为增量 append + requestAnimationFrame 节流。',
        confidence: 0.91
      },
      {
        id: 'F-003',
        title: '每次构建记忆上下文都执行全表投影 + 搜索行构建',
        priority: 'high',
        category: 'prompt-assembly-cost',
        description: '构建 MEMORY_CONTEXT 时同步执行投影与检索，且位于主 Prompt 组装路径，回合频繁时会直接抬高首 token 延迟。',
        file: 'utils/aiContext.ts',
        line: 808,
        snippet: 'const projectedTables = projectGameStateToTavernTables(gameState, {',
        suggested_issue: '为记忆召回加入异步缓存层和脏标记，避免每轮全量投影。',
        confidence: 0.9
      },
      {
        id: 'F-004',
        title: 'state 微服务输入负载过大，增加模型响应时延',
        priority: 'high',
        category: 'payload-size',
        description: 'state 服务输入直接塞入 角色/任务/背包/战斗等大对象，且 JSON pretty-print 输出，token 体积和序列化成本偏高。',
        file: 'hooks/gameLogic/useGameLogicCore.ts',
        line: 4331,
        snippet: 'payload.角色 = state.角色 || {};',
        suggested_issue: '对 state 服务输入做字段白名单与压缩序列化，减少非必要上下文。',
        confidence: 0.88
      },
      {
        id: 'F-005',
        title: '微服务队列单 worker 串行执行，存在队头阻塞',
        priority: 'high',
        category: 'queue-throughput',
        description: '队列采用单线程串行 await next.task()，当 memory 请求慢时会拖住后续 state/world 任务。',
        file: 'utils/microserviceQueue.ts',
        line: 78,
        snippet: 'await next.task();',
        suggested_issue: '为不同服务引入并发槽或独立队列，减少 memory 慢请求对其它服务的阻塞。',
        confidence: 0.9
      },
      {
        id: 'F-006',
        title: 'memory 并行分表失败后回退会追加二次完整请求',
        priority: 'medium',
        category: 'fallback-latency',
        description: '分表结果不匹配时会再触发一次完整 memory 请求，异常场景下请求数翻倍，加重卡顿。',
        file: 'hooks/gameLogic/useGameLogicCore.ts',
        line: 5778,
        snippet: "const fallback = await generateServiceCommands('memory', input, stateSnapshot, settings, signal);",
        suggested_issue: '优先复用已成功分表结果，仅对缺失 sheet 重试，避免全量回退。',
        confidence: 0.83
      }
    ]
  },
  bug: {
    perspective: 'bug',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: '尾随逗号修复使用正则，可能误伤字符串内容',
        priority: 'medium',
        category: 'json-repair',
        description: '正则替换未感知字符串上下文，若文本中出现类似 `,}` 片段，修复过程可能改写原始内容。',
        file: 'utils/aiJson.ts',
        line: 79,
        snippet: "const repaired = rawText.replace(/,\\s*([}\\]])/g, '$1');",
        suggested_issue: '改用基于 token 的 JSON 容错修复器，避免正则级误修。',
        confidence: 0.77
      },
      {
        id: 'F-002',
        title: 'tavern_commands 的 regex fallback 无法处理嵌套数组',
        priority: 'high',
        category: 'command-extraction',
        description: '`\"tavern_commands\":\s*(\[[^\]]*\])` 只匹配到首个 `]`，命令里有数组字段时容易截断，导致指令丢失。',
        file: 'utils/aiJson.ts',
        line: 279,
        snippet: 'const match = rawText.match(/"tavern_commands"\s*:\s*(\[[^\]]*\])/);',
        suggested_issue: '替换为括号平衡提取器，确保嵌套结构下命令数组完整。',
        confidence: 0.9
      },
      {
        id: 'F-003',
        title: '投影缓存 key 对 shadowRows 仅比较行数，可能返回陈旧数据',
        priority: 'medium',
        category: 'cache-staleness',
        description: '同长度行内容修改且未更新 sheetVersion 时，cache key 不变，记忆检索可能读取旧投影。',
        file: 'utils/taverndb/tableProjection.ts',
        line: 44,
        snippet: '.map((sheetId) => `${sheetId}:${Array.isArray(shadowRows[sheetId]) ? shadowRows[sheetId].length : 0}`)',
        suggested_issue: '为 shadowRows 增加内容哈希或强制版本号推进，规避同长度变更漏失效。',
        confidence: 0.75
      },
      {
        id: 'F-004',
        title: 'memory 分表结果只要数量不配对就整体丢弃有效结果',
        priority: 'high',
        category: 'memory-pairing',
        description: '当前策略在 summary/outline 数量不等时直接触发全量 fallback，已生成的有效配对不会被复用。',
        file: 'hooks/gameLogic/useGameLogicCore.ts',
        line: 5777,
        snippet: 'if (summaryCommands.length === 0 || outlineCommands.length === 0 || summaryCommands.length !== outlineCommands.length) {',
        suggested_issue: '保留已配对成功的命令，缺失部分按 turn 精确补齐，避免全量回退。',
        confidence: 0.87
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
        title: '表格召回块直接注入整行 JSON，易导致 Prompt 噪声与格式漂移',
        priority: 'medium',
        category: 'prompt-format',
        description: '命中行直接 JSON.stringify 注入上下文，长字段或嵌套对象会扩大噪声，影响模型输出格式稳定性。',
        file: 'utils/memory/tavernTableRetriever.ts',
        line: 109,
        snippet: 'output += `  ${JSON.stringify(hit.row.row)}\\n`;',
        suggested_issue: '为召回内容增加字段白名单和长度裁剪，只保留高价值列。',
        confidence: 0.84
      },
      {
        id: 'F-002',
        title: '解析候选兜底到 parsedCandidates[0]，缺少结构化 schema 校验',
        priority: 'medium',
        category: 'response-validation',
        description: '当核心字段缺失时仍可能接受非预期对象，后续流程依赖再兜底，增加内容格式不确定性。',
        file: 'utils/aiJson.ts',
        line: 144,
        snippet: '|| parsedCandidates[0];',
        suggested_issue: '在 parse 阶段引入最小 schema 校验，拒绝无效主响应结构。',
        confidence: 0.73
      }
    ]
  },
  maintainability: {
    perspective: 'maintainability',
    analyzed_at: analyzedAt,
    files_analyzed: filesAnalyzed,
    findings: [
      {
        id: 'F-001',
        title: 'useGameLogicCore 责任过重，微服务编排与状态落盘高度耦合',
        priority: 'high',
        category: 'module-coupling',
        description: '同一模块同时承担输入构建、服务编排、命令过滤、事务应用和回滚策略，定位“卡顿 + 格式 + 记忆表”问题成本高。',
        file: 'hooks/gameLogic/useGameLogicCore.ts',
        line: 4119,
        snippet: 'const buildServiceInput = (',
        suggested_issue: '拆分为 input-builder / service-runner / command-guard / apply-transaction 子模块。',
        confidence: 0.86
      },
      {
        id: 'F-002',
        title: 'tableProjection 同时承担投影、缓存、检索文本构建，边界不清晰',
        priority: 'medium',
        category: 'separation-of-concerns',
        description: '表投影与检索行构造耦合在一个模块中，后续优化缓存或检索算法时修改面过大。',
        file: 'utils/taverndb/tableProjection.ts',
        line: 1516,
        snippet: 'export const projectGameStateToTavernTables = (',
        suggested_issue: '拆分 projection/cache/search-index 三层，降低后续性能优化改动半径。',
        confidence: 0.78
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
        title: '缺少流式增量渲染语义测试',
        priority: 'high',
        category: 'coverage-gap',
        description: '当前 aiDispatch 测试仅覆盖 timeout/abort，未覆盖 onStream 在长文本场景的调用语义与性能回归。',
        file: 'tests/aiDispatch.test.ts',
        line: 97,
        snippet: "describe('dispatchAIRequest timeout and abort', () => {",
        suggested_issue: '新增 stream 行为测试：验证 delta/fullText 语义、调用频率和最终 flush 一致性。',
        confidence: 0.92
      },
      {
        id: 'F-002',
        title: 'aiJson 解析核心逻辑缺少直接单测',
        priority: 'high',
        category: 'parser-coverage',
        description: '现有 memory retry 测试 mock 掉 extractServiceCommands，无法发现真实解析路径中的格式回归。',
        file: 'tests/aiServices.memoryRetry.test.ts',
        line: 12,
        snippet: "vi.mock('../utils/aiJson', async (importOriginal) => {",
        suggested_issue: '新增 aiJson 单测覆盖：嵌套数组命令、SSE 包装、repair path 与错误输入。',
        confidence: 0.89
      },
      {
        id: 'F-003',
        title: '微服务队列缺少并发与优先级行为测试',
        priority: 'medium',
        category: 'queue-coverage',
        description: 'createMicroserviceQueue 为关键调度器，但未见对应测试，队头阻塞或优先级反转风险不可见。',
        file: 'utils/microserviceQueue.ts',
        line: 13,
        snippet: 'export const createMicroserviceQueue = () => {',
        suggested_issue: '新增队列测试：优先级顺序、慢任务阻塞、drain 行为与异常隔离。',
        confidence: 0.9
      },
      {
        id: 'F-004',
        title: 'tableProjection 仅覆盖“版本号变更失效”，缺少同长度内容变更场景',
        priority: 'medium',
        category: 'cache-coverage',
        description: '现有缓存测试依赖 sheetVersion 手动递增，未覆盖 row 内容变化但长度不变时的潜在陈旧命中。',
        file: 'tests/taverndb/tableProjection.test.ts',
        line: 205,
        snippet: "it('invalidates projection cache when sheet version changes', () => {",
        suggested_issue: '补充同长度变更测试，验证 cache key 是否会误命中旧投影。',
        confidence: 0.86
      }
    ]
  }
};

for (const perspective of perspectives) {
  const payload = perspectivePayloads[perspective];
  fs.writeFileSync(path.join(perspectiveDir, `${perspective}.json`), JSON.stringify(payload, null, 2) + '\n', 'utf8');
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

const jsonl = issues.map((item) => JSON.stringify(item)).join('\n');
fs.writeFileSync(path.join(outputDir, 'discovery-issues.jsonl'), jsonl + (jsonl ? '\n' : ''), 'utf8');

const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
for (const item of dedupedFindings) distribution[item.priority] += 1;

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

const summaryLines = [
  `# Discovery Summary: ${discoveryId}`,
  '',
  `**Target**: ${targetPattern}`,
  `**Perspectives**: ${perspectives.join(', ')}`,
  `**Total Findings**: ${dedupedFindings.length}`,
  `**Issues Generated**: ${issues.length}`,
  '',
  '## Focus Areas',
  '- 对话生成卡顿（stream + prompt 体积 + 队列阻塞）',
  '- 输出内容格式稳定性（JSON 解析与修复链路）',
  '- 全局记忆表格适配（LOG_Summary/LOG_Outline 与投影缓存）',
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

dedupedFindings.slice(0, 8).forEach((f, idx) => {
  summaryLines.push(`${idx + 1}. **[${f.priority.toUpperCase()}] ${f.title}**`);
  summaryLines.push(`   Category: ${f.perspective}/${f.category}`);
  summaryLines.push(`   Location: ${f.file}:${f.line}`);
  summaryLines.push(`   Score: ${f.priority_score} (confidence ${f.confidence})`);
  summaryLines.push('');
});

summaryLines.push('## Next Steps');
summaryLines.push('- 先修复 streaming 增量协议与微服务队列阻塞，直接改善“对话卡顿”。');
summaryLines.push('- 再修复 aiJson 命令提取与 schema 校验，稳定“内容格式”。');
summaryLines.push('- 最后补齐 tableProjection 缓存与 memory 配对的回归测试。');
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
