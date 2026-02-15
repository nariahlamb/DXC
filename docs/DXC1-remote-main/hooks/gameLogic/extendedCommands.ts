import {
  handleSetEncounterRows as handleSetEncounterRowsImpl,
  handleUpsertBattleMapRows as handleUpsertBattleMapRowsImpl,
  handleSetMapVisuals as handleSetMapVisualsImpl,
  handleConsumeDiceRows as handleConsumeDiceRowsImpl,
  handleRefillDicePool as handleRefillDicePoolImpl,
  handleRollDiceCheck as handleRollDiceCheckImpl,
  handleSetActionEconomy as handleSetActionEconomyImpl,
  handleSpendActionResource as handleSpendActionResourceImpl,
  handleResolveAttackCheck as handleResolveAttackCheckImpl,
  handleResolveSavingThrow as handleResolveSavingThrowImpl,
  handleResolveDamageRoll as handleResolveDamageRollImpl,
  handleAppendCombatResolution as handleAppendCombatResolutionImpl,
  handleSetInitiative as handleSetInitiativeImpl,
} from './commands/combatHandlers';
import {
  handleAppendLogSummary as handleAppendLogSummaryImpl,
  handleAppendLogOutline as handleAppendLogOutlineImpl,
  handleSetActionOptions as handleSetActionOptionsImpl,
  handleUpsertNPC as handleUpsertNPCImpl,
  handleUpsertInventory as handleUpsertInventoryImpl,
} from './commands/socialHandlers';
import {
  handleAppendEconomicLedger as handleAppendEconomicLedgerImpl,
  handleApplyEconomicDelta as handleApplyEconomicDeltaImpl,
  handleUpsertSheetRows as handleUpsertSheetRowsImpl,
  handleDeleteSheetRows as handleDeleteSheetRowsImpl,
} from './commands/storageHandlers';

export function handleSetEncounterRows(...args: Parameters<typeof handleSetEncounterRowsImpl>): ReturnType<typeof handleSetEncounterRowsImpl> {
  return handleSetEncounterRowsImpl(...args);
}

export function handleUpsertBattleMapRows(...args: Parameters<typeof handleUpsertBattleMapRowsImpl>): ReturnType<typeof handleUpsertBattleMapRowsImpl> {
  return handleUpsertBattleMapRowsImpl(...args);
}

export function handleSetMapVisuals(...args: Parameters<typeof handleSetMapVisualsImpl>): ReturnType<typeof handleSetMapVisualsImpl> {
  return handleSetMapVisualsImpl(...args);
}

export function handleConsumeDiceRows(...args: Parameters<typeof handleConsumeDiceRowsImpl>): ReturnType<typeof handleConsumeDiceRowsImpl> {
  return handleConsumeDiceRowsImpl(...args);
}

export function handleRefillDicePool(...args: Parameters<typeof handleRefillDicePoolImpl>): ReturnType<typeof handleRefillDicePoolImpl> {
  return handleRefillDicePoolImpl(...args);
}

export function handleRollDiceCheck(...args: Parameters<typeof handleRollDiceCheckImpl>): ReturnType<typeof handleRollDiceCheckImpl> {
  return handleRollDiceCheckImpl(...args);
}

export function handleSetActionEconomy(...args: Parameters<typeof handleSetActionEconomyImpl>): ReturnType<typeof handleSetActionEconomyImpl> {
  return handleSetActionEconomyImpl(...args);
}

export function handleSpendActionResource(...args: Parameters<typeof handleSpendActionResourceImpl>): ReturnType<typeof handleSpendActionResourceImpl> {
  return handleSpendActionResourceImpl(...args);
}

export function handleResolveAttackCheck(...args: Parameters<typeof handleResolveAttackCheckImpl>): ReturnType<typeof handleResolveAttackCheckImpl> {
  return handleResolveAttackCheckImpl(...args);
}

export function handleResolveSavingThrow(...args: Parameters<typeof handleResolveSavingThrowImpl>): ReturnType<typeof handleResolveSavingThrowImpl> {
  return handleResolveSavingThrowImpl(...args);
}

export function handleResolveDamageRoll(...args: Parameters<typeof handleResolveDamageRollImpl>): ReturnType<typeof handleResolveDamageRollImpl> {
  return handleResolveDamageRollImpl(...args);
}

export function handleAppendCombatResolution(...args: Parameters<typeof handleAppendCombatResolutionImpl>): ReturnType<typeof handleAppendCombatResolutionImpl> {
  return handleAppendCombatResolutionImpl(...args);
}

export function handleAppendLogSummary(...args: Parameters<typeof handleAppendLogSummaryImpl>): ReturnType<typeof handleAppendLogSummaryImpl> {
  return handleAppendLogSummaryImpl(...args);
}

export function handleAppendLogOutline(...args: Parameters<typeof handleAppendLogOutlineImpl>): ReturnType<typeof handleAppendLogOutlineImpl> {
  return handleAppendLogOutlineImpl(...args);
}

export function handleSetActionOptions(...args: Parameters<typeof handleSetActionOptionsImpl>): ReturnType<typeof handleSetActionOptionsImpl> {
  return handleSetActionOptionsImpl(...args);
}

export function handleUpsertNPC(...args: Parameters<typeof handleUpsertNPCImpl>): ReturnType<typeof handleUpsertNPCImpl> {
  return handleUpsertNPCImpl(...args);
}

export function handleUpsertInventory(...args: Parameters<typeof handleUpsertInventoryImpl>): ReturnType<typeof handleUpsertInventoryImpl> {
  return handleUpsertInventoryImpl(...args);
}

export function handleAppendEconomicLedger(...args: Parameters<typeof handleAppendEconomicLedgerImpl>): ReturnType<typeof handleAppendEconomicLedgerImpl> {
  return handleAppendEconomicLedgerImpl(...args);
}

export function handleApplyEconomicDelta(...args: Parameters<typeof handleApplyEconomicDeltaImpl>): ReturnType<typeof handleApplyEconomicDeltaImpl> {
  return handleApplyEconomicDeltaImpl(...args);
}

export function handleUpsertSheetRows(...args: Parameters<typeof handleUpsertSheetRowsImpl>): ReturnType<typeof handleUpsertSheetRowsImpl> {
  return handleUpsertSheetRowsImpl(...args);
}

export function handleDeleteSheetRows(...args: Parameters<typeof handleDeleteSheetRowsImpl>): ReturnType<typeof handleDeleteSheetRowsImpl> {
  return handleDeleteSheetRowsImpl(...args);
}

export function handleSetInitiative(...args: Parameters<typeof handleSetInitiativeImpl>): ReturnType<typeof handleSetInitiativeImpl> {
  return handleSetInitiativeImpl(...args);
}
