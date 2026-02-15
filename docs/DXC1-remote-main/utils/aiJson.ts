import { AIResponse } from "../types";

export const extractJsonFromFences = (rawText: string): string[] => {
    if (!rawText) return [];
    const blocks: string[] = [];
    const regex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
        const candidate = String(match[1] || '').trim();
        if (candidate) blocks.push(candidate);
    }
    return blocks;
};

export const extractJsonFromFence = (rawText: string): string | null => {
    const blocks = extractJsonFromFences(rawText);
    return blocks.length > 0 ? blocks[0] : null;
};

export const extractFirstJsonObject = (rawText: string): string | null => {
    const start = rawText.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            if (inString) escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (ch === '{') depth += 1;
            if (ch === '}') {
                depth -= 1;
                if (depth === 0) return rawText.slice(start, i + 1);
            }
        }
    }
    return null;
};

export const balanceJsonBraces = (rawText: string): { text: string; changed: boolean } => {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            if (inString) escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (ch === '{') depth += 1;
            if (ch === '}') depth = Math.max(0, depth - 1);
        }
    }
    if (depth <= 0) return { text: rawText, changed: false };
    return { text: rawText + '}'.repeat(depth), changed: true };
};

export const removeTrailingCommas = (rawText: string): { text: string; changed: boolean } => {
    const repaired = rawText.replace(/,\s*([}\]])/g, '$1');
    return { text: repaired, changed: repaired !== rawText };
};

export const escapeControlCharsInStrings = (rawText: string): { text: string; changed: boolean } => {
    if (!rawText) return { text: rawText, changed: false };
    let inString = false;
    let escaped = false;
    let changed = false;
    const out: string[] = [];
    for (let i = 0; i < rawText.length; i += 1) {
        const ch = rawText[i];
        if (escaped) {
            out.push(ch);
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            out.push(ch);
            if (inString) escaped = true;
            continue;
        }
        if (ch === '"') {
            out.push(ch);
            inString = !inString;
            continue;
        }
        if (inString) {
            if (ch === '\n') {
                out.push('\\n');
                changed = true;
                continue;
            }
            if (ch === '\r') {
                out.push('\\r');
                changed = true;
                continue;
            }
            if (ch === '\t') {
                out.push('\\t');
                changed = true;
                continue;
            }
            const code = ch.charCodeAt(0);
            if (code >= 0 && code < 0x20) {
                out.push(`\\u${code.toString(16).padStart(4, '0')}`);
                changed = true;
                continue;
            }
        }
        out.push(ch);
    }
    return { text: out.join(''), changed };
};

const extractBalancedArrayByKey = (rawText: string, key: string): string | null => {
    const keyToken = `"${key}"`;
    let searchFrom = 0;
    while (searchFrom < rawText.length) {
        const keyIndex = rawText.indexOf(keyToken, searchFrom);
        if (keyIndex < 0) return null;

        let cursor = keyIndex + keyToken.length;
        while (cursor < rawText.length && /\s/.test(rawText[cursor])) cursor += 1;
        if (rawText[cursor] !== ':') {
            searchFrom = keyIndex + 1;
            continue;
        }

        cursor += 1;
        while (cursor < rawText.length && /\s/.test(rawText[cursor])) cursor += 1;
        if (rawText[cursor] !== '[') {
            searchFrom = keyIndex + 1;
            continue;
        }

        const start = cursor;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < rawText.length; i += 1) {
            const ch = rawText[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                if (inString) escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (ch === '[') depth += 1;
                if (ch === ']') {
                    depth -= 1;
                    if (depth === 0) {
                        return rawText.slice(start, i + 1);
                    }
                }
            }
        }

        // Matched key but array is incomplete; no further safe extraction.
        return null;
    }

    return null;
};

export const parseAIResponseText = (
    rawText: string
): { response?: AIResponse; repaired: boolean; repairNote?: string; error?: string } => {
    const cleaned = rawText.trim();
    const candidates: { text: string; note?: string; source: 'cleaned' | 'firstObject' | 'fenced' }[] = [];
    const firstObject = extractFirstJsonObject(cleaned);
    const fencedBlocks = extractJsonFromFences(cleaned);

    // Prefer the full/primary object first; fenced blocks are fallback or supplemental.
    candidates.push({ text: cleaned, source: 'cleaned' });
    if (firstObject && firstObject !== cleaned) {
        candidates.push({ text: firstObject, note: "已截断JSON之外内容", source: 'firstObject' });
    }
    fencedBlocks.forEach((block, idx) => {
        candidates.push({
            text: block,
            note: idx === 0 ? "已移除代码块包裹" : `已移除代码块包裹(块${idx + 1})`,
            source: 'fenced'
        });
    });

    const hasCorePayload = (value: any) => {
        if (!value || typeof value !== 'object') return false;
        if (Array.isArray(value.logs)) return true;
        if (Array.isArray(value.tavern_commands)) return true;
        if (typeof value.narrative === 'string') return true;
        if (typeof value.allowed === 'boolean') return true;
        if (Array.isArray(value.messages)) return true;
        if (value.phone_updates && typeof value.phone_updates === 'object') return true;
        return false;
    };
    const getActionOptions = (value: any) => {
        if (!value || typeof value !== 'object') return null;
        if (Array.isArray(value.action_options)) return value.action_options;
        if (Array.isArray(value.可选行动列表)) return value.可选行动列表;
        return null;
    };
    const isActionOptionsOnly = (value: any) => {
        if (!value || typeof value !== 'object') return false;
        const keys = Object.keys(value);
        if (keys.length === 0) return false;
        const hasOptions = getActionOptions(value) !== null;
        const hasOnlyOptionKeys = keys.every(k => k === 'action_options' || k === '可选行动列表');
        return hasOptions && hasOnlyOptionKeys;
    };

    let lastError: any = null;
    const parsedCandidates: Array<{ parsed: any; note?: string; source: 'cleaned' | 'firstObject' | 'fenced' }> = [];
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.text);
            parsedCandidates.push({ parsed, note: candidate.note, source: candidate.source });
        } catch (err: any) {
            lastError = err;
        }
    }

    if (parsedCandidates.length > 0) {
        const primary =
            parsedCandidates.find(item => hasCorePayload(item.parsed) && !isActionOptionsOnly(item.parsed))
            || parsedCandidates.find(item => hasCorePayload(item.parsed))
            || parsedCandidates[0];

        const primaryOptions = getActionOptions(primary.parsed);
        if (!primaryOptions || primaryOptions.length === 0) {
            const optionCandidate = parsedCandidates.find(item => getActionOptions(item.parsed)?.length > 0 && item !== primary);
            if (optionCandidate) {
                const merged = { ...primary.parsed, action_options: getActionOptions(optionCandidate.parsed) };
                const notes = [primary.note, "已合并追加的action_options块"].filter(Boolean).join("，");
                return {
                    response: merged as AIResponse,
                    repaired: true,
                    repairNote: notes
                };
            }
        }

        return {
            response: primary.parsed as AIResponse,
            repaired: !!primary.note,
            repairNote: primary.note
        };
    }

    const baseCandidate = firstObject || cleaned;
    const repairNotes: string[] = [];

    const trimmed = baseCandidate.trim();
    let repairedText = trimmed;

    const commaRepair = removeTrailingCommas(repairedText);
    repairedText = commaRepair.text;
    if (commaRepair.changed) repairNotes.push("已移除尾随逗号");

    const controlCharRepair = escapeControlCharsInStrings(repairedText);
    repairedText = controlCharRepair.text;
    if (controlCharRepair.changed) repairNotes.push("已转义字符串内控制字符");

    const braceRepair = balanceJsonBraces(repairedText);
    repairedText = braceRepair.text;
    if (braceRepair.changed) repairNotes.push("已补齐缺失括号");

    try {
        const parsed = JSON.parse(repairedText);
        const optionCandidate = fencedBlocks
            .map(block => {
                try { return JSON.parse(block); } catch { return null; }
            })
            .find(obj => Array.isArray((obj as any)?.action_options) || Array.isArray((obj as any)?.可选行动列表));
        const merged = optionCandidate && !Array.isArray((parsed as any)?.action_options)
            ? { ...(parsed as any), action_options: (optionCandidate as any).action_options || (optionCandidate as any).可选行动列表 }
            : parsed;
        if (merged !== parsed) repairNotes.push("已合并追加的action_options块");
        const note = repairNotes.length > 0 ? repairNotes.join("，") : "已自动修复JSON结构";
        return { response: merged as AIResponse, repaired: true, repairNote: note };
    } catch (err: any) {
        return { repaired: false, error: lastError?.message || err?.message || "JSON解析失败" };
    }
};

export const extractServiceCommands = (rawText: string): { tavern_commands: any[]; rawResponse: string; repairNote?: string } => {
    const parsed = parseAIResponseText(rawText);
    const response = parsed.response as any;
    const tryExtractFromEnvelope = (payload: any): any[] | null => {
        if (!payload || typeof payload !== 'object') return null;
        if (Array.isArray(payload.tavern_commands)) return payload.tavern_commands;
        const contentCandidates: unknown[] = [
            payload?.choices?.[0]?.message?.content,
            payload?.choices?.[0]?.delta?.content,
            payload?.response?.choices?.[0]?.message?.content,
            payload?.response?.output_text,
            payload?.output_text,
            payload?.output?.[0]?.content?.[0]?.text
        ];
        for (const content of contentCandidates) {
            if (typeof content !== 'string' || !content.trim()) continue;
            const nested = parseAIResponseText(content);
            const nestedResponse = nested.response as any;
            if (nestedResponse && Array.isArray(nestedResponse.tavern_commands)) {
                return nestedResponse.tavern_commands;
            }
        }
        return null;
    };
    const tryExtractFromSseBody = (text: string): any[] | null => {
        if (typeof text !== 'string' || !text.includes('data:')) return null;
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        let fullText = '';
        let hasDelta = false;
        for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            if (/^data:\s*\[done\]\s*$/i.test(line)) continue;
            const dataPart = line.replace(/^data:\s*/, '');
            if (!dataPart) continue;
            try {
                const obj = JSON.parse(dataPart);
                const deltaText = obj?.choices?.[0]?.delta?.content;
                const msgText = obj?.choices?.[0]?.message?.content;
                const eventType = String(obj?.type || '').toLowerCase();
                const responseDelta = eventType === 'response.output_text.delta'
                    ? (obj?.delta ?? obj?.text_delta ?? obj?.output_text?.delta)
                    : undefined;
                const responseDone = eventType === 'response.output_text.done'
                    ? (obj?.text ?? obj?.output_text)
                    : undefined;
                if (typeof deltaText === 'string') {
                    fullText += deltaText;
                    hasDelta = true;
                }
                if (typeof responseDelta === 'string') {
                    fullText += responseDelta;
                    hasDelta = true;
                }
                if (typeof msgText === 'string' && !fullText) fullText = msgText;
                if (typeof responseDone === 'string' && !hasDelta && !fullText) fullText = responseDone;
                if (Array.isArray(obj?.tavern_commands)) return obj.tavern_commands;
            } catch {
                // ignore malformed SSE chunk
            }
        }
        if (!fullText.trim()) return null;
        const nested = parseAIResponseText(fullText);
        const nestedResponse = nested.response as any;
        if (nestedResponse && Array.isArray(nestedResponse.tavern_commands)) {
            return nestedResponse.tavern_commands;
        }
        return null;
    };

    if (response && Array.isArray(response.tavern_commands)) {
        return {
            tavern_commands: response.tavern_commands,
            rawResponse: rawText,
            ...(parsed.repairNote ? { repairNote: parsed.repairNote } : {})
        };
    }
    const envelopeCommands = tryExtractFromEnvelope(response);
    if (envelopeCommands) {
        return {
            tavern_commands: envelopeCommands,
            rawResponse: rawText,
            repairNote: [parsed.repairNote, 'Envelope content extraction'].filter(Boolean).join(' | ')
        };
    }
    const sseCommands = tryExtractFromSseBody(rawText);
    if (sseCommands) {
        return {
            tavern_commands: sseCommands,
            rawResponse: rawText,
            repairNote: [parsed.repairNote, 'SSE payload extraction'].filter(Boolean).join(' | ')
        };
    }

    // Fallback: balanced extraction for tavern_commands when full payload is mixed or malformed.
    try {
        const extractedArray = extractBalancedArrayByKey(rawText, 'tavern_commands');
        if (extractedArray) {
            const fallbackCommands = JSON.parse(extractedArray);
            if (Array.isArray(fallbackCommands)) {
                return {
                    tavern_commands: fallbackCommands,
                    rawResponse: rawText,
                    repairNote: "Balanced tavern_commands extraction"
                };
            }
        }
    } catch (e) {
        // Fallback failed, return empty
    }

    return {
        tavern_commands: [],
        rawResponse: rawText,
        ...(parsed.repairNote ? { repairNote: parsed.repairNote } : {})
    };
};
