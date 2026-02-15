import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InitiativeProps {
  order?: string[];
  current?: string | null;
  unitNames?: Record<string, string>;
}

interface BattleTimelineProps {
  logs: string[];
  initiative?: InitiativeProps;
}

const InitiativeTrack: React.FC<InitiativeProps> = ({ order, current, unitNames }) => {
  if (!order || order.length === 0) return null;
  return (
    <div className="bg-zinc-950/80 border border-hestia-blue-700/60 rounded-sm p-2 text-xs text-zinc-100 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-wide text-hestia-blue-300 mb-1">Initiative</div>
      <div className="flex flex-wrap gap-1">
        {order.map(id => {
          const isCurrent = current === id;
          const label = unitNames?.[id] || id;
          return (
            <span
              key={id}
              className={`px-2 py-1 rounded-sm border text-[11px] ${isCurrent
                ? 'border-hestia-blue-400 bg-hestia-blue-900/60 text-hestia-blue-50'
                : 'border-zinc-700 bg-zinc-900/60 text-zinc-200'
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const BattleTimeline: React.FC<BattleTimelineProps> = ({ logs, initiative }) => {
  const recentLogs = logs.slice(-5).reverse();

  return (
    <div className="absolute top-4 left-4 md:left-auto md:right-4 z-20 w-64 md:w-80 pointer-events-none space-y-2">
      {initiative?.order && initiative.order.length > 0 && (
        <InitiativeTrack
          order={initiative.order}
          current={initiative.current ?? null}
          unitNames={initiative.unitNames}
        />
      )}
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {recentLogs.map((log, index) => (
            <motion.div
              key={`${log}-${index}`}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1 - index * 0.15, x: 0, height: 'auto' }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`
                p-2 rounded-sm border-l-2 text-xs font-mono shadow-sm backdrop-blur-sm
                ${index === 0
                  ? 'bg-zinc-900/90 border-hestia-blue-500 text-hestia-blue-100'
                  : 'bg-zinc-950/60 border-zinc-700 text-zinc-400'
                }
              `}
            >
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
