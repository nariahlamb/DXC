import React from 'react';
import clsx from 'clsx';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { InventoryItem } from '../../types';

type StatTone = 'atk' | 'def' | 'heal' | 'value' | 'weight' | 'neutral';

interface StatEntry {
  key: string;
  label: string;
  value: unknown;
  tone: StatTone;
  prefix?: string;
}

interface UnifiedItemDetailSectionsProps {
  item: InventoryItem;
  className?: string;
}

const hasValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const formatValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.join('、');
  return String(value);
};

const toList = (value?: string[] | string): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const coreStatRows = (item: InventoryItem): StatEntry[] => {
  const rows: StatEntry[] = [
    { key: '攻击力', label: '攻击', value: item.攻击力, tone: 'atk', prefix: '+' },
    { key: '防御力', label: '防御', value: item.防御力, tone: 'def', prefix: '+' },
    { key: '恢复量', label: '恢复', value: item.恢复量, tone: 'heal' },
    { key: '价值', label: '估值', value: item.价值, tone: 'value' },
    { key: '重量', label: '重量', value: item.重量, tone: 'weight' },
    { key: '等级需求', label: '等级需求', value: item.等级需求, tone: 'neutral' },
  ];

  return rows.filter((row) => hasValue(row.value));
};

const statToneClass: Record<StatTone, string> = {
  atk: 'text-red-400 border-red-500/20 bg-red-500/5',
  def: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
  heal: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  value: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  weight: 'text-zinc-300 border-zinc-500/20 bg-zinc-500/5',
  neutral: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
};

const dedupeStrings = (rows: { label: string; value: string }[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const fingerprint = `${row.label}:${row.value}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
};

export const UnifiedItemDetailSections: React.FC<UnifiedItemDetailSectionsProps> = ({ item, className }) => {
  const stats = coreStatRows(item);
  const maxDurability = item.最大耐久 ?? item.耐久 ?? 100;
  const durabilityPercent = item.耐久 !== undefined
    ? Math.min(100, Math.max(0, (Number(item.耐久) / Number(maxDurability || 1)) * 100))
    : null;

  const basicMeta = dedupeStrings([
    hasValue(item.装备槽位) ? { label: '槽位', value: formatValue(item.装备槽位) } : null,
    hasValue(item.来源) ? { label: '来源', value: formatValue(item.来源) } : null,
    hasValue(item.材质) ? { label: '材质', value: formatValue(item.材质) } : null,
    hasValue(item.制作者) ? { label: '制作者', value: formatValue(item.制作者) } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry)));

  const effects = dedupeStrings([
    hasValue(item.效果) ? { label: '特效', value: formatValue(item.效果) } : null,
    hasValue(item.攻击特效) ? { label: '攻击特效', value: formatValue(item.攻击特效) } : null,
    hasValue(item.防御特效) ? { label: '防御特效', value: formatValue(item.防御特效) } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry)));

  const affixes = Array.isArray(item.附加属性)
    ? item.附加属性.filter((entry) => hasValue(entry?.名称) && hasValue(entry?.数值))
    : [];

  const weaponMeta = item.武器
    ? dedupeStrings([
        hasValue(item.武器.类型) ? { label: '武器类型', value: formatValue(item.武器.类型) } : null,
        hasValue(item.武器.伤害类型) ? { label: '伤害类型', value: formatValue(item.武器.伤害类型) } : null,
        hasValue(item.武器.射程) ? { label: '射程', value: formatValue(item.武器.射程) } : null,
        hasValue(item.武器.攻速) ? { label: '攻速', value: formatValue(item.武器.攻速) } : null,
        hasValue(item.武器.双手) ? { label: '双手武器', value: formatValue(item.武器.双手) } : null,
        ...toList(item.武器.特性).map((feature) => ({ label: '武器特性', value: feature })),
      ].filter((entry): entry is { label: string; value: string } => Boolean(entry)))
    : [];

  const armorMeta = item.防具
    ? dedupeStrings([
        hasValue(item.防具.类型) ? { label: '防具类型', value: formatValue(item.防具.类型) } : null,
        hasValue(item.防具.部位) ? { label: '防具部位', value: formatValue(item.防具.部位) } : null,
        hasValue(item.防具.护甲等级) ? { label: '护甲等级', value: formatValue(item.防具.护甲等级) } : null,
        ...toList(item.防具.抗性).map((resistance) => ({ label: '抗性', value: resistance })),
      ].filter((entry): entry is { label: string; value: string } => Boolean(entry)))
    : [];

  const magicSwordMeta = item.魔剑
    ? dedupeStrings([
        hasValue(item.魔剑.魔法名称) ? { label: '魔法名称', value: formatValue(item.魔剑.魔法名称) } : null,
        hasValue(item.魔剑.属性) ? { label: '属性', value: formatValue(item.魔剑.属性) } : null,
        hasValue(item.魔剑.威力) ? { label: '威力', value: formatValue(item.魔剑.威力) } : null,
        hasValue(item.魔剑.触发方式) ? { label: '触发方式', value: formatValue(item.魔剑.触发方式) } : null,
        hasValue(item.魔剑.冷却) ? { label: '冷却', value: formatValue(item.魔剑.冷却) } : null,
        hasValue(item.魔剑.剩余次数) ? { label: '剩余次数', value: formatValue(item.魔剑.剩余次数) } : null,
        hasValue(item.魔剑.最大次数) ? { label: '最大次数', value: formatValue(item.魔剑.最大次数) } : null,
        hasValue(item.魔剑.破损率) ? { label: '破损率', value: formatValue(item.魔剑.破损率) } : null,
        hasValue(item.魔剑.过载惩罚) ? { label: '过载惩罚', value: formatValue(item.魔剑.过载惩罚) } : null,
        hasValue(item.魔剑.备注) ? { label: '备注', value: formatValue(item.魔剑.备注) } : null,
      ].filter((entry): entry is { label: string; value: string } => Boolean(entry)))
    : [];

  return (
    <div className={clsx('space-y-2 sm:space-y-4', className)}>
      {stats.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
            <SlidersHorizontal size={10} /> 属性
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((row) => (
              <div
                key={row.key}
                className={clsx('border p-2 rounded flex justify-between items-center', statToneClass[row.tone])}
              >
                <span className="text-[10px] opacity-80">{row.label}</span>
                <span className="font-mono font-bold">
                  {row.prefix ?? ''}
                  {formatValue(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.描述 && (
        <div className="relative pl-4 border-l-2 border-white/10 py-1">
          <p className="text-sm text-content-secondary leading-relaxed font-serif italic opacity-90">{item.描述}</p>
        </div>
      )}

      {durabilityPercent !== null && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-1">耐久度</div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-zinc-400" style={{ width: `${durabilityPercent}%` }} />
          </div>
          <div className="text-right text-[10px] text-zinc-500 font-mono mt-1">
            {item.耐久} / {maxDurability}
          </div>
        </div>
      )}

      {basicMeta.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {basicMeta.map((entry, index) => (
            <div key={`${entry.label}-${index}`} className="bg-black/40 border border-white/5 p-2 rounded flex justify-between">
              <span className="text-[10px] text-zinc-500">{entry.label}</span>
              <span className="text-zinc-300 font-mono text-[11px]">{entry.value}</span>
            </div>
          ))}
        </div>
      )}

      {effects.length > 0 && (
        <div className="space-y-2">
          {effects.map((entry, index) => (
            <div key={`${entry.label}-${index}`} className="text-xs text-cyan-300/80 px-2 py-1.5 border-l-2 border-cyan-500 bg-cyan-900/10">
              <span className="text-cyan-200 font-bold mr-2">{entry.label}:</span>
              {entry.value}
            </div>
          ))}
        </div>
      )}

      {affixes.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-2">附加属性</div>
          <div className="space-y-1.5">
            {affixes.map((entry, index) => (
              <div key={`${entry.名称}-${index}`} className="text-[11px] text-zinc-300 flex items-center justify-between bg-black/30 border border-white/5 rounded px-2 py-1">
                <span className="text-zinc-400">{entry.名称}</span>
                <span className="font-mono text-cyan-300">{entry.数值}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(weaponMeta.length > 0 || armorMeta.length > 0) && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-2">装备信息</div>
          <div className="grid grid-cols-2 gap-2">
            {[...weaponMeta, ...armorMeta].map((entry, index) => (
              <div key={`${entry.label}-${index}`} className="bg-black/40 border border-white/5 p-2 rounded flex justify-between">
                <span className="text-[10px] text-zinc-500">{entry.label}</span>
                <span className="text-zinc-300 font-mono text-[11px]">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {magicSwordMeta.length > 0 && (
        <div className="border border-purple-500/30 bg-purple-900/10 p-3 rounded space-y-1.5">
          <div className="text-[10px] text-purple-400 font-bold uppercase mb-1 flex items-center gap-1">
            <Sparkles size={12} /> 魔剑信息
          </div>
          {magicSwordMeta.map((entry, index) => (
            <div key={`${entry.label}-${index}`} className="text-[11px] text-purple-200/90 flex items-center justify-between gap-3">
              <span className="text-purple-300/80">{entry.label}</span>
              <span className="font-mono text-right">{entry.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
