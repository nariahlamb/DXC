import type { AppSettings, GameState, TavernCommand } from '../../../types';
import { buildStateServiceInputPayload } from '../../../utils/state/stateServiceInput';
import { extractValisAmountMatches } from '../../../utils/state/currencyAmount';

export type MemoryFillJobInput = {
  turnIndex: number;
  playerInput: string;
  logs: { sender: string; text: string }[];
  appliedCommands: TavernCommand[];
  stateSnapshot: GameState;
  enqueuedAt: number;
};

export type ServiceInputMeta = {
  playerInput: string;
  logs: { sender: string; text: string }[];
  appliedCommands: TavernCommand[];
  turnIndex?: number;
  memoryJobs?: MemoryFillJobInput[];
};

export type ServiceInputBuilderContext = {
  settings: AppSettings;
  isMemoryParallelBySheetEnabled: () => boolean;
  resolveStateRequiredSheets: (stateSnapshot?: GameState, systemSettings?: any) => string[];
  buildStateSheetGuide: (requiredSheets: string[]) => any[];
  stateFillBatchSize: number;
  stateFillMaxConcurrentBatches: number;
};

export const createServiceInputBuilder = (ctx: ServiceInputBuilderContext) => {
  return (serviceKey: string, state: GameState, meta: ServiceInputMeta): string => {
    const base = {
      当前日期: state.当前日期,
      游戏时间: state.游戏时间,
      上轮时间: state.上轮时间 || state.游戏时间,
      流逝时长: state.流逝时长 || '',
      当前地点: state.当前地点,
      当前楼层: state.当前楼层,
      世界坐标: state.世界坐标,
      天气: state.天气,
      战斗模式: state.战斗模式 || '非战斗',
      系统通知: state.系统通知 || '',
      回合数: state.回合数
    };
    const normalizedPlayerInput = String(meta.playerInput || '').trim() || '[无玩家输入，请仅依据状态快照执行必要填表]';
    const normalizeNarrativeLogs = (logs: { sender: string; text: string }[]) => {
      return logs
        .map((item) => ({
          sender: String(item?.sender || '旁白').trim() || '旁白',
          text: String(item?.text || '').trim()
        }))
        .filter((item) => item.text.length > 0);
    };
    const compactCombatText = (value: unknown, max = 72) => {
      const text = String(value ?? '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return text.length > max ? `${text.slice(0, max)}...` : text;
    };
    const ECON_EXPENSE_KEYWORDS = ['支付', '付款', '付钱', '花费', '消费', '买单', '结账', '购入', '购买', '买了', '买下', '花了', '花掉'];
    const ECON_INCOME_KEYWORDS = ['获得', '得到', '收入', '赚到', '报酬', '奖励', '赏金', '卖出', '售出', '变卖', '收到'];
    const countKeywordHits = (text: string, keywords: string[]) => {
      const normalized = String(text || '').toLowerCase();
      if (!normalized) return 0;
      return keywords.reduce((sum, keyword) => {
        if (!keyword) return sum;
        return normalized.includes(keyword.toLowerCase()) ? sum + 1 : sum;
      }, 0);
    };
    const inferTradeDirection = (text: string): 'expense' | 'income' | 'unknown' => {
      const expenseHits = countKeywordHits(text, ECON_EXPENSE_KEYWORDS);
      const incomeHits = countKeywordHits(text, ECON_INCOME_KEYWORDS);
      if (expenseHits === 0 && incomeHits === 0) return 'unknown';
      if (expenseHits === incomeHits) return 'unknown';
      return expenseHits > incomeHits ? 'expense' : 'income';
    };
    const buildEconomySemanticAnchor = (
      playerInputText: string,
      narrativeRows: Array<{ sender: string; text: string }>
    ) => {
      const globalText = [playerInputText, ...narrativeRows.map((row) => String(row?.text || ''))]
        .filter(Boolean)
        .join('\n');
      const globalDirection = inferTradeDirection(globalText);
      const clues: Array<{
        source: 'player' | 'narrative';
        sender?: string;
        amount: number;
        currency: '法利';
        direction: 'expense' | 'income' | 'unknown';
        deltaHint?: number;
        excerpt: string;
      }> = [];

      const pushFromText = (source: 'player' | 'narrative', text: string, sender?: string) => {
        if (!text) return;
        const amountMatches = extractValisAmountMatches(text);
        for (const amountMatch of amountMatches) {
          const amount = Number(amountMatch.amount);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const start = Math.max(0, amountMatch.index - 24);
          const end = Math.min(text.length, amountMatch.index + amountMatch.raw.length + 24);
          const excerpt = text.slice(start, end).trim();
          const localDirection = inferTradeDirection(excerpt || text);
          const direction = localDirection === 'unknown' ? globalDirection : localDirection;
          clues.push({
            source,
            ...(sender ? { sender } : {}),
            amount,
            currency: '法利',
            direction,
            ...(direction === 'expense' ? { deltaHint: -amount } : {}),
            ...(direction === 'income' ? { deltaHint: amount } : {}),
            excerpt
          });
          if (clues.length >= 8) break;
        }
      };

      pushFromText('player', playerInputText);
      for (const row of narrativeRows) {
        pushFromText('narrative', String(row?.text || ''), String(row?.sender || '').trim() || undefined);
        if (clues.length >= 8) break;
      }

      if (clues.length === 0) return null;
      const currentValis = Number((state as any)?.角色?.法利);
      return {
        当前法利: Number.isFinite(currentValis) ? currentValis : null,
        交易线索: clues,
        约束: [
          '消费必须为负 delta，收入必须为正 delta',
          'delta 应与叙事中的明确金额一致',
          '不得让 角色.法利 变成负数'
        ]
      };
    };
    const collectTurnCombatEvents = (snapshot: GameState, targetTurn: number) => {
      const events = Array.isArray(snapshot?.战斗?.判定事件) ? snapshot.战斗!.判定事件! : [];
      return events
        .filter((event: any) => Number(event?.回合 || 0) === targetTurn)
        .slice(-8)
        .map((event: any, index: number) => ({
          序号: index + 1,
          行动者: compactCombatText(event?.行动者 || '未知单位', 24),
          目标: compactCombatText(event?.目标 || '无', 24),
          动作: compactCombatText(event?.动作 || '未命名动作', 36),
          结果: compactCombatText(event?.结果 || (typeof event?.是否成功 === 'boolean' ? (event.是否成功 ? '成功' : '失败') : ''), 60),
          伤害: Number.isFinite(Number(event?.伤害)) ? Number(event.伤害) : undefined,
          标签: Array.isArray(event?.标签) ? event.标签.slice(0, 4) : []
        }));
    };
    const buildCombatNarrativeSnippets = (events: Array<{
      行动者: string;
      目标: string;
      动作: string;
      结果: string;
      伤害?: number;
    }>) => events.map((event) => {
      const targetText = event.目标 && event.目标 !== '无' ? ` -> ${event.目标}` : '';
      const damageText = Number.isFinite(Number(event.伤害)) ? `，伤害${Number(event.伤害)}` : '';
      const resultText = event.结果 ? `，结果:${event.结果}` : '';
      return {
        sender: '战斗结算',
        text: `${event.行动者}${targetText} 执行 ${event.动作}${damageText}${resultText}`
      };
    });
    const buildStateGovernanceContract = (params: {
      currentTurn: number;
      requiredSheets: string[];
      stateSheetGuide: any[];
      hasEconomySemanticAnchor: boolean;
      economyAnchorAmbiguous: boolean;
    }) => {
      const governance = ctx.settings.stateVarWriter?.governance;
      const turnScope = governance?.turnScope || {};
      const domainScope = governance?.domainScope || {};
      const semanticScope = governance?.semanticScope || {};
      return {
        version: 'state-variable-governance-v1',
        turnScope: {
          ...turnScope,
          context: {
            currentTurn: params.currentTurn,
            warningMode: 'soft'
          }
        },
        domainScope: {
          ...domainScope,
          context: {
            requiredSheets: params.requiredSheets,
            sheetCount: params.stateSheetGuide.length
          }
        },
        semanticScope: {
          ...semanticScope,
          context: {
            economyAnchorStatus: params.hasEconomySemanticAnchor
              ? (params.economyAnchorAmbiguous ? 'ambiguous' : 'applied')
              : 'missing'
          }
        }
      };
    };

    let normalizedNarrative = normalizeNarrativeLogs(Array.isArray(meta.logs) ? meta.logs : []);
    if (normalizedNarrative.length === 0) {
      normalizedNarrative = (Array.isArray(state.日志) ? state.日志 : [])
        .slice(-8)
        .map((log) => ({
          sender: String(log?.sender || '旁白').trim() || '旁白',
          text: String(log?.text || '').trim()
        }))
        .filter((item) => item.text.length > 0)
        .slice(-3);
    }
    if (normalizedNarrative.length === 0) {
      normalizedNarrative = [{
        sender: '系统',
        text: `无叙事片段：${normalizedPlayerInput}`
      }];
    }

    const socialBrief = (state.社交 || []).map((c, index) => ({
      索引: index,
      ID: c.id,
      姓名: c.姓名,
      是否在场: c.是否在场,
      位置详情: c.位置详情,
      坐标: c.坐标,
      好感度: c.好感度,
      关系状态: c.关系状态,
      是否队友: c.是否队友,
      特别关注: c.特别关注,
      近期记忆: c.记忆 && c.记忆.length > 0 ? c.记忆.slice(-3).map((m) => m.内容) : []
    }));

    const payload: any = {
      ...base,
      玩家输入: normalizedPlayerInput,
      叙事: normalizedNarrative,
      已应用指令: meta.appliedCommands
    };

    if (state.遭遇 && state.遭遇.length > 0) payload.遭遇 = state.遭遇;
    if (state.战斗?.地图 && state.战斗.地图.length > 0) payload.战斗地图 = state.战斗.地图;
    if (state.战斗?.视觉) payload.战斗视觉 = state.战斗.视觉;
    if (state.骰池 && state.骰池.length > 0) payload.骰池 = state.骰池;
    if (state.可选行动列表 && state.可选行动列表.length > 0) payload.可选行动列表 = state.可选行动列表;

    if (serviceKey === 'memory') {
      const rawJobs = Array.isArray(meta.memoryJobs) ? meta.memoryJobs : [];
      const latestJobByTurn = new Map<number, MemoryFillJobInput>();
      for (const job of rawJobs) {
        const turn = Math.max(1, Math.floor(Number(job?.turnIndex || 0)));
        if (!Number.isFinite(turn)) continue;
        const previous = latestJobByTurn.get(turn);
        if (!previous || (Number(job.enqueuedAt || 0) >= Number(previous.enqueuedAt || 0))) {
          latestJobByTurn.set(turn, job);
        }
      }

      const orderedJobs = Array.from(latestJobByTurn.values()).sort((a, b) => a.turnIndex - b.turnIndex);
      const jobs = orderedJobs.length > 0
        ? orderedJobs
        : [{
          turnIndex: Math.max(1, Math.floor(meta.turnIndex ?? ((state.回合数 || 1) - 1))),
          playerInput: meta.playerInput,
          logs: Array.isArray(meta.logs) ? meta.logs : [],
          appliedCommands: Array.isArray(meta.appliedCommands) ? meta.appliedCommands : [],
          stateSnapshot: state,
          enqueuedAt: Date.now()
        }];

      const latestSnapshot = jobs[jobs.length - 1]?.stateSnapshot || state;
      payload.社交 = socialBrief;
      payload.目标回合 = jobs[jobs.length - 1]?.turnIndex || 1;
      payload.待填回合 = jobs.map((job) => {
        const targetTurn = Math.max(1, Math.floor(Number(job.turnIndex || 0)));
        const snapshot = job.stateSnapshot || latestSnapshot;
        const turnLogs = (Array.isArray(snapshot.日志) ? snapshot.日志 : [])
          .filter((log) => Number(log?.turnIndex || 0) === targetTurn)
          .map((log) => ({ sender: log.sender, text: log.text, gameTime: log.gameTime || '' }))
          .slice(-12);
        const existingSummary = (Array.isArray(snapshot.日志摘要) ? snapshot.日志摘要 : [])
          .filter((row: any) => Number(row?.回合 || 0) === targetTurn)
          .slice(-3);
        const existingOutline = (Array.isArray(snapshot.日志大纲) ? snapshot.日志大纲 : [])
          .filter((row: any) => Number(row?.开始回合 || 0) === targetTurn)
          .slice(-3);
        const turnNarrative = normalizeNarrativeLogs(Array.isArray(job.logs) ? job.logs : []);
        const turnLogsForNarrative = turnLogs
          .map((log) => ({ sender: String(log.sender || '旁白').trim() || '旁白', text: String(log.text || '').trim() }))
          .filter((item) => item.text.length > 0);
        const turnCombatEvents = collectTurnCombatEvents(snapshot, targetTurn);
        const combatNarrative = buildCombatNarrativeSnippets(turnCombatEvents);
        const baseNarrative = turnNarrative.length > 0
          ? turnNarrative
          : (turnLogsForNarrative.length > 0
            ? turnLogsForNarrative
            : [{ sender: '系统', text: `回合${targetTurn}无叙事片段：${String(job.playerInput || normalizedPlayerInput).trim() || normalizedPlayerInput}` }]);
        const finalTurnNarrative = [...baseNarrative, ...combatNarrative].slice(-12);
        return {
          目标回合: targetTurn,
          本回合玩家输入: String(job.playerInput || normalizedPlayerInput).trim() || normalizedPlayerInput,
          本回合叙事片段: finalTurnNarrative,
          本回合日志: turnLogs,
          本回合战斗事件: turnCombatEvents,
          已有摘要: existingSummary,
          已有大纲: existingOutline
        };
      });
      payload.日志摘要尾部 = Array.isArray(latestSnapshot.日志摘要) ? latestSnapshot.日志摘要.slice(-12) : [];
      payload.日志大纲尾部 = Array.isArray(latestSnapshot.日志大纲) ? latestSnapshot.日志大纲.slice(-12) : [];
      const parallelBySheet = ctx.isMemoryParallelBySheetEnabled() || jobs.length > 1;
      payload.填表任务 = {
        mode: 'async-batch',
        requiredSheets: ['LOG_Summary', 'LOG_Outline'],
        enforcePairing: true,
        batchSize: jobs.length,
        allowParallelGeneration: parallelBySheet,
        commitPolicy: 'serial',
        parallelBySheet
      };
    } else if (serviceKey === 'state') {
      const requiredSheets = ctx.resolveStateRequiredSheets(state, state.系统设置 || ctx.settings.系统设置);
      const stateSheetGuide = ctx.buildStateSheetGuide(requiredSheets);
      const econAnchor = buildEconomySemanticAnchor(normalizedPlayerInput, normalizedNarrative);
      const economyAnchorAmbiguous = Array.isArray((econAnchor as any)?.交易线索)
        ? (econAnchor as any).交易线索.some((item: any) => String(item?.direction || '').trim() === 'unknown')
        : false;
      const governanceContract = buildStateGovernanceContract({
        currentTurn: Math.max(1, Math.floor(Number(state.回合数 || 1))),
        requiredSheets,
        stateSheetGuide,
        hasEconomySemanticAnchor: !!econAnchor,
        economyAnchorAmbiguous
      });
      const statePayload = buildStateServiceInputPayload({
        state,
        socialBrief,
        requiredSheets,
        stateSheetGuide,
        maxConcurrentSheets: ctx.stateFillBatchSize,
        maxConcurrentBatches: ctx.stateFillMaxConcurrentBatches,
        governanceContract
      });
      Object.assign(payload, statePayload);
      if (econAnchor) {
        payload.经济语义锚点 = econAnchor;
      }
    } else {
      // map 或其他非 memory/state 请求统一使用精简公共上下文
      payload.社交 = socialBrief;
    }

    const payloadText = serviceKey === 'state'
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2);

    return payloadText;
  };
};
