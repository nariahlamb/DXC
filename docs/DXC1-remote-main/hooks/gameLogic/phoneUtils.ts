import { GameState } from '../../types';

const nextThreadId = (used: Set<string>, startFrom: number) => {
    let cursor = startFrom;
    let candidate = '';
    do {
        cursor += 1;
        candidate = `Thr${String(cursor).padStart(3, '0')}`;
    } while (used.has(candidate));
    used.add(candidate);
    return { id: candidate, cursor };
};

const normalizePhoneThreadIds = (state: GameState) => {
    const phone = state.手机;
    const dialog = phone?.对话;
    if (!phone || !dialog) return false;
    const buckets: Array<{ key: 'private' | 'group' | 'public'; list: any[] }> = [
        { key: 'private', list: Array.isArray(dialog.私聊) ? dialog.私聊 : [] },
        { key: 'group', list: Array.isArray(dialog.群聊) ? dialog.群聊 : [] },
        { key: 'public', list: Array.isArray(dialog.公共频道) ? dialog.公共频道 : [] }
    ];
    const used = new Set<string>();
    let maxSeq = 0;
    for (const bucket of buckets) {
        for (const thread of bucket.list) {
            const tid = typeof thread?.id === 'string' ? thread.id.trim() : '';
            const match = tid.match(/^Thr(\d+)$/);
            if (match) {
                const seq = Number(match[1]);
                if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq);
            }
        }
    }

    let changed = false;
    const threadMap = new Map<string, string>();
    for (const bucket of buckets) {
        for (let i = 0; i < bucket.list.length; i += 1) {
            const thread = bucket.list[i];
            const rawId = typeof thread?.id === 'string' ? thread.id.trim() : '';
            let nextId = rawId;
            if (!nextId || used.has(nextId)) {
                const created = nextThreadId(used, maxSeq);
                nextId = created.id;
                maxSeq = created.cursor;
            } else {
                used.add(nextId);
            }
            if (nextId !== rawId) {
                bucket.list[i] = { ...thread, id: nextId };
                changed = true;
            }
            const threadType = bucket.key;
            const title = typeof bucket.list[i]?.标题 === 'string' ? bucket.list[i].标题 : '';
            if (title) {
                threadMap.set(`${threadType}:${title}`, nextId);
            }
        }
    }

    if (changed && Array.isArray(phone.待发送)) {
        phone.待发送 = phone.待发送.map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            const threadType = item.threadType;
            const title = item.threadTitle;
            const mappedId = typeof threadType === 'string' && typeof title === 'string'
                ? threadMap.get(`${threadType}:${title}`)
                : undefined;
            if (mappedId && item.threadId !== mappedId) {
                return { ...item, threadId: mappedId };
            }
            return item;
        });
    }

    return changed;
};

export const ensurePhoneStateBase = (state: GameState) => {
    if (!state.手机) return state;
    const phone = state.手机;
    if (!phone.对话) {
        phone.对话 = { 私聊: [], 群聊: [], 公共频道: [] };
    } else {
        if (!Array.isArray(phone.对话.私聊)) phone.对话.私聊 = [];
        if (!Array.isArray(phone.对话.群聊)) phone.对话.群聊 = [];
        if (!Array.isArray(phone.对话.公共频道)) phone.对话.公共频道 = [];
    }
    if (!phone.待发送) phone.待发送 = [];
    normalizePhoneThreadIds(state);
    return state;
};
