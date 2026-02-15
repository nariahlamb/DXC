const fs = require('fs');
const path = require('path');

const issueId = 'ISS-DSC-20260213-143958-001';
const now = new Date().toISOString();

function updateJsonl(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const updated = lines.map((line) => {
    let obj;
    try { obj = JSON.parse(line); } catch { return line; }
    if (obj.id !== issueId) return line;
    obj.status = 'in_progress';
    obj.updated_at = now;
    if (!obj.started_at) obj.started_at = now;
    return JSON.stringify(obj);
  });
  fs.writeFileSync(filePath, updated.join('\n') + '\n', 'utf8');
}

updateJsonl(path.join('.workflow','issues','issues.jsonl'));
updateJsonl(path.join('.workflow','issues','issue-history.jsonl'));
console.log(JSON.stringify({ issue_id: issueId, status: 'in_progress', updated_at: now }, null, 2));
