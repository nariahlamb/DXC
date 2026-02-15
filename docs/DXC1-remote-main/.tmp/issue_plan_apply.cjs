const fs = require('fs');
const path = require('path');

const root = process.cwd();
const discoveryId = 'DSC-20260213-143958';
const issuesPath = path.join(root, '.workflow', 'issues', 'discoveries', discoveryId, 'discovery-issues.jsonl');
const solutionsDir = path.join(root, '.workflow', 'issues', 'solutions');
const historyPath = path.join(root, '.workflow', 'issues', 'issue-history.jsonl');
const activeIssuesPath = path.join(root, '.workflow', 'issues', 'issues.jsonl');

if (!fs.existsSync(issuesPath)) {
  throw new Error(`Missing discovery issues: ${issuesPath}`);
}
fs.mkdirSync(solutionsDir, { recursive: true });

const lines = fs.readFileSync(issuesPath, 'utf8').split(/\r?\n/).filter(Boolean);
const issues = lines.map((line) => JSON.parse(line));
const now = new Date().toISOString();

const existingHistoryIds = new Set(
  (fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8').split(/\r?\n/).filter(Boolean) : [])
    .map((line) => {
      try { return JSON.parse(line).id; } catch { return null; }
    })
    .filter(Boolean)
);

const existingActiveIds = new Set(
  (fs.existsSync(activeIssuesPath) ? fs.readFileSync(activeIssuesPath, 'utf8').split(/\r?\n/).filter(Boolean) : [])
    .map((line) => {
      try { return JSON.parse(line).id; } catch { return null; }
    })
    .filter(Boolean)
);

const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };

const makeSuffix = (issueId) => {
  const m = String(issueId).match(/-(\d+)$/);
  return m ? m[1] : String(issueId).slice(-4);
};

const createdSolutions = [];
const appendedHistory = [];
const appendedActive = [];

for (const issue of issues) {
  const issueId = issue.id;
  const suffix = makeSuffix(issueId);
  const solutionId = `SOL-${issueId}-${suffix}`;
  const solutionObj = {
    id: solutionId,
    description: issue.title,
    approach: `围绕 ${issue.category} 进行最小可回归改动，先补测试再修复实现，避免引入行为漂移。`,
    tasks: [
      {
        id: 'T1',
        title: 'Define failing test cases',
        scope: issue.file,
        action: 'Add',
        description: '先补最小失败用例，锁定问题的可复现实例。',
        modification_points: [
          {
            file: issue.file,
            target: `line ${issue.line}`,
            change: issue.description
          }
        ],
        implementation: [
          '添加失败测试覆盖当前问题场景。',
          '确认测试在修复前稳定失败。',
          '记录输入输出与边界条件。'
        ],
        test: {
          unit: ['新增针对问题点的最小单测'],
          integration: [],
          commands: ['npm test'],
          coverage_target: 0.75
        },
        acceptance: {
          criteria: ['新增测试可稳定复现问题', '修复后测试转为通过'],
          verification: ['测试结果可重复']
        },
        priority: 1
      },
      {
        id: 'T2',
        title: 'Implement fix with guardrails',
        scope: issue.file,
        action: 'Refactor',
        description: issue.title,
        modification_points: [
          {
            file: issue.file,
            target: `line ${issue.line}`,
            change: issue.title
          }
        ],
        implementation: [
          '实现最小修复并保持现有接口兼容。',
          '加入必要保护逻辑（边界/异常/空输入）。',
          '补充注释说明关键约束。'
        ],
        test: {
          unit: ['执行新增单测'],
          integration: [],
          commands: ['npm test', 'npx tsc --noEmit'],
          coverage_target: 0.8
        },
        acceptance: {
          criteria: ['问题场景不再复现', '相关回归测试全部通过'],
          verification: ['单测通过', '类型检查通过']
        },
        depends_on: ['T1'],
        priority: 2
      }
    ],
    analysis: {
      risk: issue.priority === 'high' ? 'medium' : 'low',
      impact: issue.priority,
      complexity: issue.priority === 'high' ? 'medium' : 'low'
    },
    score: Number(issue.priority_score || 0),
    is_bound: true,
    created_at: now,
    bound_at: now
  };

  const solutionFile = path.join(solutionsDir, `${issueId}.jsonl`);
  fs.writeFileSync(solutionFile, JSON.stringify(solutionObj) + '\n', 'utf8');
  createdSolutions.push(path.relative(root, solutionFile).replace(/\\/g, '/'));

  if (!existingHistoryIds.has(issueId)) {
    const historyObj = {
      id: issueId,
      title: issue.title,
      status: 'planned',
      priority: priorityMap[issue.priority] || 2,
      context: `[${issue.category}] ${issue.file}:${issue.line} | ${issue.description}`,
      bound_solution_id: solutionId,
      created_at: now,
      updated_at: now,
      planned_at: now
    };
    fs.appendFileSync(historyPath, JSON.stringify(historyObj) + '\n', 'utf8');
    appendedHistory.push(issueId);
  }

  if (!existingActiveIds.has(issueId)) {
    const activeObj = {
      id: issueId,
      title: issue.title,
      status: 'planned',
      priority: priorityMap[issue.priority] || 2,
      context: `[${issue.category}] ${issue.file}:${issue.line} | ${issue.description}`,
      bound_solution_id: solutionId,
      created_at: now,
      updated_at: now,
      planned_at: now
    };
    fs.appendFileSync(activeIssuesPath, JSON.stringify(activeObj) + '\n', 'utf8');
    appendedActive.push(issueId);
  }
}

console.log(JSON.stringify({
  discovery_id: discoveryId,
  total_issues: issues.length,
  solutions_created: createdSolutions.length,
  history_appended: appendedHistory.length,
  active_appended: appendedActive.length,
  first_solutions: createdSolutions.slice(0, 5)
}, null, 2));
