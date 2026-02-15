const fs = require('fs');
const path = require('path');

const issuesFile = path.join('.workflow','issues','issues.jsonl');
const historyFile = path.join('.workflow','issues','issue-history.jsonl');
const queueDir = path.join('.workflow','issues','queues');
const queueIndexFile = path.join(queueDir,'index.json');
const discoveryId = 'DSC-20260213-143958';

const now = new Date();
const pad = (n)=>String(n).padStart(2,'0');
const qid = `QUE-${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
const nowIso = now.toISOString();

const readJsonl = (file)=> fs.existsSync(file)
  ? fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l))
  : [];

const writeJsonl = (file, arr)=> fs.writeFileSync(file, arr.map(o=>JSON.stringify(o)).join('\n') + (arr.length?'\n':''), 'utf8');

const issues = readJsonl(issuesFile).filter(i => String(i.id||'').includes(discoveryId));
issues.sort((a,b)=> Number(b.priority||0)-Number(a.priority||0) || String(a.id).localeCompare(String(b.id)));

const queueItems = issues.map((issue, idx)=>({
  order: idx + 1,
  issue_id: issue.id,
  title: issue.title,
  priority: issue.priority,
  status: issue.status === 'in_progress' ? 'in_progress' : 'queued'
}));

fs.mkdirSync(queueDir, { recursive: true });
const queueObj = {
  id: qid,
  discovery_id: discoveryId,
  created_at: nowIso,
  updated_at: nowIso,
  status: 'active',
  current_issue_id: queueItems.find(i=>i.status==='in_progress')?.issue_id || queueItems[0]?.issue_id || null,
  items: queueItems
};
fs.writeFileSync(path.join(queueDir, `${qid}.json`), JSON.stringify(queueObj, null, 2) + '\n', 'utf8');

const idx = fs.existsSync(queueIndexFile)
  ? JSON.parse(fs.readFileSync(queueIndexFile,'utf8'))
  : { active_queue_id: null, queues: [], active_queue_ids: [] };
idx.active_queue_id = qid;
if (!Array.isArray(idx.queues)) idx.queues = [];
if (!idx.queues.includes(qid)) idx.queues.push(qid);
if (!Array.isArray(idx.active_queue_ids)) idx.active_queue_ids = [];
if (!idx.active_queue_ids.includes(qid)) idx.active_queue_ids.push(qid);
fs.writeFileSync(queueIndexFile, JSON.stringify(idx, null, 2) + '\n', 'utf8');

const markQueued = (items)=> items.map((it)=> {
  if (!String(it.id||'').includes(discoveryId)) return it;
  if (it.status === 'planned') it.status = 'queued';
  if (it.status === 'queued' && !it.queued_at) it.queued_at = nowIso;
  if (it.status === 'in_progress' && !it.queued_at) it.queued_at = nowIso;
  it.updated_at = nowIso;
  return it;
});

writeJsonl(issuesFile, markQueued(readJsonl(issuesFile)));
writeJsonl(historyFile, markQueued(readJsonl(historyFile)));

console.log(JSON.stringify({ queue_id: qid, issues: queueItems.length, current_issue: queueObj.current_issue_id }, null, 2));
