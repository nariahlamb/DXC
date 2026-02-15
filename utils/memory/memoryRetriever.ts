import { normalizeAmIndex } from './amIndex';
import type { MemoryIndexEntry, MemoryIndexSource } from './memoryIndexProjection';

export interface MemoryRetrievalOptions {
  topK?: number;
  sourceFilter?: MemoryIndexSource[];
}

export interface MemoryRetrievalHit {
  entry: MemoryIndexEntry;
  score: number;
  matchedTerms: string[];
}

export interface MemoryRetrievalBlockPayload {
  query: string;
  hits: MemoryRetrievalHit[];
  totalCandidates: number;
}

const DEFAULT_TOP_K = 6;

const clampPositiveInt = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

const extractQueryTokens = (query: string): string[] => {
  const normalized = normalizeText(query).toLowerCase();
  if (!normalized) return [];
  const tokens = normalized.match(/[a-z0-9_]+|[\u4e00-\u9fa5]{2,}/g) || [];
  const dedupe = new Set<string>();
  tokens.forEach((token) => {
    const cleaned = token.trim();
    if (cleaned.length < 2) return;
    dedupe.add(cleaned);
  });
  return Array.from(dedupe);
};

const extractAmTokens = (query: string): string[] => {
  const matches = String(query || '').match(/AM\d{4,}/gi) || [];
  const dedupe = new Set<string>();
  matches.forEach((value) => {
    const normalized = normalizeAmIndex(value);
    if (normalized) dedupe.add(normalized);
  });
  return Array.from(dedupe);
};

const scoreEntry = (
  entry: MemoryIndexEntry,
  queryTokens: string[],
  amTokens: string[]
): { score: number; matchedTerms: string[] } => {
  let score = 0;
  const matchedTerms: string[] = [];
  const keywordSet = new Set(entry.keywords.map((keyword) => keyword.toLowerCase()));
  const searchText = entry.searchText.toLowerCase();

  amTokens.forEach((amToken) => {
    if (entry.amIndex === amToken) {
      score += 50;
      matchedTerms.push(amToken);
    }
  });

  queryTokens.forEach((token) => {
    if (keywordSet.has(token)) {
      score += 8;
      matchedTerms.push(token);
      return;
    }
    if (searchText.includes(token)) {
      score += 4;
      matchedTerms.push(token);
    }
  });

  if (entry.source === 'paired') score += 2;
  if (entry.turn > 0) score += Math.min(8, entry.turn / 100);

  return { score, matchedTerms: Array.from(new Set(matchedTerms)) };
};

export const retrieveMemoryByQuery = (
  indexEntries: MemoryIndexEntry[],
  query: string,
  options: MemoryRetrievalOptions = {}
): MemoryRetrievalHit[] => {
  const topK = clampPositiveInt(options.topK, DEFAULT_TOP_K);
  const normalizedQuery = normalizeText(query);
  const queryTokens = extractQueryTokens(normalizedQuery);
  const amTokens = extractAmTokens(normalizedQuery);
  const hasQuery = queryTokens.length > 0 || amTokens.length > 0;
  const sourceFilter = Array.isArray(options.sourceFilter) && options.sourceFilter.length > 0
    ? new Set(options.sourceFilter)
    : null;

  const hits = indexEntries
    .filter((entry) => !sourceFilter || sourceFilter.has(entry.source))
    .map((entry) => {
      const scored = scoreEntry(entry, queryTokens, amTokens);
      return {
        entry,
        score: scored.score,
        matchedTerms: scored.matchedTerms
      } as MemoryRetrievalHit;
    })
    .filter((hit) => !hasQuery || hit.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.entry.turn !== b.entry.turn) return b.entry.turn - a.entry.turn;
      return b.entry.id.localeCompare(a.entry.id);
    });

  if (hits.length > 0) return hits.slice(0, topK);
  return indexEntries
    .filter((entry) => !sourceFilter || sourceFilter.has(entry.source))
    .slice(0, topK)
    .map((entry) => ({ entry, score: 0, matchedTerms: [] }));
};

const compactText = (value: unknown, max = 80): string => {
  const text = normalizeText(value);
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const formatMemoryRetrievalBlock = (payload: MemoryRetrievalBlockPayload): string => {
  const query = normalizeText(payload.query) || '（空查询，使用最近记忆）';
  if (payload.hits.length === 0) {
    return [
      '[记忆索引召回 (Memory Index Retrieval)]',
      `query: ${query}`,
      `candidates: ${payload.totalCandidates}`,
      'hits: 0',
      '- 无命中，当前轮将退化为顺序记忆上下文。'
    ].join('\n');
  }

  const lines = payload.hits.map((hit, index) => {
    const entry = hit.entry;
    const meta = [
      `AM:${entry.amIndex || '-'}`,
      `source:${entry.source}`,
      `turn:${entry.turn || '-'}`,
      `score:${hit.score.toFixed(2)}`
    ].join('; ');
    const matched = hit.matchedTerms.length > 0 ? `; hit:${hit.matchedTerms.join('|')}` : '';
    const summary = compactText(entry.summaryText || '', 60);
    const outline = compactText(entry.outlineText || '', 60);
    const location = compactText(entry.location || '', 24);
    return `${index + 1}. [${meta}${matched}] 地点:${location} | 摘要:${summary} | 大纲:${outline}`;
  });

  return [
    '[记忆索引召回 (Memory Index Retrieval)]',
    `query: ${query}`,
    `candidates: ${payload.totalCandidates}`,
    `hits: ${payload.hits.length}`,
    lines.join('\n')
  ].join('\n');
};
