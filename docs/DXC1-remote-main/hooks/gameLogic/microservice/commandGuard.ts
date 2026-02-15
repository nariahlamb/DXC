import type { TavernCommand } from '../../../types';

export type CommandGuardContext = {
  serviceKey: string;
  commands: TavernCommand[];
  stateWorldCadenceDue: boolean;
  stateForumCadenceDue: boolean;
  legacyPathActions: Set<string>;
  resolveSheetIdFromCommand: (cmd: TavernCommand) => string;
  worldIntervalControlledSheets: Set<string>;
  forumIntervalControlledSheets: Set<string>;
};

export const filterCommandsForService = (context: CommandGuardContext): TavernCommand[] => {
  const {
    serviceKey,
    commands,
    stateWorldCadenceDue,
    stateForumCadenceDue,
    legacyPathActions,
    resolveSheetIdFromCommand,
    worldIntervalControlledSheets,
    forumIntervalControlledSheets
  } = context;

  const safeCommands = Array.isArray(commands) ? commands : [];
  const normalizedServiceKey = serviceKey === 'memory' || serviceKey === 'map' ? serviceKey : 'state';
  return safeCommands.filter((cmd: any) => {
    const k = String(cmd?.key ?? cmd?.path ?? '').trim();
    const action = String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? cmd?.cmd ?? '').trim().toLowerCase();
    const sheetId = (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows')
      ? resolveSheetIdFromCommand(cmd as TavernCommand)
      : '';

    if (normalizedServiceKey === 'memory') {
      if (action === 'append_log_summary' || action === 'append_log_outline') return true;
      if (action === 'upsert_sheet_rows') {
        return sheetId === 'LOG_Summary' || sheetId === 'LOG_Outline';
      }
      return false;
    }

    if (normalizedServiceKey === 'state') {
      if (action === 'append_log_summary' || action === 'append_log_outline') return false;
      if (legacyPathActions.has(action)) {
        if (!stateWorldCadenceDue && /^gameState\.世界(\.|$)/.test(k)) return false;
        if (!stateForumCadenceDue && /^gameState\.手机\.公共帖子(\.|$)/.test(k)) return false;
      }
      if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
        if (sheetId === 'LOG_Summary' || sheetId === 'LOG_Outline') return false;
        if (!stateWorldCadenceDue && worldIntervalControlledSheets.has(sheetId)) return false;
        if (!stateForumCadenceDue && forumIntervalControlledSheets.has(sheetId)) return false;
      }
      return true;
    }

    if (normalizedServiceKey === 'map') {
      return action === 'upsert_exploration_map'
        || action === 'set_map_visuals'
        || action === 'upsert_battle_map_rows';
    }

    return false;
  });
};
