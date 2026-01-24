import React from 'react';
import { X, Star, Zap } from 'lucide-react';
import { Skill } from '../../../types';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: Skill[];
}

const getSkillValue = (skill: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = skill[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const formatValue = (value: any) => {
  if (Array.isArray(value)) return value.map(String).join(' / ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const SkillsModal: React.FC<SkillsModalProps> = ({ isOpen, onClose, skills }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-zinc-900 border-t-8 border-blue-600 relative shadow-[0_20px_50px_rgba(37,99,235,0.3)] max-h-[80vh] flex flex-col">
        <div className="p-6 flex justify-between items-end border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-black">
          <div className="flex flex-col">
            <span className="text-blue-600 font-display text-lg uppercase tracking-widest">Skill Archive</span>
            <h2 className="text-5xl font-display uppercase tracking-wider text-white italic">技能</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-10 h-10" />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {skills.length > 0 ? skills.map((skill, index) => {
              const data = skill as Record<string, any>;
              const name = data.名称 || data.name || '未命名技能';
              const cost = getSkillValue(data, ['消耗', 'MP消耗', 'SP消耗', '消耗类型']);
              const attribute = getSkillValue(data, ['属性', '元素']);
              const skillType = getSkillValue(data, ['类型', '类别']);
              const cooldown = getSkillValue(data, ['冷却', '冷却时间']);
              const range = getSkillValue(data, ['范围']);
              const duration = getSkillValue(data, ['持续', '持续时间']);
              const trigger = getSkillValue(data, ['触发', '发动条件', '条件']);
              const level = getSkillValue(data, ['等级', '阶级']);
              const command = getSkillValue(data, ['指令', '使用指令']);
              const prerequisite = getSkillValue(data, ['前置', '解锁条件']);
              const restriction = getSkillValue(data, ['限制', '代价', '使用限制']);
              const effect = getSkillValue(data, ['效果', '特效']);
              const description = getSkillValue(data, ['描述', '说明']);
              const note = getSkillValue(data, ['备注', '补充']);
              const tagsRaw = getSkillValue(data, ['标签', 'tag']);
              const tags = [
                ...(Array.isArray(tagsRaw) ? tagsRaw.map(String) : (tagsRaw ? [String(tagsRaw)] : [])),
                data.稀有 ? '稀有' : null
              ].filter(Boolean) as string[];

              const metaItems = [
                { label: '类型', value: skillType },
                { label: '属性', value: attribute },
                { label: '冷却', value: cooldown },
                { label: '范围', value: range },
                { label: '持续', value: duration },
                { label: '触发', value: trigger },
                { label: '等级', value: level },
                { label: '指令', value: command },
                { label: '前置', value: prerequisite },
                { label: '限制', value: restriction }
              ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');

              return (
                <div key={skill.id || `${name}_${index}`} className="group relative bg-zinc-950 p-6 border border-zinc-800 hover:border-blue-600 transition-all overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 text-zinc-800 group-hover:text-blue-900/30 transition-colors transform rotate-12">
                    <Zap size={96} />
                  </div>

                  <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl text-white font-bold group-hover:text-blue-400 transition-colors">{name}</h3>
                          {data.稀有 && <Star className="text-yellow-400" size={16} fill="currentColor" />}
                        </div>
                        {(attribute || skillType) && (
                          <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-1">
                            {[attribute, skillType].filter(Boolean).map(formatValue).join(' / ')}
                          </div>
                        )}
                      </div>
                      {cost !== undefined && (
                        <span className="text-xs font-mono text-cyan-300 border border-cyan-900 px-2 py-0.5">
                          消耗 {formatValue(cost)}
                        </span>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-widest text-blue-200/80">
                        {tags.map((tag, idx) => (
                          <span key={`${tag}_${idx}`} className="border border-blue-900/70 px-2 py-0.5 bg-blue-950/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {(description || effect) && (
                      <div className="text-zinc-300 text-sm leading-relaxed">
                        {description && <p>{description}</p>}
                        {effect && (
                          <div className="mt-3 border border-blue-900/60 bg-blue-950/30 p-2 text-xs text-blue-100">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-blue-300 mb-1">效果</div>
                            <div className="leading-relaxed">{effect}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {metaItems.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-zinc-400 border-t border-zinc-800 pt-3">
                        {metaItems.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">{item.label}</span>
                            <span className="text-zinc-300 text-right">{formatValue(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(note || restriction) && (
                      <div className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
                        {note && <div>补充: {formatValue(note)}</div>}
                        {restriction && <div>限制: {formatValue(restriction)}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full text-center text-zinc-500 font-display text-2xl py-20">
                暂未习得技能
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
