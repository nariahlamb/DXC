import { existsSync, readFileSync } from 'node:fs';

const ROUTE_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/core/routes/issue-routes.ts";

function fail(message) {
  console.error(`[smoke] ${message}`);
  process.exit(1);
}

if (!existsSync(ROUTE_FILE)) {
  fail('issue-routes.ts not found');
}

const code = readFileSync(ROUTE_FILE, 'utf8');
const checks = [
  { pattern: "normalizeGithubPullState(rawState, issueStatePolicy)", name: 'state normalization' },
  { pattern: "normalizeIssueStatus(body.status, issueStatePolicy)", name: 'status normalization' },
  { pattern: 'INVALID_STATUS_TRANSITION', name: 'status transition validation' },
  { pattern: "execFileSync('gh', ghArgs", name: 'safe gh execution' },
  { pattern: 'allowed_values', name: 'structured validation error body' }
];

for (const check of checks) {
  if (!code.includes(check.pattern)) {
    fail(`missing check: ${check.name}`);
  }
}

console.log('[smoke] issue state api validation checks passed');
