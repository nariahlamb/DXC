import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { filterCommandsForService, filterCommandsForServiceWithDiagnostics } from '../../hooks/gameLogic/microservice/commandGuard';
import { migrateSettings } from '../../hooks/useAppSettings';

const createGuardContext = (serviceKey: string, commands: TavernCommand[]) => ({
  serviceKey,
  commands,
  stateWorldCadenceDue: true,
  stateForumCadenceDue: true,
  legacyPathActions: new Set<string>(['set', 'add', 'push', 'delete']),
  resolveSheetIdFromCommand: (cmd: TavernCommand) => String((cmd as any)?.value?.sheetId || ''),
  worldIntervalControlledSheets: new Set<string>(),
  forumIntervalControlledSheets: new Set<string>()
});

describe('state variable migration guard', () => {
  it('keeps memory commands out of state route', () => {
    const commands: TavernCommand[] = [
      { action: 'append_log_summary', value: { 回合: 1, 摘要: '摘要' } },
      { action: 'upsert_sheet_rows', value: { sheetId: 'LOG_Outline', rows: [{ 编码索引: 'AM0001' }] } },
      { action: 'upsert_sheet_rows', value: { sheetId: 'SYS_GlobalState', rows: [{ id: 'GLOBAL' }] } }
    ];

    const stateFiltered = filterCommandsForService(createGuardContext('state', commands));
    const memoryFiltered = filterCommandsForService(createGuardContext('memory', commands));

    expect(stateFiltered).toHaveLength(1);
    expect((stateFiltered[0] as any)?.value?.sheetId).toBe('SYS_GlobalState');
    expect(memoryFiltered).toHaveLength(2);
    expect(memoryFiltered.every((cmd) => {
      if (cmd.action === 'append_log_summary' || cmd.action === 'append_log_outline') return true;
      return String((cmd as any)?.value?.sheetId || '').startsWith('LOG_');
    })).toBe(true);
  });

  it('defaults writer switches to disabled for legacy settings', () => {
    const migrated = migrateSettings({ fontSize: 'medium' } as any);

    expect(migrated.stateVarWriter.enabled).toBe(false);
    expect(migrated.stateVarWriter.shadowMode).toBe(false);
    expect(migrated.stateVarWriter.cutoverDomains).toEqual([]);
    expect(migrated.stateVarWriter.rejectNonWriterForCutoverDomains).toBe(false);
    expect(migrated.stateVarWriter.governance.turnScope.crossTurnSoftWarning.nonBlocking).toBe(true);
    expect(migrated.stateVarWriter.governance.turnScope.crossTurnSoftWarning.threshold).toBe(1);
    expect(migrated.stateVarWriter.governance.domainScope.strictAllowlist).toBe(true);
    expect(Object.keys(migrated.stateVarWriter.governance.domainScope.allowlist).length).toBeGreaterThan(0);
    expect(migrated.stateVarWriter.governance.semanticScope.anchors).toContain('economy');
  });

  it('shadow mode does not change current filtering behavior', () => {
    const commands: TavernCommand[] = [
      { action: 'append_log_outline', value: { 回合: 2, 大纲: 'outline' } },
      { action: 'upsert_sheet_rows', value: { sheetId: 'CHARACTER_Resources', rows: [{ id: 'PLAYER' }] } }
    ];

    const baseline = filterCommandsForService(createGuardContext('state', commands));
    const shadowSettings = migrateSettings({
      stateVarWriter: {
        enabled: true,
        shadowMode: true,
        cutoverDomains: ['SYS_GlobalState'],
        rejectNonWriterForCutoverDomains: false
      }
    });
    const withShadowMode = filterCommandsForService(createGuardContext('state', commands));

    expect(shadowSettings.stateVarWriter.shadowMode).toBe(true);
    expect(withShadowMode).toEqual(baseline);
  });

  it('falls back to default allowlist on invalid governance config', () => {
    const migrated = migrateSettings({
      stateVarWriter: {
        governance: {
          domainScope: {
            strictAllowlist: true,
            invalidConfigFallbackStrategy: 'use_default_allowlist',
            allowlist: {
              invalid_domain: {
                SYS_GlobalState: ['当前场景']
              }
            }
          }
        }
      }
    } as any);

    expect(migrated.stateVarWriter.governance.domainScope.strictAllowlist).toBe(true);
    expect(Object.keys(migrated.stateVarWriter.governance.domainScope.allowlist).length).toBeGreaterThan(1);
    expect(migrated.stateVarWriter.governance.domainScope.allowlist.invalid_domain).toBeUndefined();
  });

  it('applies strict allowlist for sheet and field filtering with diagnostics', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'NPC_Registry',
          rows: [{ NPC_ID: 'Char_Ais', 姓名: '艾丝', 当前状态: '在场', 越界字段: 'x' }]
        }
      } as any,
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'QUEST_Active',
          rows: [{ 任务ID: 'Q1', 任务名称: '测试任务' }]
        }
      } as any
    ];

    const result = filterCommandsForServiceWithDiagnostics({
      ...createGuardContext('state', commands),
      strictAllowlist: true,
      allowlist: {
        npc_registry: {
          NPC_Registry: ['NPC_ID', '姓名', '当前状态', '是否在场']
        }
      } as any
    });

    expect(result.commands).toHaveLength(1);
    const npcRows = (result.commands[0] as any)?.value?.rows || [];
    expect(npcRows).toHaveLength(1);
    expect(npcRows[0].NPC_ID).toBe('Char_Ais');
    expect(npcRows[0].越界字段).toBeUndefined();
    expect(result.rejected.some((item) => item.reason === 'field_not_allowed' && item.field === '越界字段')).toBe(true);
    expect(result.rejected.some((item) => item.reason === 'sheet_not_allowed' && item.sheetId === 'QUEST_Active')).toBe(true);

    const filteredOnly = filterCommandsForService({
      ...createGuardContext('state', commands),
      strictAllowlist: true,
      allowlist: {
        npc_registry: {
          NPC_Registry: ['NPC_ID', '姓名', '当前状态', '是否在场']
        }
      } as any
    });
    expect(filteredOnly).toHaveLength(1);
  });

  it('keeps allowed sheet operations and rejects disallowed fields under strict allowlist', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'CHARACTER_Resources',
          rows: [{ CHAR_ID: 'PLAYER', 法利: 120, MP: 10 }]
        }
      } as any,
      {
        action: 'delete_sheet_rows',
        value: {
          sheetId: 'CHARACTER_Resources',
          rowIds: ['PLAYER']
        }
      } as any
    ];
    const result = filterCommandsForServiceWithDiagnostics({
      ...createGuardContext('state', commands),
      strictAllowlist: true,
      allowlist: {
        character_resources: {
          CHARACTER_Resources: ['CHAR_ID', '法利']
        }
      } as any
    });
    expect(result.commands).toHaveLength(2);
    const upsertRows = (result.commands[0] as any)?.value?.rows || [];
    expect(upsertRows[0]?.CHAR_ID).toBe('PLAYER');
    expect(upsertRows[0]?.法利).toBe(120);
    expect(upsertRows[0]?.MP).toBeUndefined();
    expect(result.rejected.some((item) => item.reason === 'field_not_allowed' && item.field === 'MP')).toBe(true);
  });
});
