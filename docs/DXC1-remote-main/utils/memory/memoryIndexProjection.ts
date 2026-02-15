import type { LogOutline, LogSummary } from '../contracts';
import { normalizeAmIndex } from './amIndex';

export type MemoryIndexSource = 'paired' | 'summary' | 'outline';

export interface MemoryIndexEntry {
  id: string;
  source: MemoryIndexSource;
  amIndex?: string;
  turn: number;
  location?: string;
  chapter?: string;
  timeSpan?: string;
  summaryText?: string;
  outlineText?: string;
  events: string[];
  keywords: string[];
  searchText: string;
}

export interface MemoryIndexProjectionOptions {
  summaryWindow?: number;
  outlineWindow?: number;
}

const DEFAULT_SUMMARY_WINDOW = 16;
const DEFAULT_OUTLINE_WINDOW = 12;

const clampPositiveInt = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

const shortText = (value: unknown, max = 220): string => {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const extractKeywords = (parts: unknown[]): string[] => {
  const keywordSet = new Set<string>();
  parts.forEach((part) => {
    const text = normalizeText(part).toLowerCase();
    if (!text) return;
    const tokens = text.match(/[a-z0-9_]+|[\u4e00-\u9fa5]{2,}/g) || [];
    tokens.forEach((token) => {
      const normalized = token.trim();
      if (normalized.length < 2) return;
      keywordSet.add(normalized);
    });
    if (text.length <= 20) keywordSet.add(text);
  });
  return Array.from(keywordSet);
};

const makeSearchText = (
  amIndex: string | undefined,
  turn: number,
  location: string | undefined,
  chapter: string | undefined,
  timeSpan: string | undefined,
  summaryText: string | undefined,
  outlineText: string | undefined,
  events: string[]
): string => {
  return [
    amIndex || '',
    turn > 0 ? `turn ${turn}` : '',
    location || '',
    chapter || '',
    timeSpan || '',
    summaryText || '',
    outlineText || '',
    events.join(' ')
  ].map((part) => normalizeText(part)).filter(Boolean).join(' | ').toLowerCase();
};

export const buildMemoryIndexProjection = (
  summary?: LogSummary[],
  outline?: LogOutline[],
  options: MemoryIndexProjectionOptions = {}
): MemoryIndexEntry[] => {
  const summaryWindow = clampPositiveInt(options.summaryWindow, DEFAULT_SUMMARY_WINDOW);
  const outlineWindow = clampPositiveInt(options.outlineWindow, DEFAULT_OUTLINE_WINDOW);
  const summaryRows = Array.isArray(summary) ? summary.slice(-summaryWindow) : [];
  const outlineRows = Array.isArray(outline) ? outline.slice(-outlineWindow) : [];

  const outlineByAm = new Map<string, LogOutline[]>();
  const outlineWithoutAm: LogOutline[] = [];
  outlineRows.forEach((row) => {
    const amIndex = normalizeAmIndex(row.编码索引);
    if (!amIndex) {
      outlineWithoutAm.push(row);
      return;
    }
    const list = outlineByAm.get(amIndex) ?? [];
    list.push(row);
    outlineByAm.set(amIndex, list);
  });

  const entries: MemoryIndexEntry[] = [];
  const pushEntry = (payload: Omit<MemoryIndexEntry, 'id'>) => {
    const nextId = `${payload.source}-${payload.amIndex || 'NA'}-${payload.turn}-${entries.length + 1}`;
    entries.push({ id: nextId, ...payload });
  };

  summaryRows.forEach((summaryRow, index) => {
    const amIndex = normalizeAmIndex(summaryRow.编码索引);
    const outlineList = amIndex ? (outlineByAm.get(amIndex) ?? []) : [];
    const matchedOutline = outlineList.length > 0 ? outlineList.shift() : undefined;
    if (amIndex) outlineByAm.set(amIndex, outlineList);

    const summaryText = shortText(summaryRow.纪要 || summaryRow.摘要);
    const outlineText = shortText(matchedOutline?.大纲 || matchedOutline?.标题);
    const events = Array.isArray(matchedOutline?.事件列表)
      ? matchedOutline!.事件列表.map((event) => shortText(event, 80)).filter(Boolean)
      : [];
    const turn = typeof summaryRow.回合 === 'number'
      ? summaryRow.回合
      : (typeof matchedOutline?.开始回合 === 'number' ? matchedOutline.开始回合 : index + 1);
    const location = normalizeText(summaryRow.地点 || '');
    const chapter = normalizeText(matchedOutline?.章节 || '');
    const timeSpan = normalizeText(summaryRow.时间跨度 || matchedOutline?.时间跨度 || '');
    const source: MemoryIndexSource = matchedOutline ? 'paired' : 'summary';

    pushEntry({
      source,
      amIndex: amIndex || undefined,
      turn,
      location: location || undefined,
      chapter: chapter || undefined,
      timeSpan: timeSpan || undefined,
      summaryText: summaryText || undefined,
      outlineText: outlineText || undefined,
      events,
      keywords: extractKeywords([
        amIndex || '',
        location,
        chapter,
        timeSpan,
        summaryText,
        outlineText,
        events.join(' ')
      ]),
      searchText: makeSearchText(
        amIndex || undefined,
        turn,
        location || undefined,
        chapter || undefined,
        timeSpan || undefined,
        summaryText || undefined,
        outlineText || undefined,
        events
      )
    });
  });

  outlineWithoutAm.forEach((row, index) => {
    const chapter = normalizeText(row.章节 || '');
    const timeSpan = normalizeText(row.时间跨度 || '');
    const outlineText = shortText(row.大纲 || row.标题);
    const events = Array.isArray(row.事件列表)
      ? row.事件列表.map((event) => shortText(event, 80)).filter(Boolean)
      : [];
    const turn = typeof row.开始回合 === 'number' ? row.开始回合 : index + 1;
    pushEntry({
      source: 'outline',
      turn,
      chapter: chapter || undefined,
      timeSpan: timeSpan || undefined,
      outlineText: outlineText || undefined,
      events,
      keywords: extractKeywords([chapter, timeSpan, outlineText, events.join(' ')]),
      searchText: makeSearchText(
        undefined,
        turn,
        undefined,
        chapter || undefined,
        timeSpan || undefined,
        undefined,
        outlineText || undefined,
        events
      )
    });
  });

  outlineByAm.forEach((rows, amIndex) => {
    rows.forEach((row) => {
      const chapter = normalizeText(row.章节 || '');
      const timeSpan = normalizeText(row.时间跨度 || '');
      const outlineText = shortText(row.大纲 || row.标题);
      const events = Array.isArray(row.事件列表)
        ? row.事件列表.map((event) => shortText(event, 80)).filter(Boolean)
        : [];
      const turn = typeof row.开始回合 === 'number' ? row.开始回合 : 0;
      pushEntry({
        source: 'outline',
        amIndex,
        turn,
        chapter: chapter || undefined,
        timeSpan: timeSpan || undefined,
        outlineText: outlineText || undefined,
        events,
        keywords: extractKeywords([amIndex, chapter, timeSpan, outlineText, events.join(' ')]),
        searchText: makeSearchText(
          amIndex,
          turn,
          undefined,
          chapter || undefined,
          timeSpan || undefined,
          undefined,
          outlineText || undefined,
          events
        )
      });
    });
  });

  return entries.sort((a, b) => {
    if (a.turn !== b.turn) return b.turn - a.turn;
    if (a.amIndex && b.amIndex && a.amIndex !== b.amIndex) return b.amIndex.localeCompare(a.amIndex);
    return b.id.localeCompare(a.id);
  });
};
