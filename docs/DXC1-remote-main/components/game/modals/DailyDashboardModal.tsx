import React from 'react';
import { LayoutDashboard, Compass, ListChecks, Users, Backpack, Activity, CloudSun, MapPin } from 'lucide-react';
import { GameState } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { summarizeTaskStats } from './TasksModal';
import { summarizeContactStats } from './social/ContactsView';

interface DailyDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onOpenTasks?: () => void;
  onOpenSocial?: () => void;
}

interface DashboardPanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({ title, icon, children, actionLabel, onAction }) => (
  <section className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm min-h-[190px]" aria-label={title}>
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-zinc-100">
        <span className="text-blue-300">{icon}</span>
        {title}
      </h3>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-[11px] px-2.5 py-1 rounded-md border border-blue-400/40 text-blue-300 hover:text-white hover:border-blue-300 hover:bg-blue-500/10 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
    <div className="space-y-2 text-xs text-zinc-300">{children}</div>
  </section>
);

const StatRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-1 last:border-b-0 last:pb-0">
    <span className="text-zinc-500">{label}</span>
    <span className="font-medium text-zinc-100 text-right">{value}</span>
  </div>
);

export const DailyDashboardModal: React.FC<DailyDashboardModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onOpenTasks,
  onOpenSocial
}) => {
  if (!gameState) return null;

  const taskStats = summarizeTaskStats(gameState.任务 || []);
  const contactStats = summarizeContactStats(gameState.社交 || []);

  const combatMode = gameState.战斗模式 || (gameState.战斗?.是否战斗中 ? '战斗中' : '非战斗');
  const currentGoal =
    gameState.日常仪表盘?.当前目标 ||
    taskStats.currentObjective ||
    gameState.剧情?.引导?.当前目标 ||
    '暂无目标';

  const recentLog =
    gameState.日常仪表盘?.最近日志 ||
    gameState.日志?.[gameState.日志.length - 1]?.text ||
    '暂无日志';

  const openTasks = () => {
    onClose();
    onOpenTasks?.();
  };

  const openSocial = () => {
    onClose();
    onOpenSocial?.();
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="日常仪表盘 Daily Dashboard"
      icon={<LayoutDashboard size={20} />}
      size="xl"
      theme="monitor"
    >
      <div className="space-y-4">
        <div className="text-xs text-zinc-400 border border-white/5 bg-black/20 rounded-lg px-3 py-2">
          在非战斗阶段集中查看世界状态、任务推进、社交动态与资源概览。
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardPanel title="全局状态" icon={<Compass size={16} />}>
            <StatRow
              label="时间"
              value={
                <span className="inline-flex items-center gap-1">
                  <CloudSun size={12} className="text-blue-300" />
                  {gameState.游戏时间}
                </span>
              }
            />
            <StatRow label="天气" value={gameState.天气 || '未知'} />
            <StatRow
              label="场景"
              value={
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-blue-300" />
                  {gameState.当前地点 || '未知地点'}
                </span>
              }
            />
            <StatRow
              label="模式"
              value={
                <span className="inline-flex items-center gap-1">
                  <Activity size={12} className={combatMode === '战斗中' ? 'text-red-300' : 'text-emerald-300'} />
                  {combatMode}
                </span>
              }
            />
          </DashboardPanel>

          <DashboardPanel title="任务概览" icon={<ListChecks size={16} />} actionLabel="查看任务" onAction={openTasks}>
            <StatRow label="进行中" value={taskStats.active} />
            <StatRow label="已完成" value={taskStats.completed} />
            <StatRow label="已失败" value={taskStats.failed} />
            <StatRow label="当前目标" value={currentGoal} />
          </DashboardPanel>

          <DashboardPanel title="NPC 动态" icon={<Users size={16} />} actionLabel="查看社交" onAction={openSocial}>
            <StatRow label="在场人数" value={contactStats.presentCount} />
            <StatRow label="特别关注" value={contactStats.focusCount} />
            <StatRow
              label="最近互动"
              value={
                gameState.社交?.find(c => c.特别关注)?.姓名 ||
                gameState.社交?.find(c => c.是否在场)?.姓名 ||
                '暂无重点对象'
              }
            />
          </DashboardPanel>

          <DashboardPanel title="资源速览" icon={<Backpack size={16} />}>
            <StatRow label="HP" value={`${gameState.角色?.生命值 ?? 0} / ${gameState.角色?.最大生命值 ?? 0}`} />
            <StatRow label="MP" value={`${gameState.角色?.精神力 ?? 0} / ${gameState.角色?.最大精神力 ?? 0}`} />
            <StatRow label="背包项目" value={(gameState.背包 || []).length} />
            <StatRow label="最近日志" value={recentLog} />
          </DashboardPanel>
        </div>
      </div>
    </ModalWrapper>
  );
};
