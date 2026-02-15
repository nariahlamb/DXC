const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function getStatus(issueId) {
  const out = run(`ccw issue status ${issueId} --json`);
  return JSON.parse(out);
}

function createSolution(issueId, dataObj) {
  const json = JSON.stringify(dataObj).replace(/"/g, '\\"');
  const out = run(`ccw issue solution ${issueId} --data "${json}" --json`);
  try {
    return JSON.parse(out);
  } catch {
    return { raw: out };
  }
}

function extractSolutionId(resp, issueId) {
  if (!resp) return null;
  if (resp.solution_id) return resp.solution_id;
  if (resp.id) return resp.id;
  if (Array.isArray(resp) && resp.length > 0) {
    const last = resp[resp.length - 1];
    return last.solution_id || last.id || null;
  }
  if (resp.raw) {
    const m = String(resp.raw).match(/SOL-[A-Za-z0-9\-]+/);
    if (m) return m[0];
  }
  const st = getStatus(issueId);
  if (Array.isArray(st.solutions) && st.solutions.length > 0) {
    return st.solutions[st.solutions.length - 1].id;
  }
  return null;
}

function makePatchedSolution(status, patchFn) {
  const boundId = status.issue.bound_solution_id;
  const bound = status.solutions.find(s => s.id === boundId);
  if (!bound) throw new Error(`No bound solution for ${status.issue.id}`);
  const draft = {
    description: bound.description,
    tasks: JSON.parse(JSON.stringify(bound.tasks || [])),
    exploration_context: bound.exploration_context || {},
    analysis: bound.analysis || {},
    score: bound.score || 0.8
  };
  patchFn(draft);
  return draft;
}

const targets = [
  {
    issueId: 'ISS-DSC-20260213-125122-004',
    patch: (sol) => {
      const t1 = sol.tasks.find(t => t.id === 'T1');
      if (t1 && t1.acceptance) {
        t1.acceptance.verification = [
          '执行 `rg -n "\\bas any\\b|: any\\b|<any>" hooks/useGameLogic.ts hooks/gameLogic | Measure-Object` 获取 any 基线并记录。',
          '执行 `wc -l hooks/useGameLogic.ts` 与拆分后新文件行数统计，确认拆分落地。',
          '执行 `npx tsc --noEmit` 返回 0。'
        ];
      }
    }
  },
  {
    issueId: 'ISS-DSC-20260213-125122-011',
    patch: (sol) => {
      const t2 = sol.tasks.find(t => t.id === 'T2');
      if (t2 && t2.acceptance) {
        t2.acceptance.verification = [
          '执行 `rg -n "const formatCost = \\(cost" components/game/views/CharacterView.tsx components/game/character/SkillsContent.tsx` 返回 0（重复实现已移除）。',
          '执行 `npx vitest run tests/utils/skillFormat.test.ts --testTimeout=60000` 并通过。',
          '执行 `npx tsc --noEmit` 返回 0。'
        ];
      }
    }
  }
];

const rebound = [];
for (const item of targets) {
  const st = getStatus(item.issueId);
  const solutionData = makePatchedSolution(st, item.patch);
  const created = createSolution(item.issueId, solutionData);
  const newId = extractSolutionId(created, item.issueId);
  if (!newId) throw new Error(`Failed to create solution for ${item.issueId}`);
  run(`ccw issue bind ${item.issueId} ${newId}`);
  run(`ccw issue update ${item.issueId} --status planned`);
  rebound.push({ issue_id: item.issueId, solution_id: newId });
}

console.log(JSON.stringify({ rebound }, null, 2));
