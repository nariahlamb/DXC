import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const CLI_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/commands/issue.ts";
const GUIDELINES_FILE = '.workflow/project-guidelines.json';

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

  it('should define discovery_state_policy with required fields', () => {
    const guidelines = JSON.parse(readFileSync(GUIDELINES_FILE, 'utf8'));
    const policy = guidelines.discovery_state_policy;

    expect(policy).toBeTruthy();
    expect(policy.template_version).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
    expect(Array.isArray(policy.required_fields)).toBe(true);
    expect(policy.required_fields.length).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(policy.optional_fields)).toBe(true);
    expect(policy.optional_fields.length).toBeGreaterThanOrEqual(4);
    expect(policy.alias_map).toBeTruthy();
    expect(Object.keys(policy.alias_map).length).toBeGreaterThanOrEqual(4);
  });
});
