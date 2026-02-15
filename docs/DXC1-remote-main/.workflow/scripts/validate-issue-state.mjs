#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_ISSUE_STATUSES = ['registered', 'planning', 'planned', 'queued', 'executing', 'completed', 'failed', 'paused'];
const DEFAULT_QUEUE_STATUSES = ['active', 'completed', 'archived', 'failed', 'merged', 'in_progress'];
const DEFAULT_QUEUE_ITEM_STATUSES = ['pending', 'ready', 'executing', 'completed', 'failed', 'blocked', 'planned', 'in_progress'];

function parseArgs(argv) {
  const args = { path: '.workflow/issues', strict: false, json: true };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--strict') {
      args.strict = true;
      continue;
    }
    if (current === '--no-json') {
      args.json = false;
      continue;
    }
    if (current === '--path' && i + 1 < argv.length) {
      args.path = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function parseJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function parseJsonlSafe(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8');
    return text
      .split('\n')
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter(item => item.text.trim())
      .map(item => ({ line: item.line, data: JSON.parse(item.text) }));
  } catch {
    return [];
  }
}

function toLowerString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function loadPolicyStatuses(projectRoot) {
  const guidelinesPath = join(projectRoot, '.workflow', 'project-guidelines.json');
  if (!existsSync(guidelinesPath)) {
    return {
      issue: [...DEFAULT_ISSUE_STATUSES],
      queue: [...DEFAULT_QUEUE_STATUSES],
      item: [...DEFAULT_QUEUE_ITEM_STATUSES]
    };
  }

  const json = parseJsonSafe(guidelinesPath) || {};
  const issueStatus = Array.isArray(json?.issue_state_policy?.issue_status)
    ? json.issue_state_policy.issue_status.map(toLowerString).filter(Boolean)
    : DEFAULT_ISSUE_STATUSES;
  const aliasMap = (json?.issue_state_policy?.alias_map && typeof json.issue_state_policy.alias_map === 'object')
    ? Object.fromEntries(
      Object.entries(json.issue_state_policy.alias_map)
        .map(([alias, target]) => [toLowerString(alias), toLowerString(target)])
        .filter(([, target]) => !!target)
    )
    : {};

  return {
    issue: issueStatus.length > 0 ? Array.from(new Set(issueStatus)) : [...DEFAULT_ISSUE_STATUSES],
    queue: [...DEFAULT_QUEUE_STATUSES],
    item: [...DEFAULT_QUEUE_ITEM_STATUSES],
    aliasMap
  };
}

function pushInvalid(report, params) {
  report.invalid.push(params);
  report.invalid_count += 1;
}

function addDistribution(report, key, value) {
  if (!value) return;
  if (!report.status_distribution[key]) {
    report.status_distribution[key] = {};
  }
  report.status_distribution[key][value] = (report.status_distribution[key][value] || 0) + 1;
}

function checkStatus({ file, line, fieldPath, value, allowed, report }) {
  let normalized = toLowerString(value);
  if ((fieldPath === 'issue.status' || fieldPath === 'history.status') && report.alias_map[normalized]) {
    normalized = report.alias_map[normalized];
  }
  addDistribution(report, fieldPath, normalized || '(empty)');
  if (!normalized || !allowed.includes(normalized)) {
    pushInvalid(report, {
      file,
      line,
      path: fieldPath,
      value,
      allowed_values: allowed
    });
  }
}

function validateIssuesJsonl(filePath, allowedIssue, report, fieldPath) {
  const records = parseJsonlSafe(filePath);
  report.scanned_records += records.length;
  for (const record of records) {
    checkStatus({
      file: filePath,
      line: record.line,
      fieldPath,
      value: record.data?.status,
      allowed: allowedIssue,
      report
    });
  }
}

function validateQueueFile(filePath, allowedQueue, allowedItem, report) {
  const queue = parseJsonSafe(filePath);
  if (!queue || typeof queue !== 'object') return;

  report.scanned_records += 1;
  checkStatus({
    file: filePath,
    line: 1,
    fieldPath: 'queue.status',
    value: queue.status,
    allowed: allowedQueue,
    report
  });

  const solutionItems = Array.isArray(queue.solutions) ? queue.solutions : [];
  const taskItems = Array.isArray(queue.tasks) ? queue.tasks : [];
  const itemItems = Array.isArray(queue.items) ? queue.items : [];
  const allItems = [...solutionItems, ...taskItems, ...itemItems];

  allItems.forEach((item, index) => {
    checkStatus({
      file: filePath,
      line: index + 1,
      fieldPath: 'queue.item.status',
      value: item?.status,
      allowed: allowedItem,
      report
    });
  });
}

function validateQueueIndex(filePath, allowedQueue, report) {
  const index = parseJsonSafe(filePath);
  if (!index || typeof index !== 'object') return;

  const queues = Array.isArray(index.queues) ? index.queues : [];
  report.scanned_records += queues.length;
  queues.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    if (!Object.prototype.hasOwnProperty.call(entry, 'status')) return;
    checkStatus({
      file: filePath,
      line: idx + 1,
      fieldPath: 'index.queues.status',
      value: entry.status,
      allowed: allowedQueue,
      report
    });
  });
}

function buildMigrationAdvice(invalidItems) {
  const byValue = {};
  for (const item of invalidItems) {
    const key = String(item.value);
    byValue[key] = (byValue[key] || 0) + 1;
  }
  return Object.entries(byValue).map(([value, count]) => ({
    invalid_value: value,
    occurrences: count,
    suggestion: '将该状态映射到 project-guidelines.json 中定义的合法枚举，或补充 alias_map。'
  }));
}

function main() {
  const args = parseArgs(process.argv);
  const issuesRoot = resolve(process.cwd(), args.path);
  const projectRoot = resolve(issuesRoot, '..', '..');
  const allowed = loadPolicyStatuses(projectRoot);

  const report = {
    path: issuesRoot,
    strict: args.strict,
    scanned_files: 0,
    scanned_records: 0,
    invalid_count: 0,
    invalid: [],
    status_distribution: {},
    allowed_values: {
      issue_status: allowed.issue,
      queue_status: allowed.queue,
      queue_item_status: allowed.item
    },
    alias_map: allowed.aliasMap || {},
    generated_at: new Date().toISOString()
  };

  const issuesFile = join(issuesRoot, 'issues.jsonl');
  const historyFile = join(issuesRoot, 'issue-history.jsonl');
  const queuesDir = join(issuesRoot, 'queues');
  const queueIndex = join(queuesDir, 'index.json');

  if (existsSync(issuesFile)) {
    report.scanned_files += 1;
    validateIssuesJsonl(issuesFile, allowed.issue, report, 'issue.status');
  }

  if (existsSync(historyFile)) {
    report.scanned_files += 1;
    validateIssuesJsonl(historyFile, allowed.issue, report, 'history.status');
  }

  if (existsSync(queueIndex)) {
    report.scanned_files += 1;
    validateQueueIndex(queueIndex, allowed.queue, report);
  }

  if (existsSync(queuesDir)) {
    const queueFiles = readdirSync(queuesDir)
      .filter(name => name.endsWith('.json') && name !== 'index.json')
      .map(name => join(queuesDir, name));

    report.scanned_files += queueFiles.length;
    queueFiles.forEach(file => validateQueueFile(file, allowed.queue, allowed.item, report));
  }

  if (report.invalid_count > 0) {
    report.migration_advice = buildMigrationAdvice(report.invalid);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[validate-issue-state] scanned_files=${report.scanned_files} scanned_records=${report.scanned_records} invalid_count=${report.invalid_count}`);
  }

  if (args.strict && report.invalid_count > 0) {
    process.exit(1);
  }
}

main();
