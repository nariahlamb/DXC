import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const VALIDATOR = resolve(process.cwd(), '.workflow/scripts/validate-issue-state.mjs');
const GUIDELINES = resolve(process.cwd(), '.workflow/project-guidelines.json');

function runValidator(cwd: string, args: string[]) {
  const result = spawnSync('node', [VALIDATOR, ...args], {
    cwd,
    encoding: 'utf8'
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

describe('discovery state variableization', () => {
  it('should produce discovery_state section in validator report', () => {
    const res = runValidator(process.cwd(), ['--json', '--path', '.workflow/issues']);
    expect(res.status).toBe(0);
    const report = JSON.parse(res.stdout);
    expect(report.discovery_state).toBeTruthy();
    expect(typeof report.discovery_state.scanned_files).toBe('number');
    expect(report.discovery_state.field_distribution).toBeTruthy();
  });

  it('should fail strict mode when required fields are missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'dxc-discovery-'));
    mkdirSync(join(root, '.workflow', 'issues', 'discoveries', 'TMP-1'), { recursive: true });
    mkdirSync(join(root, '.workflow'), { recursive: true });
    writeFileSync(join(root, '.workflow', 'project-guidelines.json'), readFileSync(GUIDELINES, 'utf8'), 'utf8');

    // Missing required fields: discovery_id, mode, target_selector, results...
    writeFileSync(
      join(root, '.workflow', 'issues', 'discoveries', 'TMP-1', 'discovery-state.json'),
      JSON.stringify({ phase: 'complete', created_at: '2026-02-15T00:00:00Z', updated_at: '2026-02-15T00:00:00Z', results: {} }, null, 2),
      'utf8'
    );

    const res = runValidator(root, ['--strict', '--json', '--path', '.workflow/issues']);
    expect(res.status).toBe(1);
    const report = JSON.parse(res.stdout);
    expect(report.discovery_state.invalid_count).toBeGreaterThan(0);
  });

  it('should pass strict mode for minimal valid discovery-state', () => {
    const root = mkdtempSync(join(tmpdir(), 'dxc-discovery-'));
    mkdirSync(join(root, '.workflow', 'issues', 'discoveries', 'TMP-2'), { recursive: true });
    mkdirSync(join(root, '.workflow'), { recursive: true });
    writeFileSync(join(root, '.workflow', 'project-guidelines.json'), readFileSync(GUIDELINES, 'utf8'), 'utf8');

    writeFileSync(
      join(root, '.workflow', 'issues', 'discoveries', 'TMP-2', 'discovery-state.json'),
      JSON.stringify(
        {
          discovery_id: 'TMP-2',
          mode: 'standard',
          target_selector: '**/*',
          phase: 'complete',
          created_at: '2026-02-15T00:00:00Z',
          updated_at: '2026-02-15T00:00:00Z',
          results: { total_findings: 0, issues_generated: 0 }
        },
        null,
        2
      ),
      'utf8'
    );

    const res = runValidator(root, ['--strict', '--json', '--path', '.workflow/issues']);
    expect(res.status).toBe(0);
  });
});

