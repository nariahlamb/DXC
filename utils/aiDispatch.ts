import { GoogleGenAI } from "@google/genai";
import { AIEndpointConfig, AppSettings } from "../types";

// Cache Gemini instance to avoid re-instantiation overhead
let cachedGemini: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

export interface AIRequestOptions {
    responseFormat?: 'json' | 'text';
    signal?: AbortSignal | null;
    timeoutMs?: number;
    streamIdleTimeoutMs?: number;
}

export interface ResolveServiceConfigOptions {
    strictService?: boolean;
}

const REQUEST_TIMEOUT_MIN_MS = 1000;
const REQUEST_TIMEOUT_MAX_MS = 180000;
const REQUEST_TIMEOUT_DEFAULT_MS = 45000;
const STREAM_IDLE_TIMEOUT_MIN_MS = 2000;
const STREAM_IDLE_TIMEOUT_MAX_MS = 60000;
const STREAM_IDLE_TIMEOUT_DEFAULT_MS = 15000;
const DEFAULT_AI_ENDPOINT: AIEndpointConfig = {
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    modelId: 'gemini-3-flash-preview'
};

const normalizeTimeoutMs = (
    raw: unknown,
    fallback: number,
    minMs: number = REQUEST_TIMEOUT_MIN_MS,
    maxMs: number = REQUEST_TIMEOUT_MAX_MS
): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    if (normalized <= 0) return fallback;
    return Math.max(minMs, Math.min(maxMs, normalized));
};

const SERVICE_TIMEOUT_DEFAULTS: Record<string, number> = {
    story: 45000,
    phone: 35000,
    world: 35000,
    map: 45000,
    state: 30000,
    social: 30000,
    npcSync: 30000,
    npcBrain: 30000,
    memory: 20000
};

export const resolveRequestTimeoutMs = (
    settings: AppSettings,
    serviceKey: string,
    fallbackMs: number = REQUEST_TIMEOUT_DEFAULT_MS
): number => {
    const aiConfig = settings?.aiConfig as any;
    const perServiceRaw = aiConfig?.serviceRequestTimeoutMs?.[serviceKey];
    if (Number.isFinite(perServiceRaw)) {
        return normalizeTimeoutMs(perServiceRaw, fallbackMs);
    }
    if (Number.isFinite(aiConfig?.requestTimeoutMs)) {
        return normalizeTimeoutMs(aiConfig.requestTimeoutMs, fallbackMs);
    }
    const serviceDefault = SERVICE_TIMEOUT_DEFAULTS[serviceKey] ?? fallbackMs;
    return normalizeTimeoutMs(serviceDefault, fallbackMs);
};

export const resolveServiceConfig = (
    settings: AppSettings,
    serviceKey: string,
    options: ResolveServiceConfigOptions = {}
): AIEndpointConfig => {
    const aiConfig = settings.aiConfig;
    if (!aiConfig) {
        return { ...DEFAULT_AI_ENDPOINT };
    }

    const services = (aiConfig.services as any) || {};
    const routeKey = (
        serviceKey === 'story'
        || serviceKey === 'memory'
        || serviceKey === 'state'
        || serviceKey === 'map'
    ) ? serviceKey : 'state';
    const routedService = services?.[routeKey] as AIEndpointConfig | undefined;

    const resolved: AIEndpointConfig = {
        provider: routedService?.provider ?? DEFAULT_AI_ENDPOINT.provider,
        baseUrl: routedService?.baseUrl ?? DEFAULT_AI_ENDPOINT.baseUrl,
        apiKey: String(routedService?.apiKey ?? DEFAULT_AI_ENDPOINT.apiKey),
        modelId: routedService?.modelId ?? DEFAULT_AI_ENDPOINT.modelId,
        forceJsonOutput: routedService?.forceJsonOutput ?? DEFAULT_AI_ENDPOINT.forceJsonOutput
    };

    if (options.strictService && !resolved.apiKey.trim()) {
        return {
            ...resolved,
            apiKey: ''
        };
    }

    return resolved;
};

const createThrottledEmitter = (
    onStream?: (chunk: string) => void,
    opts: { intervalMs?: number; minChars?: number } = {}
) => {
    const intervalMs = opts.intervalMs ?? 80;
    const minChars = opts.minChars ?? 128;
    let lastEmit = 0;
    let pending = '';
    let cursor = 0;

    const emit = (fullText: string) => {
        if (!onStream) return;
        const addition = fullText.slice(cursor);
        if (addition) {
            pending += addition;
            cursor = fullText.length;
        }
        const now = Date.now();
        const shouldEmit = (now - lastEmit) >= intervalMs || pending.length >= minChars;
        if (shouldEmit && pending.length > 0) {
            onStream(pending);
            pending = '';
            lastEmit = now;
        }
    };

    const flush = (fullText: string) => {
        if (!onStream) return;
        const addition = fullText.slice(cursor);
        if (addition) {
            pending += addition;
            cursor = fullText.length;
        }
        if (pending.length > 0) {
            onStream(pending);
            pending = '';
            lastEmit = Date.now();
        }
    };

    return { emit, flush };
};

const collectOutputTextParts = (payload: any): string[] => {
    const parts: string[] = [];
    const output = Array.isArray(payload?.output)
        ? payload.output
        : Array.isArray(payload?.response?.output)
            ? payload.response.output
            : [];
    output.forEach((item: any) => {
        if (typeof item?.text === 'string' && item.text.trim()) {
            parts.push(item.text);
        }
        if (Array.isArray(item?.content)) {
            item.content.forEach((contentItem: any) => {
                const text = contentItem?.text ?? contentItem?.output_text;
                if (typeof text === 'string' && text.trim()) {
                    parts.push(text);
                }
            });
        }
    });
    return parts;
};

const extractTextFromContentShape = (value: any): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        const parts: string[] = [];
        value.forEach((item) => {
            if (!item) return;
            if (typeof item === 'string') {
                parts.push(item);
                return;
            }
            if (typeof item === 'object') {
                const text = item.text ?? item.output_text ?? item.content ?? item.value;
                if (typeof text === 'string' && text.trim()) {
                    parts.push(text);
                }
            }
        });
        return parts.join('');
    }
    if (value && typeof value === 'object') {
        const text = value.text ?? value.output_text ?? value.content ?? value.value;
        if (typeof text === 'string') return text;
    }
    return '';
};

const extractTextFromResponsePayload = (payload: any): string => {
    if (!payload || typeof payload !== 'object') return '';

    const directContent = extractTextFromContentShape(payload?.choices?.[0]?.message?.content);
    if (directContent.trim()) return directContent.trim();

    const choiceText = extractTextFromContentShape(payload?.choices?.[0]?.text);
    if (choiceText.trim()) return choiceText.trim();

    const directOutputText = extractTextFromContentShape(payload?.output_text ?? payload?.response?.output_text);
    if (directOutputText.trim()) return directOutputText.trim();

    const outputParts = collectOutputTextParts(payload);
    if (outputParts.length > 0) return outputParts.join('');

    return '';
};

type SseChunk = { kind: 'delta' | 'done' | 'ignore'; text: string };

const extractTextFromSsePayload = (payloadRaw: string): SseChunk => {
    const payload = String(payloadRaw || '').trim();
    if (!payload) return { kind: 'ignore', text: '' };
    if (/^\[done\]$/i.test(payload)) return { kind: 'done', text: '' };

    try {
        const data = JSON.parse(payload);

        const chatDelta = extractTextFromContentShape(data?.choices?.[0]?.delta?.content);
        if (chatDelta.length > 0) {
            return { kind: 'delta', text: chatDelta };
        }
        const chatDeltaText = extractTextFromContentShape(data?.choices?.[0]?.text);
        if (chatDeltaText.length > 0) {
            return { kind: 'delta', text: chatDeltaText };
        }
        const chatMessage = extractTextFromContentShape(data?.choices?.[0]?.message?.content);
        if (chatMessage.length > 0) {
            return { kind: 'delta', text: chatMessage };
        }

        const type = String(data?.type || '').toLowerCase();
        if (type === 'response.output_text.delta') {
            const delta = extractTextFromContentShape(data?.delta ?? data?.text_delta ?? data?.output_text?.delta);
            if (delta.length > 0) {
                return { kind: 'delta', text: delta };
            }
        }
        if (type === 'response.output_text.done') {
            const doneText = extractTextFromContentShape(data?.text ?? data?.output_text);
            if (doneText.length > 0) {
                return { kind: 'done', text: doneText };
            }
            return { kind: 'done', text: '' };
        }
        if (type === 'response.completed') {
            return { kind: 'done', text: '' };
        }

        const genericDelta = extractTextFromContentShape(
            data?.delta?.content
            ?? data?.delta?.text
            ?? data?.output?.[0]?.content?.[0]?.text
            ?? data?.message?.content
        );
        if (genericDelta) {
            return { kind: 'delta', text: genericDelta };
        }

        const fallback = extractTextFromResponsePayload(data);
        if (fallback) return { kind: 'delta', text: fallback };
    } catch {
        return { kind: 'ignore', text: '' };
    }

    return { kind: 'ignore', text: '' };
};

// Test hook: keep streaming-delta behavior covered without exposing internals as public API.
export const __aiDispatchTestHooks = {
    createThrottledEmitter,
    extractTextFromResponsePayload,
    extractTextFromSsePayload
};

const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

const isStreamTraceEnabled = () => {
    try {
        if (typeof window === 'undefined') return false;
        const byFlag = (window as any).__DXC_STREAM_TRACE === true;
        const byStorage = window.localStorage?.getItem('__DXC_STREAM_TRACE') === '1';
        return byFlag || byStorage;
    } catch {
        return false;
    }
};

export const dispatchAIRequest = async (
    config: AIEndpointConfig,
    systemPrompt: string,
    userContent: string,
    onStream?: (chunk: string) => void,
    options: AIRequestOptions = {}
): Promise<string> => {
    if (!config.apiKey) throw new Error(`Missing API Key for ${config.provider}`);
    const responseFormat = options.responseFormat ?? (config.forceJsonOutput ? 'json' : 'text');
    const forceJson = responseFormat === 'json' || (config.forceJsonOutput && responseFormat !== 'text');
    const requestedTimeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, Math.floor(options.timeoutMs as number)) : 0;
    // Custom OpenAI-compatible gateways often need long-running generation.
    // Disable client-side hard timeout for custom provider to avoid forced truncation.
    const timeoutMs = config.provider === 'custom' ? 0 : requestedTimeoutMs;
    const streamIdleTimeoutMs = Number.isFinite(options.streamIdleTimeoutMs)
        ? normalizeTimeoutMs(options.streamIdleTimeoutMs, STREAM_IDLE_TIMEOUT_DEFAULT_MS, STREAM_IDLE_TIMEOUT_MIN_MS, STREAM_IDLE_TIMEOUT_MAX_MS)
        : normalizeTimeoutMs(Math.floor((timeoutMs > 0 ? timeoutMs : STREAM_IDLE_TIMEOUT_DEFAULT_MS) / 3), STREAM_IDLE_TIMEOUT_DEFAULT_MS, STREAM_IDLE_TIMEOUT_MIN_MS, STREAM_IDLE_TIMEOUT_MAX_MS);
    const externalSignal = options.signal ?? undefined;
    const timeoutController = timeoutMs > 0 ? new AbortController() : null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let timeoutStarted = false;
    let timedOut = false;
    const startRequestTimeoutWatchdog = () => {
        if (!timeoutController || timeoutMs <= 0 || timeoutStarted) return;
        timeoutStarted = true;
        timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (!timeoutController.signal.aborted) {
                timeoutController.abort();
            }
        }, timeoutMs);
    };
    const onExternalAbort = () => {
        if (timeoutController && !timeoutController.signal.aborted) {
            timeoutController.abort();
        }
    };
    if (externalSignal) {
        if (externalSignal.aborted) {
            onExternalAbort();
        } else {
            externalSignal.addEventListener('abort', onExternalAbort, { once: true });
        }
    }
    const signal = timeoutController?.signal ?? externalSignal;
    const resolveErrorMessage = (providerLabel: string, error: any): Error => {
        if (timedOut && timeoutMs > 0) {
            return new Error(`${providerLabel} Request Timeout (${timeoutMs}ms)`);
        }
        if (error?.name === 'AbortError' || /abort/i.test(String(error?.message || ''))) {
            return new Error(`${providerLabel} Request Aborted`);
        }
        return new Error(`${providerLabel} Error: ${error?.message || 'unknown error'}`);
    };
    const cleanupSignal = () => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
        if (externalSignal) {
            externalSignal.removeEventListener('abort', onExternalAbort);
        }
    };

    try {
    if (config.provider === 'gemini') {
        // Use cached instance if API key matches
        if (!cachedGemini || cachedApiKey !== config.apiKey) {
            cachedGemini = new GoogleGenAI({ apiKey: config.apiKey });
            cachedApiKey = config.apiKey;
        }
        const ai = cachedGemini;
        const modelId = config.modelId || 'gemini-2.0-flash-exp'; // Updated to valid model

        try {
            const requestPayload: any = {
                model: modelId,
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userContent }] }
                ]
            };
            const requestConfig: any = {};
            if (forceJson) requestConfig.responseMimeType = "application/json";
            if (signal) requestConfig.abortSignal = signal;
            if (Object.keys(requestConfig).length > 0) requestPayload.config = requestConfig;
            startRequestTimeoutWatchdog();
            const responseStream = await ai.models.generateContentStream(requestPayload);

            let fullText = "";
            const emitter = createThrottledEmitter(onStream, { intervalMs: 80, minChars: 128 });
            const trace = isStreamTraceEnabled() && typeof onStream === 'function';
            const traceStart = nowMs();
            let firstChunkAt = 0;
            let chunkCount = 0;
            for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                    chunkCount += 1;
                    if (!firstChunkAt) firstChunkAt = nowMs();
                    fullText += text;
                    emitter.emit(fullText);
                }
            }
            emitter.flush(fullText);
            if (trace) {
                console.debug('[AI Stream Trace][gemini]', {
                    chunks: chunkCount,
                    firstChunkMs: firstChunkAt ? Number((firstChunkAt - traceStart).toFixed(1)) : null,
                    totalMs: Number((nowMs() - traceStart).toFixed(1)),
                    chars: fullText.length
                });
            }
            if (!fullText) return "{}";
            return fullText;
        } catch (e: any) {
            throw resolveErrorMessage('Gemini', e);
        }
    } else if (config.provider === 'openai' || config.provider === 'deepseek' || config.provider === 'custom') {
        let baseUrl = config.baseUrl;
        if (config.provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
        else if (config.provider === 'openai') baseUrl = 'https://api.openai.com/v1';
        if (config.provider === 'custom' && !String(baseUrl || '').trim()) {
            throw new Error('Custom provider requires a non-empty Base URL');
        }
        baseUrl = baseUrl.replace(/\/$/, "");
        const model = config.modelId || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

        try {
            const useStream = typeof onStream === 'function';
            const requestBody = JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
                stream: useStream,
                ...(forceJson ? { response_format: { type: "json_object" } } : {})
            });
            const responsesRequestBody = JSON.stringify({
                model: model,
                input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
                stream: useStream,
                ...(forceJson ? { text: { format: { type: "json_object" } } } : {})
            });
            const requestHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'Accept': useStream ? 'text/event-stream' : 'application/json'
            };
            startRequestTimeoutWatchdog();
            let response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: requestHeaders,
                ...(signal ? { signal } : {}),
                body: requestBody
            });
            if (
                !response.ok
                && config.provider === 'custom'
                && [400, 404, 405, 415, 422].includes(response.status)
            ) {
                response = await fetch(`${baseUrl}/responses`, {
                    method: 'POST',
                    headers: requestHeaders,
                    ...(signal ? { signal } : {}),
                    body: responsesRequestBody
                });
            }

            if (response.status === 429) {
                throw new Error("Rate Limit Exceeded (429). Please try again later.");
            }

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API Error ${response.status}: ${err}`);
            }
            if (!useStream) {
                const data = await response.json();
                const content = extractTextFromResponsePayload(data);
                if (typeof content === 'string' && content.trim()) return content.trim();
                throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
            }
            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";
            let rawBody = "";
            let eventDataLines: string[] = [];
            let hasDeltaChunk = false;
            const emitter = createThrottledEmitter(onStream, { intervalMs: 80, minChars: 128 });
            const trace = isStreamTraceEnabled();
            const traceStart = nowMs();
            let firstChunkAt = 0;
            let chunkCount = 0;
            const appendChunkText = (text: string, kind: 'delta' | 'done') => {
                if (!text) return;
                if (kind === 'done' && hasDeltaChunk) return;
                chunkCount += 1;
                if (!firstChunkAt) firstChunkAt = nowMs();
                fullText += text;
                if (kind === 'delta') hasDeltaChunk = true;
                emitter.emit(fullText);
            };
            const flushSseEvent = () => {
                if (eventDataLines.length === 0) return;
                const payload = eventDataLines.join('\n');
                eventDataLines = [];
                const chunk = extractTextFromSsePayload(payload);
                if (chunk.kind === 'ignore') return;
                if (chunk.kind === 'done') {
                    appendChunkText(chunk.text, 'done');
                    return;
                }
                appendChunkText(chunk.text, 'delta');
            };
            const consumeSseLine = (line: string) => {
                const normalized = line.replace(/\r$/, '');
                if (!normalized.trim()) {
                    flushSseEvent();
                    return;
                }
                if (normalized.startsWith('data:')) {
                    eventDataLines.push(normalized.slice(5).replace(/^\s*/, ''));
                }
            };
            const readWithIdleTimeout = async () => {
                if (streamIdleTimeoutMs <= 0) {
                    return reader.read();
                }
                return await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
                    const idleTimer = setTimeout(() => {
                        reject(new Error(`OpenAI-compatible stream idle timeout (${streamIdleTimeoutMs}ms)`));
                    }, streamIdleTimeoutMs);
                    reader.read()
                        .then((result) => {
                            clearTimeout(idleTimer);
                            resolve(result);
                        })
                        .catch((error) => {
                            clearTimeout(idleTimer);
                            reject(error);
                        });
                });
            };
            while (true) {
                const { done, value } = await readWithIdleTimeout();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                rawBody += chunk;
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";
                for (const line of lines) {
                    consumeSseLine(line);
                }
            }
            if (buffer.trim()) {
                consumeSseLine(buffer);
            }
            flushSseEvent();
            emitter.flush(fullText);
            if (trace) {
                console.debug('[AI Stream Trace][openai-compatible]', {
                    chunks: chunkCount,
                    firstChunkMs: firstChunkAt ? Number((firstChunkAt - traceStart).toFixed(1)) : null,
                    totalMs: Number((nowMs() - traceStart).toFixed(1)),
                    chars: fullText.length
                });
            }
            if (!fullText) {
                const candidate = rawBody.trim();
                if (candidate) {
                    try {
                        const parsed = JSON.parse(candidate);
                        const content = extractTextFromResponsePayload(parsed);
                        if (typeof content === 'string' && content.trim()) return content.trim();
                    } catch {}
                    return candidate;
                }
                return "{}";
            }
            return fullText;
        } catch (e: any) {
            throw resolveErrorMessage(config.provider, e);
        }
    }
    throw new Error(`Unknown provider`);
    } finally {
        cleanupSignal();
    }
};
