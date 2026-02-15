import { AIResponse } from "../types";

export const extractThinkingBlocks = (rawText: string): { cleaned: string; thinking?: string } => {
    if (!rawText) return { cleaned: rawText };
    const matches = Array.from(rawText.matchAll(/<thinking>([\s\S]*?)<\/thinking>|<think>([\s\S]*?)<\/think>/gi));
    if (matches.length === 0) return { cleaned: rawText };
    const thinking = matches
        .map(m => (m[1] || m[2] || "").trim())
        .filter(Boolean)
        .join('\n\n');
    const cleaned = rawText.replace(/<thinking>[\s\S]*?<\/thinking>|<think>[\s\S]*?<\/think>/gi, '').trim();
    return { cleaned, thinking };
};

export const normalizeThinkingField = (value?: unknown): string => {
    if (typeof value !== 'string') return "";
    const extracted = extractThinkingBlocks(value).thinking;
    return (extracted || value).trim();
};

export const mergeThinkingSegments = (response?: Partial<AIResponse>): string => {
    if (!response) return "";
    const thinkingPre = normalizeThinkingField((response as any).thinking_pre);
    const thinkingPlan = normalizeThinkingField((response as any).thinking_plan);
    const thinkingStyle = normalizeThinkingField((response as any).thinking_style);
    const thinkingDraft = normalizeThinkingField((response as any).thinking_draft);
    const thinkingCheck = normalizeThinkingField((response as any).thinking_check);
    const thinkingCanon = normalizeThinkingField((response as any).thinking_canon);
    const thinkingVarsPre = normalizeThinkingField((response as any).thinking_vars_pre);
    const thinkingVarsOther = normalizeThinkingField((response as any).thinking_vars_other);
    const thinkingVarsMerge = normalizeThinkingField((response as any).thinking_vars_merge);
    const thinkingGap = normalizeThinkingField((response as any).thinking_gap);
    const thinkingVarsPost = normalizeThinkingField((response as any).thinking_vars_post);
    const thinkingStory = normalizeThinkingField((response as any).thinking_story);
    const thinkingPost = normalizeThinkingField((response as any).thinking_post);
    const thinkingLegacy = normalizeThinkingField((response as any).thinking);
    const segments: string[] = [];
    if (thinkingPre) segments.push(`[思考-前]\n${thinkingPre}`);
    if (thinkingPlan) segments.push(`[剧情预先思考]\n${thinkingPlan}`);
    if (thinkingStyle) segments.push(`[文风思考]\n${thinkingStyle}`);
    if (thinkingDraft) segments.push(`[思考-草稿]\n${thinkingDraft}`);
    if (thinkingCheck) segments.push(`[剧情合理性校验]\n${thinkingCheck}`);
    if (thinkingCanon) segments.push(`[原著思考]\n${thinkingCanon}`);
    if (thinkingVarsPre) segments.push(`[变量预思考]\n${thinkingVarsPre}`);
    if (thinkingVarsOther) segments.push(`[其他功能变量]\n${thinkingVarsOther}`);
    if (thinkingVarsMerge) segments.push(`[变量融入剧情矫正]\n${thinkingVarsMerge}`);
    if (thinkingGap) segments.push(`[查缺补漏思考]\n${thinkingGap}`);
    if (thinkingStory) segments.push(`[思考-完整]\n${thinkingStory}`);
    if (thinkingPost) segments.push(`[思考-后]\n${thinkingPost}`);
    if (thinkingVarsPost) segments.push(`[变量矫正思考]\n${thinkingVarsPost}`);
    if (!thinkingPre && !thinkingPlan && !thinkingStyle && !thinkingDraft && !thinkingCheck && !thinkingCanon && !thinkingVarsPre && !thinkingVarsOther && !thinkingVarsMerge && !thinkingGap && !thinkingVarsPost && !thinkingStory && !thinkingPost && thinkingLegacy) segments.push(thinkingLegacy);
    return segments.join('\n\n').trim();
};
