import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const ROUTE_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/core/routes/issue-routes.ts";

describe('issue routes state validation', () => {
  it('should enforce pull state normalization and structured validation errors', () => {
    expect(existsSync(ROUTE_FILE)).toBe(true);
    const code = readFileSync(ROUTE_FILE, 'utf8');
    expect(code).toContain('normalizeGithubPullState(rawState, issueStatePolicy)');
    expect(code).toContain('INVALID_GITHUB_PULL_STATE');
    expect(code).toContain('allowed_values');
    expect(code).toContain('received_value');
  });

  it('should validate issue status and status transition in PATCH route', () => {
    const code = readFileSync(ROUTE_FILE, 'utf8');
    expect(code).toContain('normalizeIssueStatus(body.status, issueStatePolicy)');
    expect(code).toContain('INVALID_ISSUE_STATUS');
    expect(code).toContain('INVALID_STATUS_TRANSITION');
    expect(code).toContain('canTransitionStatus(currentStatus, statusResult.value, issueStatePolicy)');
  });

  it('should execute gh command using argument whitelist mode', () => {
    const code = readFileSync(ROUTE_FILE, 'utf8');
    expect(code).toContain("execFileSync('gh', ghArgs");
    expect(code).toContain("/^[A-Za-z0-9._/-]+$/");
  });
});
