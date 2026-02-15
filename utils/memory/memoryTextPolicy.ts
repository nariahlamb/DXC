export const MEMORY_SUMMARY_MIN_LENGTH = 180;
export const MEMORY_SUMMARY_MAX_LENGTH = 240;
export const MEMORY_OUTLINE_MIN_LENGTH = 40;
export const MEMORY_OUTLINE_MAX_LENGTH = 120;

export type MemoryLengthValidation = {
  valid: boolean;
  length: number;
  min: number;
  max: number;
};

export const normalizeMemoryText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

export const isNumericPlaceholderText = (text: string): boolean => {
  const normalized = normalizeMemoryText(text);
  return !!normalized && /^\d+$/.test(normalized);
};

const validateLengthRange = (
  text: unknown,
  min: number,
  max: number
): MemoryLengthValidation => {
  const normalized = normalizeMemoryText(text);
  const length = normalized.length;
  return {
    valid: length >= min && length <= max,
    length,
    min,
    max
  };
};

export const validateSummaryLength = (text: unknown): MemoryLengthValidation =>
  validateLengthRange(text, MEMORY_SUMMARY_MIN_LENGTH, MEMORY_SUMMARY_MAX_LENGTH);

export const validateOutlineLength = (text: unknown): MemoryLengthValidation =>
  validateLengthRange(text, MEMORY_OUTLINE_MIN_LENGTH, MEMORY_OUTLINE_MAX_LENGTH);

export const isMemorySummaryTextValid = (text: unknown): boolean => {
  const normalized = normalizeMemoryText(text);
  if (!normalized || isNumericPlaceholderText(normalized)) return false;
  return validateSummaryLength(normalized).valid;
};

export const isMemoryOutlineTextValid = (text: unknown): boolean => {
  const normalized = normalizeMemoryText(text);
  if (!normalized || isNumericPlaceholderText(normalized)) return false;
  return validateOutlineLength(normalized).valid;
};
