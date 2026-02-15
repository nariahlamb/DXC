import { sanitizeLogText } from './logTextFormat';

export type StoryLogLike = {
  sender?: unknown;
  text?: unknown;
  content?: unknown;
};

export type NormalizedStoryLog = {
  sender: string;
  text: string;
};

type NormalizeStoryResponseLogsOptions = {
  rawLogs?: StoryLogLike[] | null;
  narrative?: unknown;
  fallbackLogs?: StoryLogLike[] | null;
  knownSpeakers?: string[];
  defaultNarrator?: string;
};

const SPEAKER_CUE_REGEX = /([A-Za-z\u4e00-\u9fff·•]{1,16})[：:]\s*/g;
const NON_DIALOGUE_SPEAKER_HINT = new Set([
  '时间',
  '地点',
  '场景',
  '状态',
  '系统',
  '提示',
  '说明',
  '备注',
  '任务',
  '日志',
  '旁白'
]);

const normalizeKey = (value: string) => value.trim().toLowerCase();

const normalizeSpeaker = (value: unknown, defaultNarrator: string): string => {
  const sender = String(value ?? '').trim();
  if (!sender) return defaultNarrator;
  const key = normalizeKey(sender);
  if (key === 'narrative' || key === 'narrator' || key === 'scene') return defaultNarrator;
  return sender;
};

const isLikelyDialogueCue = (
  speaker: string,
  speech: string,
  knownSpeakerKeys: Set<string>
): boolean => {
  const trimmedSpeaker = speaker.trim();
  const trimmedSpeech = speech.trim();
  if (!trimmedSpeaker || !trimmedSpeech) return false;
  if (NON_DIALOGUE_SPEAKER_HINT.has(trimmedSpeaker)) return false;
  if (knownSpeakerKeys.has(normalizeKey(trimmedSpeaker))) return true;
  if (/^[「『“"']/.test(trimmedSpeech)) return true;
  if (trimmedSpeaker.length <= 4 && /[。！？!?]$/.test(trimmedSpeech)) return true;
  return false;
};

const pushIfValid = (
  list: NormalizedStoryLog[],
  sender: string,
  text: string
) => {
  const normalizedText = sanitizeLogText(text);
  if (!normalizedText.trim()) return;
  list.push({ sender, text: normalizedText });
};

const splitLineBySpeakerCue = (
  line: string,
  fallbackSender: string,
  defaultNarrator: string,
  knownSpeakerKeys: Set<string>
): NormalizedStoryLog[] => {
  const output: NormalizedStoryLog[] = [];
  const matches: { speaker: string; markerStart: number; markerEnd: number }[] = [];
  SPEAKER_CUE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPEAKER_CUE_REGEX.exec(line)) !== null) {
    matches.push({
      speaker: String(match[1] || '').trim(),
      markerStart: match.index,
      markerEnd: match.index + match[0].length
    });
  }
  if (matches.length === 0) {
    pushIfValid(output, fallbackSender, line);
    return output;
  }

  let cursor = 0;
  let createdDialogue = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];

    if (current.markerStart > cursor) {
      const narrativePrefix = line.slice(cursor, current.markerStart).trim();
      if (narrativePrefix) {
        pushIfValid(output, defaultNarrator, narrativePrefix);
      }
    }

    const speechEnd = next ? next.markerStart : line.length;
    const speech = line.slice(current.markerEnd, speechEnd).trim();
    const speaker = normalizeSpeaker(current.speaker, defaultNarrator);
    if (isLikelyDialogueCue(speaker, speech, knownSpeakerKeys)) {
      pushIfValid(output, speaker, speech);
      createdDialogue += 1;
    } else {
      const merged = `${current.speaker}：${speech}`.trim();
      pushIfValid(output, fallbackSender, merged);
    }
    cursor = speechEnd;
  }

  if (createdDialogue === 0) {
    return [{ sender: fallbackSender, text: sanitizeLogText(line) }];
  }
  return output;
};

const splitMixedNarrativeDialogue = (
  text: string,
  sender: string,
  defaultNarrator: string,
  knownSpeakerKeys: Set<string>
): NormalizedStoryLog[] => {
  const normalizedText = sanitizeLogText(text);
  if (!normalizedText.trim()) return [];
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const shouldTrySplitByCue = sender === defaultNarrator || sender === '系统';
  if (!shouldTrySplitByCue) {
    return [{ sender, text: normalizedText }];
  }

  const output: NormalizedStoryLog[] = [];
  lines.forEach((line) => {
    const parts = splitLineBySpeakerCue(line, sender, defaultNarrator, knownSpeakerKeys);
    parts.forEach((part) => output.push(part));
  });
  return output;
};

export const normalizeStoryResponseLogs = (
  options: NormalizeStoryResponseLogsOptions
): NormalizedStoryLog[] => {
  const defaultNarrator = String(options.defaultNarrator || '旁白').trim() || '旁白';
  const knownSpeakerKeys = new Set(
    (options.knownSpeakers || [])
      .map((name) => normalizeKey(String(name || '').trim()))
      .filter(Boolean)
  );
  knownSpeakerKeys.add(normalizeKey(defaultNarrator));
  knownSpeakerKeys.add('player');

  const sourceLogs = Array.isArray(options.rawLogs) ? options.rawLogs : [];
  const fallbackLogs = Array.isArray(options.fallbackLogs) ? options.fallbackLogs : [];
  const narrativeText = sanitizeLogText(String(options.narrative ?? ''));

  const candidates: StoryLogLike[] = sourceLogs.length > 0
    ? sourceLogs
    : (narrativeText
      ? [{ sender: defaultNarrator, text: narrativeText }]
      : fallbackLogs);

  const output: NormalizedStoryLog[] = [];
  candidates.forEach((item) => {
    const sender = normalizeSpeaker(item?.sender, defaultNarrator);
    const rawText = String(item?.text ?? item?.content ?? '');
    const parts = splitMixedNarrativeDialogue(rawText, sender, defaultNarrator, knownSpeakerKeys);
    parts.forEach((part) => {
      if (!part.text.trim()) return;
      output.push(part);
    });
  });

  return output;
};
