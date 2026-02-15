import { describe, expect, it } from 'vitest';
import {
  CORE_TAVERNDB_SHEET_IDS,
  TAVERNDB_TEMPLATE_SHEET_IDS,
  getDomainMappingRegistry,
  getCoreSheetRegistry,
  getSheetRegistry,
  isCoreSheetId,
  isSheetId
} from '../../utils/taverndb/sheetRegistry';

describe('sheet registry', () => {
  it('loads template sheets with full registry', () => {
    const registry = getSheetRegistry();

    expect(TAVERNDB_TEMPLATE_SHEET_IDS).toHaveLength(52);
    expect(registry).toHaveLength(52);

    for (const sheetId of TAVERNDB_TEMPLATE_SHEET_IDS) {
      expect(isSheetId(sheetId)).toBe(true);
      expect(registry.some((item) => item.id === sheetId)).toBe(true);
    }
  });

  it('keeps core subset for runtime baseline sheets', () => {
    const coreRegistry = getCoreSheetRegistry();

    expect(CORE_TAVERNDB_SHEET_IDS).toHaveLength(17);
    expect(coreRegistry).toHaveLength(17);

    for (const sheetId of CORE_TAVERNDB_SHEET_IDS) {
      expect(isCoreSheetId(sheetId)).toBe(true);
      expect(coreRegistry.some((item) => item.id === sheetId)).toBe(true);
    }
  });

  it('contains expected columns for log sheets', () => {
    const registry = getSheetRegistry();
    const summary = registry.find((item) => item.id === 'LOG_Summary');
    const outline = registry.find((item) => item.id === 'LOG_Outline');

    expect(summary?.columns.map((column) => column.key)).toEqual([
      '时间跨度',
      '地点',
      '纪要',
      '重要对话',
      '编码索引'
    ]);

    expect(outline?.columns.map((column) => column.key)).toEqual([
      '时间跨度',
      '大纲',
      '编码索引'
    ]);
  });

  it('exposes domain mapping registry as readable ssot', () => {
    const mappings = getDomainMappingRegistry();
    expect(mappings.length).toBeGreaterThanOrEqual(38);
    expect(mappings.some((mapping) => mapping.domain === 'economy_ledger' && mapping.sheetId === 'ECON_Ledger')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'mapping_registry' && mapping.sheetId === 'SYS_MappingRegistry')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'world_npc_tracking' && mapping.sheetId === 'WORLD_NpcTracking')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'world_news' && mapping.sheetId === 'WORLD_News')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'world_rumors' && mapping.sheetId === 'WORLD_Rumors')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'world_denatus' && mapping.sheetId === 'WORLD_Denatus')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'world_wargame' && mapping.sheetId === 'WORLD_WarGame')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'forum_boards' && mapping.sheetId === 'FORUM_Boards')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'forum_posts' && mapping.sheetId === 'FORUM_Posts')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'forum_replies' && mapping.sheetId === 'FORUM_Replies')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'phone_moments' && mapping.sheetId === 'PHONE_Moments')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'story_mainline' && mapping.sheetId === 'STORY_Mainline')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'story_triggers' && mapping.sheetId === 'STORY_Triggers')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'story_milestones' && mapping.sheetId === 'STORY_Milestones')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'contract_registry' && mapping.sheetId === 'CONTRACT_Registry')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'map_surface_locations' && mapping.sheetId === 'MAP_SurfaceLocations')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'map_dungeon_layers' && mapping.sheetId === 'MAP_DungeonLayers')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'map_macro_locations' && mapping.sheetId === 'MAP_MacroLocations')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'map_mid_locations' && mapping.sheetId === 'MAP_MidLocations')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'npc_relationship_events' && mapping.sheetId === 'NPC_RelationshipEvents')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'npc_location_trace' && mapping.sheetId === 'NPC_LocationTrace')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'npc_interaction_log' && mapping.sheetId === 'NPC_InteractionLog')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'quest_objectives' && mapping.sheetId === 'QUEST_Objectives')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'quest_progress_log' && mapping.sheetId === 'QUEST_ProgressLog')).toBe(true);
    expect(mappings.some((mapping) => mapping.domain === 'global_state' && mapping.primaryKey === '当前回合')).toBe(true);
  });
});
