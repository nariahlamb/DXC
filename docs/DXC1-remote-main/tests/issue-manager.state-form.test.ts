import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const VIEW_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/templates/dashboard-js/views/issue-manager.js";
const CSS_FILE = "C:/Users/mariah'lamb/AppData/Roaming/npm/node_modules/claude-code-workflow/ccw/src/templates/dashboard-css/32-issue-manager.css";

describe('issue manager state form', () => {
  it('should render state options from api metadata', () => {
    expect(existsSync(VIEW_FILE)).toBe(true);
    const code = readFileSync(VIEW_FILE, 'utf8');
    expect(code).toContain("fetch('/api/issues/state-metadata?path='");
    expect(code).toContain('renderPullIssueStateOptions');
    expect(code).toContain('updatePullIssueStateHint');
  });

  it('should prevent submit when state value is not allowed', () => {
    const code = readFileSync(VIEW_FILE, 'utf8');
    expect(code).toContain('allowedStates.includes(state)');
    expect(code).toContain('Invalid state value');
  });

  it('should include hint and error styles for state constraints', () => {
    expect(existsSync(CSS_FILE)).toBe(true);
    const css = readFileSync(CSS_FILE, 'utf8');
    expect(css).toContain('.pull-state-hint');
    expect(css).toContain('.pull-result.pull-result-error');
  });
});
