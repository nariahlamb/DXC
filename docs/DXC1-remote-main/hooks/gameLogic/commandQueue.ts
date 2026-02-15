import { useState } from 'react';

// REG-001 FIX: Export CommandKind type to fix import error in useGameLogic.ts
export type CommandKind = 'EQUIP' | 'UNEQUIP' | 'USE' | 'TOGGLE';

export type CommandItem = {
    id: string;
    text: string;
    undoAction?: () => void;
    dedupeKey?: string;
    slotKey?: string;
    kind?: CommandKind;
    itemId?: string;
    itemName?: string;
    quantity?: number;
};

export const useCommandQueue = () => {
    const [commandQueue, setCommandQueue] = useState<CommandItem[]>([]);
    const [pendingCommands, setPendingCommands] = useState<CommandItem[]>([]);

    const addToQueue = (
        cmd: string,
        undoAction?: () => void,
        dedupeKey?: string,
        meta?: Partial<CommandItem>
    ) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const nextItem: CommandItem = { id, text: cmd, undoAction, dedupeKey, ...meta };
        setCommandQueue(prev => {
            let next = prev;

            if (dedupeKey) {
                next = next.filter(c => c.dedupeKey !== dedupeKey);
            }

            if ((nextItem.kind === 'EQUIP' || nextItem.kind === 'UNEQUIP') && nextItem.slotKey) {
                next = next.filter(c => {
                    if (!(c.kind === 'EQUIP' || c.kind === 'UNEQUIP')) return true;
                    if (c.slotKey !== nextItem.slotKey) return true;
                    return c.kind === nextItem.kind;
                });
            }

            return [...next, nextItem];
        });
    };

    const removeFromQueue = (id: string) => setCommandQueue(prev => prev.filter(c => c.id !== id));

    const clearPendingCommands = () => setPendingCommands([]);

    const consumeCommandQueue = (): CommandItem[] => {
        if (commandQueue.length === 0) return [];
        const current = [...commandQueue];
        setPendingCommands(current);
        setCommandQueue([]);
        return current;
    };

    return {
        commandQueue,
        pendingCommands,
        addToQueue,
        removeFromQueue,
        clearPendingCommands,
        consumeCommandQueue,
        setPendingCommands,
    };
};
