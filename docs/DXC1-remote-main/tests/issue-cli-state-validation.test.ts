import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const CLI_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/commands/issue.ts";

describe('issue cli state/status validation', () => {
  it('should load state policy and normalize aliases', () => {
    expect(existsSync(CLI_FILE)).toBe(true);
    const code = readFileSync(CLI_FILE, 'utf8');
    expect(code).toContain('loadIssueStatePolicy');
    expect(code).toContain('normalizeIssueStatusInput');
    expect(code).toContain('ISSUE_STATUS_ALIAS_MAP');
  });

  it('should validate pull state and use safe gh args execution', () => {
    const code = readFileSync(CLI_FILE, 'utf8');
    expect(code).toContain('normalizeGitHubStateInput(stateInput, policy)');
    expect(code).toContain("execFileSync('gh', ghArgs");
    expect(code).toContain("/^[A-Za-z0-9._/-]+$/");
  });

  it('should reject invalid status transitions in update action', () => {
    const code = readFileSync(CLI_FILE, 'utf8');
    expect(code).toContain('Invalid status transition');
    expect(code).toContain('allowedTransitions.includes(normalizedStatus)');
  });
});
