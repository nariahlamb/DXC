import type { TavernTableSearchRow } from '../taverndb/tableProjection';

export interface TavernTableHit {
  row: TavernTableSearchRow;
  score: number;
  matchedTokens: string[];
}

export interface TavernTableRetrieverOptions {
  topK?: number;
  sheetFilter?: string[];
  sheetWeights?: Record<string, number>;
}

const DEFAULT_TOP_K = 6;

const tokenize = (query: string): string[] => {
  const text = String(query || '').trim().toLowerCase();
  if (!text) return [];
  const tokens = text.match(/[a-z0-9_]+|[\u4e00-\u9fa5]{2,}/g) || [];
  return Array.from(new Set(tokens.filter((token) => token.length >= 2)));
};

export const retrieveTavernTableRows = (
  rows: TavernTableSearchRow[],
  query: string,
  options: TavernTableRetrieverOptions = {}
): TavernTableHit[] => {
  const topK = Number.isFinite(Number(options.topK)) ? Math.max(1, Number(options.topK)) : DEFAULT_TOP_K;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const allowedSheets = Array.isArray(options.sheetFilter) && options.sheetFilter.length > 0
    ? new Set(options.sheetFilter)
    : null;
  const sheetWeights = options.sheetWeights && typeof options.sheetWeights === 'object'
    ? options.sheetWeights
    : null;

  const hits: TavernTableHit[] = [];

  rows.forEach((row) => {
    if (allowedSheets && !allowedSheets.has(row.sheetId)) return;

    let score = 0;
    const matchedTokens: string[] = [];

    tokens.forEach((token) => {
      if (row.text.includes(token)) {
        matchedTokens.push(token);
        score += token.length >= 6 ? 6 : 4;
      }
      if (String(row.sheetId).toLowerCase().includes(token) || String(row.sheetLabel).toLowerCase().includes(token)) {
        score += 2;
      }
    });

    if (/^am\d+$/.test(tokens[0]) && row.text.includes(tokens[0])) {
      score += 8;
    }

    if (score <= 0) return;
    const weight = sheetWeights ? Number(sheetWeights[row.sheetId] ?? 1) : 1;
    const normalizedWeight = Number.isFinite(weight) ? Math.max(0.2, Math.min(4, weight)) : 1;
    score = Math.round(score * normalizedWeight * 10) / 10;
    hits.push({ row, score, matchedTokens: Array.from(new Set(matchedTokens)) });
  });

  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.row.sheetId !== b.row.sheetId) return a.row.sheetId.localeCompare(b.row.sheetId);
    return a.row.rowIndex - b.row.rowIndex;
  });

  const deduped: TavernTableHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = `${hit.row.sheetId}:${hit.row.rowIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hit);
    if (deduped.length >= topK) break;
  }

  return deduped;
};

interface TavernRetrievalBlockPayload {
  query: string;
  hits: TavernTableHit[];
  totalCandidates: number;
}

export const formatTavernTableRetrievalBlock = (payload: TavernRetrievalBlockPayload): string => {
  const { query, hits, totalCandidates } = payload;
  let output = '[表格记忆召回 (TavernDB Retrieval)]\n';
  output += `Query: ${query || '(empty)'}\n`;
  output += `Candidates: ${totalCandidates}, Hits: ${hits.length}\n`;

  if (hits.length === 0) {
    output += '- No table rows matched.';
    return output;
  }

  hits.forEach((hit, index) => {
    const rowRef = `${hit.row.sheetId}#${hit.row.rowIndex + 1}`;
    const tokens = hit.matchedTokens.length > 0 ? hit.matchedTokens.join(', ') : 'n/a';
    output += `- ${index + 1}. [${rowRef}] score=${hit.score} tokens=${tokens}\n`;
    output += `  ${JSON.stringify(hit.row.row)}\n`;
  });

  return output.trimEnd();
};
