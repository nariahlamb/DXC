export type CurrencyAmountMatch = {
  amount: number;
  index: number;
  raw: string;
};

const CURRENCY_SUFFIX = '(?:法利|法莉|瓦利斯|瓦利|valis)';
const ARABIC_AMOUNT_REGEX = new RegExp(`([+-]?\\d+(?:\\.\\d+)?)\\s*${CURRENCY_SUFFIX}`, 'giu');
const CJK_AMOUNT_REGEX = new RegExp(`([正负負]?[零〇一二三四五六七八九十百千万萬亿億两兩壹贰貳叁參肆伍陆陸柒捌玖拾佰仟]+)\\s*${CURRENCY_SUFFIX}`, 'giu');

const CJK_DIGIT_MAP: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  贰: 2,
  貳: 2,
  两: 2,
  兩: 2,
  三: 3,
  叁: 3,
  參: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  陸: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9
};

const CJK_SMALL_UNIT_MAP: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000
};

const CJK_LARGE_UNIT_MAP: Record<string, number> = {
  万: 10000,
  萬: 10000,
  亿: 100000000,
  億: 100000000
};

const parseChineseAmount = (raw: string): number | null => {
  const text = String(raw || '').trim();
  if (!text) return null;
  let sign = 1;
  let body = text;
  const first = body.charAt(0);
  if (first === '负' || first === '負') {
    sign = -1;
    body = body.slice(1);
  } else if (first === '正') {
    body = body.slice(1);
  }
  if (!body) return null;

  let total = 0;
  let section = 0;
  let digit = 0;
  let seen = false;
  for (const char of body) {
    if (Object.prototype.hasOwnProperty.call(CJK_DIGIT_MAP, char)) {
      digit = CJK_DIGIT_MAP[char];
      seen = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(CJK_SMALL_UNIT_MAP, char)) {
      const unit = CJK_SMALL_UNIT_MAP[char];
      section += (digit || 1) * unit;
      digit = 0;
      seen = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(CJK_LARGE_UNIT_MAP, char)) {
      const unit = CJK_LARGE_UNIT_MAP[char];
      section += digit;
      total += (section || 1) * unit;
      section = 0;
      digit = 0;
      seen = true;
      continue;
    }
    return null;
  }
  if (!seen) return null;
  const value = (total + section + digit) * sign;
  if (!Number.isFinite(value)) return null;
  return value;
};

export const extractValisAmountMatches = (text: string): CurrencyAmountMatch[] => {
  const source = String(text || '');
  if (!source.trim()) return [];

  const matches: CurrencyAmountMatch[] = [];
  let arabicMatch: RegExpExecArray | null = null;
  ARABIC_AMOUNT_REGEX.lastIndex = 0;
  while ((arabicMatch = ARABIC_AMOUNT_REGEX.exec(source)) !== null) {
    const amount = Number(arabicMatch[1]);
    if (!Number.isFinite(amount)) continue;
    matches.push({
      amount,
      index: arabicMatch.index,
      raw: arabicMatch[0]
    });
  }

  let cjkMatch: RegExpExecArray | null = null;
  CJK_AMOUNT_REGEX.lastIndex = 0;
  while ((cjkMatch = CJK_AMOUNT_REGEX.exec(source)) !== null) {
    const amount = parseChineseAmount(cjkMatch[1]);
    if (!Number.isFinite(amount || NaN)) continue;
    matches.push({
      amount: Number(amount),
      index: cjkMatch.index,
      raw: cjkMatch[0]
    });
  }

  return matches
    .filter((item) => Number.isFinite(item.amount) && item.amount !== 0)
    .sort((a, b) => a.index - b.index);
};
