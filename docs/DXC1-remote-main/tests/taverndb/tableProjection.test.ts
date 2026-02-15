import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { buildTavernTableSearchRows, clearTavernProjectionCache, projectGameStateToTavernTables } from '../../utils/taverndb/tableProjection';
import { retrieveTavernTableRows } from '../../utils/memory/tavernTableRetriever';

describe('table projection', () => {
  it('projects major modules into template sheets', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;

    state.日志摘要 = [
      {
        回合: 5,
        时间: '第1日 12:30',
        时间跨度: '第1日 12:00-12:30',
        地点: '欧拉丽公会大厅',
        纪要: '完成补给并确认远征目标。',
        重要对话: 'Tester: 出发前检查装备。',
        编码索引: 'AM0005'
      }
    ];

    state.日志大纲 = [
      {
        章节: '第一章',
        标题: '远征准备',
        开始回合: 5,
        时间跨度: '第1日中午',
        大纲: '补给确认后准备进入地下城。',
        事件列表: ['补给', '集合'],
        编码索引: 'AM0005'
      }
    ];

    state.可选行动列表 = [
      { 名称: '去公会窗口', 描述: '确认补给价格' },
      { 名称: '检修装备', 描述: '检查武器状态' },
      { 名称: '联系同伴', 描述: '召集队友集合' },
      { 名称: '直接出发', 描述: '前往地下城入口' }
    ];

    state.骰池 = [
      { id: 'dice-1', 类型: 'd20', 数值: 18 }
    ];

    state.势力 = [
      { id: 'FACTION_001', 名称: '赫斯缇雅眷族', 类型: '眷族', 声望: 35, 关系: '友好' }
    ];

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: true });

    expect(tables).toHaveLength(52);

    const summaryTable = tables.find((table) => table.id === 'LOG_Summary');
    const outlineTable = tables.find((table) => table.id === 'LOG_Outline');
    const optionTable = tables.find((table) => table.id === 'UI_ActionOptions');

    expect(summaryTable?.rows[0]['编码索引']).toBe('AM0005');
    expect(outlineTable?.rows[0]['编码索引']).toBe('AM0005');
    expect(optionTable?.rows[0]['选项A']).toContain('去公会窗口');
  });

  it('supports table-level retrieval by query tokens', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;

    state.日志摘要 = [
      {
        回合: 9,
        时间: '第2日 10:00',
        地点: '地下城第7层',
        纪要: '遭遇哥布林巡逻队并完成侦察撤离。',
        编码索引: 'AM0009'
      }
    ];

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const rows = buildTavernTableSearchRows(tables);
    const hits = retrieveTavernTableRows(rows, 'AM0009 哥布林 地下城', { topK: 3 });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].row.sheetId).toBe('LOG_Summary');
    expect(JSON.stringify(hits[0].row.row)).toContain('AM0009');
  });

  it('applies sheet weight boosts during retrieval ranking', () => {
    const rows = [
      {
        sheetId: 'LOG_Summary',
        sheetLabel: '总结表',
        rowIndex: 0,
        text: '公会 登记 进度',
        row: { 编码索引: 'AM0001' }
      },
      {
        sheetId: 'QUEST_ProgressLog',
        sheetLabel: '任务-进度日志',
        rowIndex: 0,
        text: '公会 登记 进度',
        row: { quest_id: 'Q001' }
      }
    ] as any;

    const hits = retrieveTavernTableRows(rows, '公会 登记', {
      topK: 2,
      sheetWeights: {
        QUEST_ProgressLog: 2.2,
        LOG_Summary: 1
      }
    });

    expect(hits).toHaveLength(2);
    expect(hits[0].row.sheetId).toBe('QUEST_ProgressLog');
  });

  it('projects map/npc/quest detail sheets for fine-grained retrieval', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.地图.surfaceLocations = [
      {
        id: 'loc_guild',
        name: '公会本部',
        type: 'GUILD',
        coordinates: { x: 4800, y: 5000 },
        radius: 32,
        description: '登记与委托中心'
      }
    ];
    state.社交 = [
      {
        id: 'Char_Eina',
        姓名: '埃伊娜',
        是否在场: true,
        所在位置: '公会本部',
        记忆: [{ 时间戳: '第1日 07:10', 内容: '完成冒险者登记指引。' }]
      }
    ];
    state.任务 = [
      {
        id: 'Q001',
        标题: '完成公会登记',
        描述: '前往公会窗口办理冒险者登记',
        状态: 'active',
        奖励: '资格解锁',
        评级: 'E',
        日志: [{ 时间戳: '第1日 07:12', 内容: '已领取申请表。' }]
      }
    ];

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    expect(tables.find((table) => table.id === 'MAP_SurfaceLocations')?.rows.length).toBe(1);
    expect(tables.find((table) => table.id === 'NPC_InteractionLog')?.rows.length).toBeGreaterThan(0);
    expect(tables.find((table) => table.id === 'QUEST_ProgressLog')?.rows.length).toBeGreaterThan(0);
  });

  it('exposes quality metrics rows in SYS_ValidationIssue', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 10;
    state.游戏时间 = '第2日 14:20';
    state.日志摘要 = [
      { 回合: 10, 时间: '第2日 14:20', 摘要: '仅摘要', 编码索引: 'AM0010' }
    ];
    state.日志大纲 = [];
    state.__tableMeta = {
      conflictStats: {
        total: 3,
        byReason: {
          sheet_version_conflict: 2,
          row_locked: 1
        }
      }
    };

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: true });
    const issueTable = tables.find((table) => table.id === 'SYS_ValidationIssue');
    expect(issueTable).toBeDefined();

    const messages = (issueTable?.rows || []).map((row) => String(row.message || ''));
    expect(messages.some((text) => text.includes('AM配对率'))).toBe(true);
    expect(messages.some((text) => text.includes('UNKNOWN_SLOTS='))).toBe(true);
    expect(messages.some((text) => text.includes('冲突率'))).toBe(true);
    expect(messages.some((text) => text.includes('BattleMap兼容'))).toBe(true);
    expect(messages.some((text) => text.includes('角色DND字段'))).toBe(true);
  });

  it('projects canonical forum board ids from board names', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.手机.公共帖子.帖子 = [
      {
        id: 'Forum_Compat_001',
        标题: '板块投影验证',
        内容: '只提供板块名称，board_id 也应可被投影出来',
        发布者: 'Tester',
        时间戳: '第2日 11:00',
        板块: '地下城攻略',
        点赞数: 0,
        回复: []
      }
    ];

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const forumTable = tables.find((table) => table.id === 'FORUM_Posts');
    expect(forumTable?.rows?.length).toBeGreaterThan(0);
    expect(forumTable?.rows?.[0]?.board_id).toBe('board_dungeon');
    expect(forumTable?.rows?.[0]?.board_name).toBe('地下城攻略');
  });

  it('invalidates projection cache when sheet version changes', () => {
    clearTavernProjectionCache();
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableRows = {
      LOG_Summary: [
        { 时间跨度: '第1日 07:00-07:10', 地点: '欧拉丽南大街', 纪要: '首次记录', 重要对话: '', 编码索引: 'AM0001' }
      ]
    };
    state.__tableMeta = {
      sheetVersions: {
        LOG_Summary: 1
      }
    };

    const first = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const firstSummary = first.find((table) => table.id === 'LOG_Summary');
    expect(firstSummary?.rows.length).toBe(1);

    state.__tableRows.LOG_Summary.push(
      { 时间跨度: '第1日 07:10-07:20', 地点: '欧拉丽南大街', 纪要: '第二条记录', 重要对话: '', 编码索引: 'AM0002' }
    );
    state.__tableMeta.sheetVersions.LOG_Summary = 2;

    const second = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const secondSummary = second.find((table) => table.id === 'LOG_Summary');
    expect(secondSummary?.rows.length).toBe(2);
  });

  it('projects legacy-compatible combat map rows with config/header semantics', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.战斗 = {
      地图: [
        {
          UNIT_ID: 'PC_MAIN',
          名称: 'Tester',
          类型: '玩家',
          位置: { x: 0, y: 0 },
          尺寸: { 宽度: 1, 高度: 1 },
          图标: 'token://tester'
        },
        {
          UNIT_ID: 'WOLF_001',
          名称: '丛林狼',
          类型: '障碍物',
          位置: { x: 4, y: 6 },
          尺寸: { 宽度: 2, 高度: 1 }
        }
      ],
      视觉: {
        地图尺寸: {
          宽度: 24,
          高度: 18
        }
      }
    };

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const mapTable = tables.find((table) => table.id === 'COMBAT_BattleMap');
    expect(mapTable).toBeDefined();
    expect(mapTable?.rows?.[0]?.类型).toBe('Config');
    expect(String(mapTable?.rows?.[0]?.坐标 || '')).toContain('"w":24');
    expect(String(mapTable?.rows?.[0]?.坐标 || '')).toContain('"h":18');
    expect(mapTable?.rows?.[1]?.类型).toBe('Token');
    expect(String(mapTable?.rows?.[1]?.坐标 || '')).toContain('"x":1');
    expect(String(mapTable?.rows?.[1]?.坐标 || '')).toContain('"y":1');
    expect(mapTable?.rows?.[2]?.类型).toBe('Wall');
  });

  it('keeps CHARACTER_* projection focused on PC_MAIN and filters player records from NPC/PHONE tables', () => {
    const state = createNewGameState('贝尔', '男', 'Human') as any;
    state.社交 = [
      { id: 'Char_Bell', 姓名: '贝尔', 是否在场: true, 是否队友: true, 记忆: [] },
      { id: 'Char_Lili', 姓名: '莉莉', 是否在场: true, 是否队友: true, 记忆: [] }
    ];
    state.手机.联系人 = {
      好友: ['{{user}}', '贝尔', '莉莉'],
      黑名单: ['player', '阿波罗眷族'],
      最近: ['{{user}}', '莉莉']
    };

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const npcTable = tables.find((table) => table.id === 'NPC_Registry');
    const contactTable = tables.find((table) => table.id === 'PHONE_Contacts');
    const charRegistry = tables.find((table) => table.id === 'CHARACTER_Registry');
    const charAttrs = tables.find((table) => table.id === 'CHARACTER_Attributes');

    expect(npcTable?.rows.map((row) => row.姓名)).toEqual(['莉莉']);
    expect(contactTable?.rows.map((row) => row.contact_id)).toEqual(['莉莉', '阿波罗眷族']);
    expect(charRegistry?.rows).toHaveLength(1);
    expect(charRegistry?.rows[0].CHAR_ID).toBe('PC_MAIN');
    expect(charAttrs?.rows).toHaveLength(1);
    expect(charAttrs?.rows[0].CHAR_ID).toBe('PC_MAIN');
  });

  it('projects SYS_GlobalState using runtime game time and turn (single snapshot semantics)', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.当前日期 = '1000-01-02';
    state.游戏时间 = '第2日 09:10';
    state.回合数 = 14;
    state.战斗 = undefined;

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const globalTable = tables.find((table) => table.id === 'SYS_GlobalState');
    expect(globalTable?.rows).toHaveLength(1);
    expect(globalTable?.rows[0].游戏时间).toBe('第2日 09:10');
    expect(globalTable?.rows[0].当前回合).toBe(14);
  });
});
