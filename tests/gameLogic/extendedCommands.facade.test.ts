import { describe, expect, it } from 'vitest';
import * as facade from '../../hooks/gameLogic/extendedCommands';
import * as combat from '../../hooks/gameLogic/commands/combatHandlers';
import * as social from '../../hooks/gameLogic/commands/socialHandlers';
import * as storage from '../../hooks/gameLogic/commands/storageHandlers';

describe('extendedCommands facade exports', () => {
  it('re-exports combat handlers', () => {
    expect(typeof facade.handleSetEncounterRows).toBe('function');
    expect(typeof facade.handleResolveAttackCheck).toBe('function');
    expect(typeof facade.handleSetInitiative).toBe('function');
    expect(typeof combat.handleSetEncounterRows).toBe('function');
  });

  it('re-exports social handlers', () => {
    expect(typeof facade.handleAppendLogSummary).toBe('function');
    expect(typeof facade.handleSetActionOptions).toBe('function');
    expect(typeof facade.handleUpsertNPC).toBe('function');
    expect(typeof social.handleAppendLogSummary).toBe('function');
  });

  it('re-exports storage handlers', () => {
    expect(typeof facade.handleUpsertSheetRows).toBe('function');
    expect(typeof facade.handleDeleteSheetRows).toBe('function');
    expect(typeof facade.handleApplyEconomicDelta).toBe('function');
    expect(typeof storage.handleUpsertSheetRows).toBe('function');
  });
});
