const OUTER_CODE_FENCE_REGEX = /^\s*```(?:[a-zA-Z0-9_-]+)?[ \t]*\r?\n([\s\S]*?)\r?\n?```\s*$/;
const STRONG_SENTENCE_BREAK_REGEX = /([。！？!?；;])/g;
const SOFT_SENTENCE_BREAK_REGEX = /([，,、])/g;
const STRONG_CHUNK_THRESHOLD = 120;
const HARD_SPLIT_TARGET = 140;
const SHORT_SEGMENT_MERGE_THRESHOLD = 30;
const DIALOGUE_SOFT_SPLIT_THRESHOLD = 140;
const DIALOGUE_MAX_PARAGRAPH_LENGTH = 240;

const normalizeLineBreaks = (text: string): string => text.replace(/\r\n?/g, '\n');
const decodeEscapedLineBreaks = (text: string): string => {
  if (!text || /[\r\n]/.test(text) || !/\\[nr]/.test(text)) return text;
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
};

type LogTextSplitMode = 'auto' | 'narrative' | 'dialogue';
type SplitLogTextOptions = { mode?: LogTextSplitMode };

const mergeShortSegments = (segments: string[], mergeThreshold = SHORT_SEGMENT_MERGE_THRESHOLD): string[] => {
  const result: string[] = [];
  let buffer = '';

  segments.forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;
    if (!buffer) {
      buffer = trimmed;
      return;
    }
    if ((buffer + trimmed).length <= mergeThreshold) {
      buffer += trimmed;
      return;
    }
    result.push(buffer);
    buffer = trimmed;
  });

  if (buffer) result.push(buffer);
  return result;
};

const hardSplitLongParagraph = (text: string, targetLength = HARD_SPLIT_TARGET): string[] => {
  const parts: string[] = [];
  let cursor = text.trim();
  const boundaryChars = ['。', '！', '？', '；', ';', '，', ',', '、', ' '];

  while (cursor.length > targetLength) {
    const scan = cursor.slice(0, targetLength);
    let boundary = -1;
    boundaryChars.forEach((char) => {
      boundary = Math.max(boundary, scan.lastIndexOf(char));
    });
    if (boundary < Math.floor(targetLength * 0.5)) {
      boundary = targetLength - 1;
    }
    const head = cursor.slice(0, boundary + 1).trim();
    if (head) parts.push(head);
    cursor = cursor.slice(boundary + 1).trim();
  }

  if (cursor) parts.push(cursor);
  return parts;
};

const splitDialogueParagraph = (text: string): string[] => {
  const withCueBreaks = text
    // 在「说话人：」前创建分段，提升多人对白可读性
    .replace(/([。！？!?；;])(?=[^\n]{0,18}[：:][「『“"])/g, '$1\n')
    .replace(/([」』”"])(?=[^\n]{0,18}[：:][「『“"])/g, '$1\n')
    // 兼容无引号对白：如「莉亚：... 阿泽：...」
    .replace(/([。！？!?；;」』”"])(?=[^\n]{0,18}[^\s：:「」『』“”"'()（）【】\[\]，。,！？!?；;]{1,12}[：:])/g, '$1\n');

  const cueSplit = mergeShortSegments(withCueBreaks.split('\n'), 24);
  if (cueSplit.length > 1) return cueSplit;

  const strongSplit = mergeShortSegments(
    text
      .replace(STRONG_SENTENCE_BREAK_REGEX, '$1\n')
      .split('\n'),
    24
  );
  if (strongSplit.length > 1) return strongSplit;

  return [text];
};

export const sanitizeLogText = (rawText: string): string => {
  if (!rawText) return '';

  let text = normalizeLineBreaks(String(rawText));
  // 连续剥离最外层代码块包裹，避免 `txt/json` fence 直接渲染到对话。
  while (true) {
    const match = text.match(OUTER_CODE_FENCE_REGEX);
    if (!match) break;
    text = normalizeLineBreaks(match[1]);
  }
  return decodeEscapedLineBreaks(text).trim();
};

export const splitLogTextIntoParagraphs = (rawText: string, options?: SplitLogTextOptions): string[] => {
  const mode = options?.mode ?? 'auto';
  const sanitized = sanitizeLogText(rawText);
  if (!sanitized) return [];

  // 保留显式换行语义：空行以空字符串占位，供渲染层还原“停顿/段落”视觉效果。
  if (sanitized.includes('\n')) {
    const lines = sanitizeLogText(sanitized).split('\n');
    const result: string[] = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (result.length > 0 && result[result.length - 1] !== '') result.push('');
        return;
      }
      result.push(trimmed);
    });
    while (result[0] === '') result.shift();
    while (result[result.length - 1] === '') result.pop();
    return result;
  }

  // NPC/玩家台词采用保守策略：不在无显式换行时按标点碎片化拆分，仅在极长文本时做硬切分上限。
  if (mode === 'dialogue') {
    if (sanitized.length <= DIALOGUE_SOFT_SPLIT_THRESHOLD) return [sanitized];
    const segmented = splitDialogueParagraph(sanitized);
    if (segmented.length > 1) return segmented;
    if (sanitized.length <= DIALOGUE_MAX_PARAGRAPH_LENGTH) return [sanitized];
    return hardSplitLongParagraph(sanitized, DIALOGUE_MAX_PARAGRAPH_LENGTH);
  }

  if (sanitized.length <= STRONG_CHUNK_THRESHOLD) return [sanitized];

  const strongSplit = mergeShortSegments(
    sanitized
      .replace(STRONG_SENTENCE_BREAK_REGEX, '$1\n')
      .split('\n')
  );
  if (strongSplit.length > 1) return strongSplit;

  const softSplit = mergeShortSegments(
    sanitized
      .replace(SOFT_SENTENCE_BREAK_REGEX, '$1\n')
      .split('\n')
  );
  if (softSplit.length > 1) return softSplit;

  return hardSplitLongParagraph(sanitized);
};
