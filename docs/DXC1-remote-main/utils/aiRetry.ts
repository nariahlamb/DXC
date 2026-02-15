export type RetryDecisionContext = {
  error: unknown;
  attempt: number;
  maxAttempts: number;
};

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  backoffFactor?: number;
  signal?: AbortSignal | null;
  shouldRetry?: (context: RetryDecisionContext) => boolean;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message || '';
  return String(error ?? '');
};

const isAbortLikeError = (error: unknown): boolean => {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes('abort') ||
    message.includes('cancel') ||
    message.includes('canceled') ||
    message.includes('cancelled')
  );
};

export const isRetryableServiceError = (error: unknown): boolean => {
  const message = toErrorMessage(error).toLowerCase();
  if (!message) return false;
  if (isAbortLikeError(error)) return false;

  return (
    /\b429\b/.test(message) ||
    /\b408\b/.test(message) ||
    /\b5\d{2}\b/.test(message) ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('gateway')
  );
};

export const isRetryableMemoryError = isRetryableServiceError;

const sleep = async (ms: number, signal?: AbortSignal | null): Promise<void> => {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Retry aborted'));
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

export const executeWithRetry = async <T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 0);
  const backoffFactor = Math.max(1, options.backoffFactor ?? 2);
  const shouldRetry = options.shouldRetry ?? (() => false);

  let attempt = 1;
  while (attempt <= maxAttempts) {
    if (options.signal?.aborted) {
      throw new Error('Retry aborted');
    }
    try {
      return await task();
    } catch (error) {
      const retryable = shouldRetry({ error, attempt, maxAttempts });
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = baseDelayMs * Math.pow(backoffFactor, Math.max(0, attempt - 1));
      await sleep(delayMs, options.signal);
      attempt += 1;
    }
  }
  throw new Error('Retry attempts exhausted');
};
