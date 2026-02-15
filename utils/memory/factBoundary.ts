import type { LogOutline, LogSummary } from '../contracts';
import { collectIndexedLogPairingIssues, normalizeAmIndex } from './amIndex';

export type FactConfidence = 'high' | 'medium';

export interface KnownFactItem {
  content: string;
  source: string;
  confidence: FactConfidence;
  timestamp?: string;
}

export interface FactBoundaryResult {
  knownFacts: KnownFactItem[];
  unknownSlots: string[];
}

export interface FactBoundaryOptions {
  knownFactLimit?: number;
  unknownSlotLimit?: number;
  summaryWindow?: number;
  outlineWindow?: number;
}

const DEFAULT_KNOWN_FACT_LIMIT = 10;
const DEFAULT_UNKNOWN_SLOT_LIMIT = 6;
const DEFAULT_SUMMARY_WINDOW = 6;
const DEFAULT_OUTLINE_WINDOW = 4;

const clampPositiveInt = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const makeSummarySource = (row: LogSummary, fallbackIndex: number) => {
  const normalizedAm = normalizeAmIndex(row.编码索引);
  if (normalizedAm) return `${normalizedAm}/summary`;
  return `summary:turn-${typeof row.回合 === 'number' ? row.回合 : fallbackIndex}`;
};

const makeOutlineSource = (row: LogOutline, fallbackIndex: number) => {
  const normalizedAm = normalizeAmIndex(row.编码索引);
  if (normalizedAm) return `${normalizedAm}/outline`;
  const chapter = typeof row.章节 === 'string' && row.章节.trim() ? row.章节.trim() : `#${fallbackIndex}`;
  return `outline:${chapter}`;
};

const pushUnknownSlot = (
  target: string[],
  dedupeSet: Set<string>,
  text: string,
  limit: number
) => {
  if (target.length >= limit) return;
  const normalized = normalizeText(text);
  if (!normalized || dedupeSet.has(normalized)) return;
  dedupeSet.add(normalized);
  target.push(normalized);
};

const buildOutlineFactText = (row: LogOutline): string => {
  const chapter = normalizeText(row.章节 || '');
  const title = normalizeText(row.标题 || '');
  const span = normalizeText(row.时间跨度 || '');
  const summary = normalizeText(row.大纲 || '');
  const eventList = Array.isArray(row.事件列表)
    ? row.事件列表.map((item) => normalizeText(String(item))).filter(Boolean)
    : [];
  const eventPreview = eventList.slice(0, 2).join(' / ');
  const segments = [
    chapter ? `章节:${chapter}` : '',
    title ? `标题:${title}` : '',
    span ? `跨度:${span}` : '',
    summary ? `大纲:${summary}` : '',
    eventPreview ? `事件:${eventPreview}` : ''
  ].filter(Boolean);
  return segments.join(' | ');
};

const dedupeKnownFacts = (facts: KnownFactItem[]): KnownFactItem[] => {
  const seen = new Set<string>();
  const output: KnownFactItem[] = [];
  facts.forEach((fact) => {
    const content = normalizeText(fact.content);
    if (!content) return;
    const signature = `${fact.source}|${content}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    output.push({ ...fact, content });
  });
  return output;
};

export const buildFactBoundary = (
  summary?: LogSummary[],
  outline?: LogOutline[],
  options: FactBoundaryOptions = {}
): FactBoundaryResult => {
  const knownFactLimit = clampPositiveInt(options.knownFactLimit, DEFAULT_KNOWN_FACT_LIMIT);
  const unknownSlotLimit = clampPositiveInt(options.unknownSlotLimit, DEFAULT_UNKNOWN_SLOT_LIMIT);
  const summaryWindow = clampPositiveInt(options.summaryWindow, DEFAULT_SUMMARY_WINDOW);
  const outlineWindow = clampPositiveInt(options.outlineWindow, DEFAULT_OUTLINE_WINDOW);

  const summaryRows = Array.isArray(summary) ? summary.slice(-summaryWindow) : [];
  const outlineRows = Array.isArray(outline) ? outline.slice(-outlineWindow) : [];

  const candidateFacts: KnownFactItem[] = [];

  summaryRows.forEach((row, index) => {
    const source = makeSummarySource(row, index + 1);
    const timestamp = normalizeText(row.时间跨度 || row.时间 || '');
    const core = normalizeText(row.纪要 || row.摘要 || '');
    if (core) {
      const location = normalizeText(row.地点 || '');
      const content = location ? `${core} (地点:${location})` : core;
      candidateFacts.push({
        content,
        source,
        confidence: normalizeAmIndex(row.编码索引) ? 'high' : 'medium',
        timestamp: timestamp || undefined
      });
    }

    if (Array.isArray(row.关键事件)) {
      row.关键事件
        .map((event) => normalizeText(String(event)))
        .filter(Boolean)
        .slice(0, 2)
        .forEach((event) => {
          candidateFacts.push({
            content: `关键事件:${event}`,
            source,
            confidence: 'medium',
            timestamp: timestamp || undefined
          });
        });
    }

    const dialog = normalizeText(row.重要对话 || '');
    if (dialog) {
      candidateFacts.push({
        content: `重要对话:${dialog}`,
        source,
        confidence: 'medium',
        timestamp: timestamp || undefined
      });
    }
  });

  outlineRows.forEach((row, index) => {
    const source = makeOutlineSource(row, index + 1);
    const text = buildOutlineFactText(row);
    if (!text) return;
    candidateFacts.push({
      content: text,
      source,
      confidence: normalizeAmIndex(row.编码索引) ? 'high' : 'medium',
      timestamp: normalizeText(row.时间跨度 || '') || undefined
    });
  });

  const knownFacts = dedupeKnownFacts(candidateFacts).slice(0, knownFactLimit);
  const unknownSlots: string[] = [];
  const unknownDedup = new Set<string>();

  if (summaryRows.length === 0) {
    pushUnknownSlot(unknownSlots, unknownDedup, '近期日志摘要缺失，无法确认最新回合事实。', unknownSlotLimit);
  }
  if (outlineRows.length === 0) {
    pushUnknownSlot(unknownSlots, unknownDedup, '章节大纲缺失，无法确认剧情阶段锚点。', unknownSlotLimit);
  }

  const latestSummary = summaryRows[summaryRows.length - 1];
  if (latestSummary) {
    const summaryLabel = typeof latestSummary.回合 === 'number' ? `回合${latestSummary.回合}` : '最近摘要';
    if (!normalizeAmIndex(latestSummary.编码索引)) {
      pushUnknownSlot(
        unknownSlots,
        unknownDedup,
        `${summaryLabel} 缺少编码索引，来源可追溯性不足。`,
        unknownSlotLimit
      );
    }
    if (!normalizeText(latestSummary.地点 || '')) {
      pushUnknownSlot(unknownSlots, unknownDedup, `${summaryLabel} 缺少地点字段。`, unknownSlotLimit);
    }
    if (!normalizeText(latestSummary.时间跨度 || '')) {
      pushUnknownSlot(unknownSlots, unknownDedup, `${summaryLabel} 缺少时间跨度字段。`, unknownSlotLimit);
    }
    if (!normalizeText(latestSummary.重要对话 || '')) {
      pushUnknownSlot(unknownSlots, unknownDedup, `${summaryLabel} 缺少重要对话字段。`, unknownSlotLimit);
    }
  }

  const latestOutline = outlineRows[outlineRows.length - 1];
  if (latestOutline) {
    const outlineLabel = normalizeText(latestOutline.标题 || latestOutline.章节 || '最近大纲');
    if (!normalizeAmIndex(latestOutline.编码索引)) {
      pushUnknownSlot(
        unknownSlots,
        unknownDedup,
        `${outlineLabel} 缺少编码索引，无法与摘要稳定配对。`,
        unknownSlotLimit
      );
    }
    if (!normalizeText(latestOutline.时间跨度 || '')) {
      pushUnknownSlot(unknownSlots, unknownDedup, `${outlineLabel} 缺少时间跨度字段。`, unknownSlotLimit);
    }
    if (!normalizeText(latestOutline.大纲 || '')) {
      pushUnknownSlot(unknownSlots, unknownDedup, `${outlineLabel} 缺少大纲字段。`, unknownSlotLimit);
    }
  }

  const pairingIssues = collectIndexedLogPairingIssues({
    日志摘要: summaryRows as any,
    日志大纲: outlineRows as any
  });

  if (pairingIssues.missingOutline.length > 0) {
    pushUnknownSlot(
      unknownSlots,
      unknownDedup,
      `编码索引配对缺失：${pairingIssues.missingOutline.join(', ')} 缺少日志大纲。`,
      unknownSlotLimit
    );
  }
  if (pairingIssues.missingSummary.length > 0) {
    pushUnknownSlot(
      unknownSlots,
      unknownDedup,
      `编码索引配对缺失：${pairingIssues.missingSummary.join(', ')} 缺少日志摘要。`,
      unknownSlotLimit
    );
  }

  if (unknownSlots.length === 0) {
    unknownSlots.push('当前关键槽位均有来源，可按已知事实推进。');
  }

  return { knownFacts, unknownSlots };
};

export const formatFactBoundaryBlock = (boundary: FactBoundaryResult): string => {
  const knownLines = boundary.knownFacts.length > 0
    ? boundary.knownFacts.map((item, index) => {
      const meta = [
        `source:${item.source}`,
        `confidence:${item.confidence}`,
        item.timestamp ? `time:${item.timestamp}` : ''
      ].filter(Boolean).join('; ');
      return `${index + 1}. [${meta}] ${item.content}`;
    })
    : ['1. 暂无可验证事实，后续叙事需使用“未知/待确认”。'];

  const unknownLines = boundary.unknownSlots.map((item, index) => `${index + 1}. ${item}`);

  return [
    '[KNOWN_FACTS]',
    knownLines.join('\n'),
    '',
    '[UNKNOWN_SLOTS]',
    unknownLines.join('\n')
  ].join('\n');
};

