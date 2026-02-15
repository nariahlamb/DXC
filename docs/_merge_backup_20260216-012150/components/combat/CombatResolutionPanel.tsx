import React from 'react';
import { CombatResolutionEvent } from '../../types/extended';

interface CombatResolutionPanelProps {
  events?: CombatResolutionEvent[];
}

const resultTone = (event: CombatResolutionEvent): string => {
  if (event.是否成功 === true) return 'text-emerald-300 border-emerald-600/40 bg-emerald-900/20';
  if (event.是否成功 === false) return 'text-rose-300 border-rose-600/40 bg-rose-900/20';
  return 'text-zinc-300 border-zinc-700/50 bg-black/20';
};

export const CombatResolutionPanel: React.FC<CombatResolutionPanelProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="bg-zinc-950/70 border border-zinc-800 rounded-sm p-3 shadow-sm">
        <div className="text-[11px] uppercase tracking-wide text-hestia-blue-300 mb-2">判定流水</div>
        <div className="text-[11px] text-zinc-500">暂无判定事件，等待 AI 返回 append_combat_resolution 指令。</div>
      </div>
    );
  }

  const latestEvents = [...events].slice(-8).reverse();

  return (
    <div className="bg-zinc-950/70 border border-zinc-800 rounded-sm p-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-hestia-blue-300 mb-2">判定流水</div>
      <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
        {latestEvents.map((event, idx) => (
          <div key={event.id || `${event.行动者}-${event.动作}-${idx}`} className="bg-black/30 border border-zinc-800 rounded px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-zinc-100">
                <span className="font-semibold">{event.行动者}</span>
                <span className="text-zinc-500"> → </span>
                <span className="font-semibold">{event.目标 || '环境'}</span>
                <span className="text-zinc-400"> · {event.动作}</span>
              </div>
              <div className={`text-[10px] px-1.5 py-0.5 border rounded ${resultTone(event)}`}>
                {event.是否成功 === true ? '成功' : event.是否成功 === false ? '失败' : '处理中'}
              </div>
            </div>

            <div className="mt-1 text-[11px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
              {event.骰子 && <span>骰子 {event.骰子}</span>}
              {typeof event.掷骰 === 'number' && <span>掷骰 {event.掷骰}</span>}
              {typeof event.修正 === 'number' && <span>修正 {event.修正 >= 0 ? `+${event.修正}` : event.修正}</span>}
              {typeof event.对抗值 === 'number' && <span>对抗 {event.对抗值}</span>}
              {typeof event.伤害 === 'number' && <span className="text-amber-300">伤害 {event.伤害}</span>}
            </div>

            {event.步骤 && event.步骤.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {event.步骤.slice(0, 4).map((step, stepIndex) => (
                  <span
                    key={`${event.id}-${step.标签}-${stepIndex}`}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300"
                  >
                    {step.标签}{typeof step.数值 === 'number' ? `:${step.数值}` : ''}
                  </span>
                ))}
              </div>
            )}

            {event.结果 && <div className="mt-1 text-[11px] text-cyan-200 leading-snug">{event.结果}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
