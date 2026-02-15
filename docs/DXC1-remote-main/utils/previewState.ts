import { GameState, InventoryItem } from '../types';
import { getDefaultEquipSlot } from './itemUtils';

export type PreviewCommand = {
    kind?: 'EQUIP' | 'UNEQUIP' | 'USE';
    slotKey?: string;
    itemId?: string;
    itemName?: string;
    quantity?: number;
};

const resolveSlotKey = (cmd: PreviewCommand, item?: InventoryItem | null): string => {
    if (cmd.slotKey) return cmd.slotKey;
    if (!item) return '';
    return getDefaultEquipSlot(item);
};

export const buildPreviewState = (gameState: GameState, commands?: PreviewCommand[] | null): GameState => {
    if (!commands || commands.length === 0) return gameState;

    const next: GameState = {
        ...gameState,
        角色: { ...gameState.角色, 装备: { ...(gameState.角色?.装备 || {}) } },
        背包: Array.isArray(gameState.背包) ? gameState.背包.map(item => ({ ...item })) : []
    };

    const findItemIndex = (itemId?: string, itemName?: string) => {
        if (itemId) {
            const idx = next.背包.findIndex(i => i.id === itemId);
            if (idx >= 0) return idx;
        }
        if (itemName) return next.背包.findIndex(i => i.名称 === itemName);
        return -1;
    };

    commands.forEach((cmd) => {
        if (cmd.kind === 'EQUIP') {
            const idx = findItemIndex(cmd.itemId, cmd.itemName);
            const item = idx >= 0 ? next.背包[idx] : null;
            const slotKey = resolveSlotKey(cmd, item);
            if (slotKey) {
                next.角色.装备[slotKey] = cmd.itemName || item?.名称 || next.角色.装备[slotKey];
            }
            if (item) {
                item.已装备 = true;
                if (slotKey) item.装备槽位 = slotKey;
            }
        } else if (cmd.kind === 'UNEQUIP') {
            const slotKey = cmd.slotKey;
            if (slotKey) next.角色.装备[slotKey] = '';
            const idx = findItemIndex(cmd.itemId, cmd.itemName);
            const item = idx >= 0 ? next.背包[idx] : null;
            if (item) {
                item.已装备 = false;
                item.装备槽位 = undefined;
            }
        } else if (cmd.kind === 'USE') {
            const idx = findItemIndex(cmd.itemId, cmd.itemName);
            if (idx >= 0) {
                const item = next.背包[idx];
                const nextQty = (item.数量 || 1) - (cmd.quantity || 1);
                if (nextQty <= 0) next.背包.splice(idx, 1);
                else item.数量 = nextQty;
            }
        }
    });

    return next;
};

