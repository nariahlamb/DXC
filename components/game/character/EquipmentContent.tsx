
import React, { useState } from 'react';
import { Swords, Shield, User, Shirt, Hand, Footprints, Star, Trash2 } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { getQualityLabel, getTypeLabel } from '../../../utils/itemUtils';
import clsx from 'clsx';
import { UnifiedItemDetailSections } from '../UnifiedItemDetailSections';
import { findBestInventoryMatch } from '../../../utils/equipmentLinking';

export const EquipmentContent: React.FC<{
    equipment: any;
    inventory: InventoryItem[];
    onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
}> = ({ equipment, inventory, onUnequipItem }) => {
    const [selectedEquip, setSelectedEquip] = useState<InventoryItem | null>(null);
    const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

    const getQualityLabelSafe = (quality?: string) => { try { return getQualityLabel(quality); } catch { return quality || '普通'; } };
    const getTypeLabelSafe = (type?: string) => { try { return getTypeLabel(type); } catch { return type || '其他'; } };

    const qualityColor = (q?: string) => {
        const label = getQualityLabelSafe(q);
        if (label.includes('传说') || label.includes('E')) return 'text-amber-400 border-amber-500/30';
        if (label.includes('史诗') || label.includes('D')) return 'text-purple-400 border-purple-500/30';
        if (label.includes('稀有') || label.includes('C')) return 'text-blue-400 border-blue-500/30';
        if (label.includes('优良') || label.includes('B')) return 'text-green-400 border-green-500/30';
        return 'text-zinc-400 border-zinc-700/30';
    };

    const SLOT_CONFIG = [
        { key: '主手', label: '主手', icon: <Swords size={18} /> },
        { key: '副手', label: '副手', icon: <Shield size={18} /> },
        { key: '头部', label: '头部', icon: <User size={18} /> },
        { key: '身体', label: '身体', icon: <Shirt size={18} /> },
        { key: '手部', label: '手部', icon: <Hand size={18} /> },
        { key: '腿部', label: '腿部', icon: <Shield size={18} /> },
        { key: '足部', label: '足部', icon: <Footprints size={18} /> },
        { key: '饰品1', label: '饰品1', icon: <Star size={18} /> },
        { key: '饰品2', label: '饰品2', icon: <Star size={18} /> },
        { key: '饰品3', label: '饰品3', icon: <Star size={18} /> },
    ];

    const SLOT_ALIASES: Record<string, string[]> = {
        主手: ['武器'],
        身体: ['躯干'],
    };

    const equippedItems = SLOT_CONFIG.map(slot => {
        const keys = [slot.key, ...(SLOT_ALIASES[slot.key] || [])];
        const matchedKey = keys.find((key) => equipment?.[key]);
        const raw = matchedKey ? equipment?.[matchedKey] : null;
        if (!raw) return { ...slot, item: null, matchedKey: slot.key };
        const item = typeof raw === 'string' ? { 名称: raw } : raw;
        return { ...slot, item, matchedKey };
    });

    const getEquipMeta = (item: any): InventoryItem | null => {
        if (!item) return null;
        const itemName = item.名称 || item.name;
        const matched = findBestInventoryMatch(Array.isArray(inventory) ? inventory : [], { id: item.id, name: itemName });
        if (matched) return matched;

        const normalized = {
            ...item,
            id: item.id || itemName || `equip_${Date.now()}`,
            名称: itemName || '未知装备',
            描述: item.描述 || '',
            数量: item.数量 ?? 1,
            类型: item.类型 || '武器',
            品质: item.品质 || item.quality,
        };

        return normalized as InventoryItem;
    };

    const resolvedItems = equippedItems.map((slot) => {
        const equipMeta = slot.item ? getEquipMeta(slot.item) : null;
        return { ...slot, equipMeta };
    });

    const getQuickStats = (item?: InventoryItem | null) => {
        if (!item) return [] as string[];
        const rows = [
            item.攻击力 !== undefined ? `攻 ${item.攻击力}` : null,
            item.防御力 !== undefined ? `防 ${item.防御力}` : null,
            item.恢复量 !== undefined ? `回 ${item.恢复量}` : null,
            item.价值 !== undefined ? `值 ${item.价值}` : null,
            item.重量 !== undefined ? `重 ${item.重量}` : null,
        ].filter((entry): entry is string => Boolean(entry));
        return rows;
    };

    // Auto-select first item on load
    const hasAutoSelected = React.useRef(false);
    React.useEffect(() => {
        if (!hasAutoSelected.current && resolvedItems.length > 0) {
            const firstEquipped = resolvedItems.find(s => s.equipMeta);
            if (firstEquipped && firstEquipped.equipMeta) {
                setSelectedEquip(firstEquipped.equipMeta);
                setSelectedSlotKey(firstEquipped.matchedKey || firstEquipped.key);
                hasAutoSelected.current = true;
            }
        }
    }, [resolvedItems]);

    return (
        <div className="p-2 sm:p-6 h-full min-h-0">
            <div className="flex flex-row gap-2 sm:gap-4 h-full min-h-0">
                {/* Left: Equipment List (Compact on Mobile) */}
                <div className="w-[80px] sm:w-[240px] xl:w-[44%] flex-none shrink-0 space-y-1.5 sm:space-y-2 overflow-y-auto custom-scrollbar pr-0 sm:pr-1 pb-2">
                {resolvedItems.map(slot => {
                    const equipMeta = slot.equipMeta;
                    const quickStats = getQuickStats(equipMeta);
                    const selected = selectedEquip?.id === equipMeta?.id && selectedEquip?.名称 === equipMeta?.名称;

                    return (
                    <div
                        key={slot.key}
                        onClick={() => {
                            if (!equipMeta && !selectedEquip) return; // Allow clicking empty slots if functionality added later, for now only equip
                            if (equipMeta) {
                                setSelectedEquip(equipMeta);
                                setSelectedSlotKey(slot.matchedKey || slot.key);
                            } else {
                                // Optional: Handle empty slot selection
                                setSelectedEquip(null);
                                setSelectedSlotKey(null);
                            }
                        }}
                        className={clsx(
                            'group relative p-1 sm:p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-3',
                            equipMeta
                                ? clsx(
                                    `bg-zinc-900/40 ${qualityColor(equipMeta.品质).split(' ')[1]} hover:bg-zinc-800/60`,
                                    selected && 'ring-1 ring-cyan-400/50 bg-zinc-800/80 shadow-[0_0_10px_rgba(34,211,238,0.15)]'
                                )
                                : 'bg-zinc-900/20 border-zinc-800/30 opacity-60'
                        )}
                    >
                        <div className={clsx(
                            'w-9 h-9 sm:w-10 sm:h-10 rounded-md sm:rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            equipMeta ? 'bg-zinc-800/60' : 'bg-zinc-900/40'
                        )}>
                            <span className={clsx(equipMeta ? qualityColor(equipMeta.品质).split(' ')[0] : 'text-zinc-700', 'scale-90 sm:scale-100')}>
                                {slot.icon}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0 w-full flex flex-col justify-center">
                            <div className="text-[9px] sm:text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5 mt-0.5 sm:mt-0">{slot.label}</div>
                            {equipMeta ? (
                                <>
                                    <div className={clsx('text-[10px] sm:text-sm font-bold truncate w-full', qualityColor(equipMeta.品质).split(' ')[0])}>
                                        {equipMeta.名称}
                                    </div>
                                    {quickStats.length > 0 && (
                                        <div className="hidden sm:flex flex-wrap gap-2 mt-1 text-[10px] text-zinc-500">
                                            {quickStats.slice(0, 3).map((entry, index) => (
                                                <span key={`${entry}-${index}`}>{entry}</span>
                                            ))}
                                            {quickStats.length > 3 && <span>...</span>}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-[10px] sm:text-xs text-zinc-700 italic">Empty</div>
                            )}
                        </div>
                        
                        {/* Desktop Keep Unequip Button */}
                        {equipMeta && (
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onUnequipItem(slot.matchedKey || slot.key, equipMeta.名称, equipMeta.id);
                                }}
                                className="hidden sm:block absolute top-2 right-2 p-1.5 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/50 text-[10px] font-bold uppercase transition-colors opacity-0 group-hover:opacity-100"
                                title="卸下"
                            >
                                            <Trash2 size={12} />
                            </button>
                        )}
                        
                        {/* Mobile Selection Indicator */}
                        {selected && (
                             <div className="sm:hidden absolute inset-0 border-2 border-cyan-400/30 rounded-lg pointer-events-none animate-pulse"></div>
                        )}
                    </div>
                    );
                })}
                </div>

                {/* Right: Detail Panel */}
                <div className="flex-1 min-w-0 border border-white/10 rounded-xl bg-zinc-950/80 p-2 sm:p-4 space-y-2 overflow-y-auto custom-scrollbar relative">
                    {selectedEquip ? (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-white/5">
                                <div className="min-w-0">
                                    <div className={clsx('text-sm sm:text-base font-bold truncate', qualityColor(selectedEquip.品质).split(' ')[0])}>
                                        {selectedEquip.名称}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-2 mt-0.5">
                                        <span>{getTypeLabelSafe(selectedEquip.类型)}</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                        <span>{getQualityLabelSafe(selectedEquip.品质)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        onClick={() => setSelectedEquip(null)}
                                        className="sm:hidden text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                                    >
                                        关闭
                                    </button>
                                    {selectedSlotKey && (
                                        <button
                                            onClick={() => onUnequipItem(selectedSlotKey, selectedEquip.名称, selectedEquip.id)}
                                            className="text-[10px] px-2 py-1.5 sm:py-1 flex items-center gap-1.5 rounded border border-red-900/70 bg-red-900/20 text-red-300 hover:text-red-100 transition-colors"
                                        >
                                                        <Trash2 size={12} />
                                            <span>卸下</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                               <UnifiedItemDetailSections item={selectedEquip} />
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600/50">
                             <Shield size={40} className="mb-3 opacity-20" />
                             <span className="text-xs font-bold uppercase tracking-widest text-center px-4">
                                 选择装备<br/>查看详情
                             </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
