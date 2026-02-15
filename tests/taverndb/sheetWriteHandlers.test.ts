import { describe, expect, it } from 'vitest';
import { handleAppendLogSummary, handleDeleteSheetRows, handleUpsertInventory, handleUpsertNPC, handleUpsertSheetRows } from '../../hooks/gameLogic/extendedCommands';
import { createNewGameState } from '../../utils/dataMapper';
import { getQualityLabel } from '../../utils/itemUtils';

describe('table-first sheet write handlers', () => {
  it('upserts quest rows into domain state and table shadow store', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'QUEST_Active',
      rows: [
        {
          任务ID: 'QUEST_TEST_001',
          任务名称: '调查地下城入口',
          状态: '进行中',
          目标描述: '确认入口守卫情况',
          奖励: '100法利'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.任务.some((task: any) => task.id === 'QUEST_TEST_001')).toBe(true);
    expect(Array.isArray(state.__tableRows?.QUEST_Active)).toBe(true);
    expect(state.__tableRows.QUEST_Active[0].任务ID).toBe('QUEST_TEST_001');
  });

  it('upserts SYS_GlobalState rows into runtime state', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'SYS_GlobalState',
      rows: [
        {
          当前场景: '公会大厅',
          场景描述: '白天人流密集',
          游戏时间: '第2日 09:00',
          天气状况: '阴天',
          当前回合: 8
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.当前地点).toBe('公会大厅');
    expect(state.场景描述).toBe('白天人流密集');
    expect(state.游戏时间).toBe('第2日 09:00');
    expect(state.天气).toBe('阴天');
    expect(state.回合数).toBe(8);
  });

  it('accepts single-element array payload for upsert_sheet_rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, [
      {
        sheetId: 'SYS_GlobalState',
        rows: [
          {
            当前场景: '西大街',
            游戏时间: '第2日 10:00'
          }
        ]
      }
    ] as any);

    expect(result.success).toBe(true);
    expect(state.当前地点).toBe('西大街');
    expect(state.游戏时间).toBe('第2日 10:00');
  });

  it('accepts array payload when rows are wrapped under value field', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, [
      {
        sheet_id: 'SYS_GlobalState',
        value: [
          {
            当前场景: '巴别塔前',
            游戏时间: '第2日 10:10'
          }
        ]
      }
    ] as any);

    expect(result.success).toBe(true);
    expect(state.当前地点).toBe('巴别塔前');
    expect(state.游戏时间).toBe('第2日 10:10');
  });

  it('accepts append_log_summary wrapped payload rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 2;
    state.当前日期 = '1000-01-02';
    state.游戏时间 = '第2日 10:20';
    const result = handleAppendLogSummary(state, {
      payload: {
        rows: [
          {
            回合: 2,
            时间: '第2日 10:20',
            摘要: '在公告板前记录了新的任务线索。',
            编码索引: 'AM0002'
          }
        ]
      }
    } as any);

    expect(result.success).toBe(true);
    expect(state.日志摘要).toHaveLength(1);
    expect(state.日志摘要[0].摘要).toContain('任务线索');
    expect(state.日志摘要[0].编码索引).toBe('AM0002');
  });

  it('normalizes player/user/{{user}} dialogue labels to current player name', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    state.回合数 = 1;
    state.当前日期 = '1000-01-01';
    state.游戏时间 = '第1日 07:20';
    const result = handleAppendLogSummary(state, {
      回合: 1,
      时间: '第1日 07:20',
      摘要: '{{user}}在公会大厅整理装备。',
      重要对话: 'player: 出发吧。\nuser：继续前进。\nyou: 收到。'
    } as any);

    expect(result.success).toBe(true);
    expect(state.日志摘要).toHaveLength(1);
    const row = state.日志摘要[0] as any;
    expect(String(row.摘要 || '')).toContain('博丽灵梦');
    expect(String(row.重要对话 || '')).toContain('博丽灵梦: 出发吧。');
    expect(String(row.重要对话 || '')).toContain('博丽灵梦：继续前进。');
    expect(String(row.重要对话 || '')).toContain('博丽灵梦: 收到。');
    expect(String(row.重要对话 || '')).not.toContain('player:');
    expect(String(row.重要对话 || '')).not.toContain('user：');
    expect(String(row.重要对话 || '')).not.toContain('you:');
  });

  it('ignores phone marker rows when upserting LOG_Summary/LOG_Outline', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 1;
    state.当前日期 = '1000-01-01';
    state.游戏时间 = '第1日 07:25';
    const summary = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Summary',
      rows: [
        {
          回合: 1,
          时间: '第1日 07:25',
          摘要: '【手机】与埃伊娜聊天：今天公会见。',
          编码索引: 'AM0001'
        }
      ]
    } as any);
    const outline = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Outline',
      rows: [
        {
          章节: '第一章',
          标题: '手机聊天',
          开始回合: 1,
          大纲: '【手机】与埃伊娜聊天：今天公会见。',
          事件列表: ['【手机】与埃伊娜聊天：今天公会见。'],
          编码索引: 'AM0001'
        }
      ]
    } as any);

    expect(summary.success).toBe(true);
    expect(outline.success).toBe(true);
    expect(state.日志摘要 || []).toHaveLength(0);
    expect(state.日志大纲 || []).toHaveLength(0);
  });

  it('merges SYS_GlobalState rows by 当前回合 key to avoid sparse duplicates', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 12;

    const first = handleUpsertSheetRows(state, {
      sheetId: 'SYS_GlobalState',
      rows: [
        {
          当前回合: 12,
          游戏时间: '第1日 08:00'
        }
      ]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'SYS_GlobalState',
      rows: [
        {
          当前回合: 12,
          当前场景: '公会本部'
        }
      ]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(Array.isArray(state.__tableRows?.SYS_GlobalState)).toBe(true);
    expect(state.__tableRows.SYS_GlobalState).toHaveLength(1);
    expect(state.__tableRows.SYS_GlobalState[0].当前回合).toBe(12);
    expect(state.__tableRows.SYS_GlobalState[0].当前场景).toBe('公会本部');
    expect(state.__tableRows.SYS_GlobalState[0].游戏时间).toBe('第1日 08:00');
  });

  it('normalizes LOG_Summary/LOG_Outline time fields to YYYY-MM-DD HH:MM formats', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.当前日期 = '1000-01-01';
    state.游戏时间 = '第1日 07:40';
    state.上轮时间 = '第1日 07:10';
    state.回合数 = 3;

    const summary = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Summary',
      rows: [
        {
          回合: 3,
          时间: '第1日 07:40',
          摘要: '抵达公会大厅并完成登记准备。',
          编码索引: 'AM0003'
        }
      ]
    });
    const outline = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Outline',
      rows: [
        {
          章节: 1,
          标题: '公会登记',
          开始回合: 3,
          事件列表: ['抵达公会大厅', '准备登记'],
          编码索引: 'AM0003'
        } as any
      ]
    });

    expect(summary.success).toBe(true);
    expect(outline.success).toBe(true);
    expect(state.日志摘要[0].时间).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(String(state.日志摘要[0].时间跨度 || '')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}—\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(state.日志摘要[0].纪要).toContain('抵达公会大厅');
    expect(state.日志大纲[0].章节).toBe('1');
    expect(String(state.日志大纲[0].时间跨度 || '')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}—\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('accepts upsert_inventory single-object payload with english aliases', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertInventory(state, {
      value: {
        item_name: '冒险者短剑',
        qty: 2,
        type: 'weapon',
        description: '便携短剑'
      }
    } as any);

    expect(result.success).toBe(true);
    expect((state.背包 || []).some((item: any) => item.名称 === '冒险者短剑' && Number(item.数量 || 0) === 2)).toBe(true);
  });

  it('skips invalid inventory rows without failing the whole command', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertInventory(state, [
      { foo: 'bar' },
      { name: '治疗药水', count: 3, quality: 'common' }
    ] as any);

    expect(result.success).toBe(true);
    expect((state.背包 || []).some((item: any) => item.名称 === '治疗药水' && Number(item.数量 || 0) === 3)).toBe(true);
  });

  it('maps ITEM_Inventory 稀有度 to 背包 品质 for UI quality label consistency', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rows: [
        {
          物品ID: 'ITEM_TEST_QUALITY_001',
          物品名称: '神社御守',
          类别: '饰品',
          数量: 1,
          稀有度: '史诗'
        }
      ]
    });

    expect(result.success).toBe(true);
    const item = (state.背包 || []).find((row: any) => row.id === 'ITEM_TEST_QUALITY_001');
    expect(item).toBeTruthy();
    expect(item?.稀有度).toBe('史诗');
    expect(item?.品质).toBe('史诗');
    expect(getQualityLabel(item?.品质)).toBe('史诗');
  });

  it('normalizes quality aliases and keeps quality on partial inventory updates', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const first = handleUpsertSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rows: [
        {
          物品ID: 'ITEM_TEST_QUALITY_ALIAS_001',
          物品名称: '灵符束',
          类别: '消耗品',
          数量: 1,
          品质: 'SSR'
        }
      ]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rows: [
        {
          物品ID: 'ITEM_TEST_QUALITY_ALIAS_001',
          物品名称: '灵符束',
          数量: 2
        }
      ]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const items = (state.背包 || []).filter((row: any) => row.id === 'ITEM_TEST_QUALITY_ALIAS_001');
    expect(items).toHaveLength(1);
    expect(items[0]?.数量).toBe(2);
    expect(items[0]?.品质).toBe('传说');
    expect(items[0]?.稀有度).toBe('传说');
    expect(getQualityLabel(items[0]?.品质)).toBe('传说');
  });

  it('defaults new inventory item quality to 普通 when omitted', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rows: [
        {
          物品ID: 'ITEM_TEST_QUALITY_DEFAULT_001',
          物品名称: '普通护符',
          类别: '饰品',
          数量: 1
        }
      ]
    });

    expect(result.success).toBe(true);
    const item = (state.背包 || []).find((row: any) => row.id === 'ITEM_TEST_QUALITY_DEFAULT_001');
    expect(item).toBeTruthy();
    expect(item?.品质).toBe('普通');
    expect(item?.稀有度).toBe('普通');
  });

  it('deduplicates NPC rows by name and keeps canonical Char_* id', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [
      {
        id: 'Char_Eina',
        姓名: '埃伊娜·祖尔',
        种族: '半精灵',
        好感度: 10,
        关系状态: '认识',
        记忆: []
      }
    ];

    const result = handleUpsertNPC(state, [
      {
        id: '埃伊娜·祖尔',
        姓名: '埃伊娜·祖尔',
        职业身份: '公会职员',
        当前状态: '在场'
      }
    ]);

    expect(result.success).toBe(true);
    expect(state.社交).toHaveLength(1);
    expect(state.社交[0].id).toBe('Char_Eina');
    expect(state.社交[0].职业身份).toBe('公会职员');
  });

  it('normalizes status aliases in upsert_npc payload', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertNPC(state, [
      {
        id: 'Char_Ais',
        姓名: '艾丝',
        status: 'online'
      },
      {
        id: 'Char_Lili',
        姓名: '莉莉',
        当前状态: 'inactive'
      },
      {
        id: 'Char_Welf',
        姓名: '韦尔夫',
        当前状态: '???',
        是否在场: false
      }
    ]);

    expect(result.success).toBe(true);
    const ais = state.社交.find((row: any) => row.id === 'Char_Ais');
    const lili = state.社交.find((row: any) => row.id === 'Char_Lili');
    const welf = state.社交.find((row: any) => row.id === 'Char_Welf');
    expect(ais?.当前状态).toBe('在场');
    expect(ais?.是否在场).toBe(true);
    expect(lili?.当前状态).toBe('离场');
    expect(lili?.是否在场).toBe(false);
    expect(welf?.当前状态).toBe('离场');
    expect(welf?.是否在场).toBe(false);
  });

  it('filters player references in upsert_npc payload', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const result = handleUpsertNPC(state, [
      { id: 'PLAYER_REIMU', 姓名: '博丽灵梦', 当前状态: '在场' },
      { id: '{{user}}', 姓名: '{{user}}', 当前状态: '在场' },
      { id: 'Char_Mikoto', 姓名: '御坂美琴', 当前状态: '在场' }
    ]);

    expect(result.success).toBe(true);
    expect(state.社交).toHaveLength(1);
    expect(state.社交[0].姓名).toBe('御坂美琴');
    expect(state.社交[0].id).toBe('Char_Mikoto');
  });

  it('maps NPC location detail and coordinate from NPC_Registry sheet rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        {
          id: 'Char_Hestia',
          姓名: '赫斯缇雅',
          是否在场: true,
          位置详情: '欧拉丽南大街',
          坐标: { x: 120, y: 45 }
        }
      ]
    });

    expect(result.success).toBe(true);
    const npc = (state.社交 || []).find((row: any) => row.id === 'Char_Hestia');
    expect(npc?.位置详情).toBe('欧拉丽南大街');
    expect(npc?.所在位置).toBe('欧拉丽南大街');
    expect(npc?.坐标).toEqual({ x: 120, y: 45 });
  });

  it('defaults NPC to 在场 when NPC_Registry row omits presence fields', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        {
          id: 'Char_Haruhime',
          姓名: '春姬',
          所在位置: '欧拉丽南大街'
        }
      ]
    });

    expect(result.success).toBe(true);
    const npc = (state.社交 || []).find((row: any) => row.id === 'Char_Haruhime');
    expect(npc).toBeTruthy();
    expect(npc?.是否在场).toBe(true);
    expect(npc?.当前状态).toBe('在场');
  });

  it('does not clear existing NPC presence when NPC_Registry row omits presence fields', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [
      {
        id: 'Char_Eina',
        姓名: '埃伊娜',
        是否在场: true,
        当前状态: '在场',
        关系状态: '认识',
        好感度: 12,
        记忆: []
      }
    ];

    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        {
          id: 'Char_Eina',
          姓名: '埃伊娜',
          所在位置: '公会本部'
        }
      ]
    });

    expect(result.success).toBe(true);
    const npc = (state.社交 || []).find((row: any) => row.id === 'Char_Eina');
    expect(npc?.所在位置).toBe('公会本部');
    expect(npc?.是否在场).toBe(true);
    expect(npc?.当前状态).toBe('在场');
  });

  it('normalizes status aliases from NPC_Registry sheet rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        {
          id: 'Char_Ryuu',
          姓名: '琉',
          状态: 'offline'
        },
        {
          id: 'Char_Ottar',
          姓名: '奥塔',
          status: 'dead'
        }
      ]
    });

    expect(result.success).toBe(true);
    const ryuu = state.社交.find((row: any) => row.id === 'Char_Ryuu');
    const ottar = state.社交.find((row: any) => row.id === 'Char_Ottar');
    expect(ryuu?.当前状态).toBe('离场');
    expect(ryuu?.是否在场).toBe(false);
    expect(ottar?.当前状态).toBe('死亡');
    expect(ottar?.是否在场).toBe(false);
  });

  it('does not let NPC_Registry overwrite existing affinity with registry noise fields', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [
      {
        id: 'Char_Ais',
        姓名: '艾丝',
        好感度: 42,
        关系状态: '信赖',
        记忆: []
      }
    ];

    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        {
          id: 'Char_Ais',
          姓名: '艾丝',
          当前状态: '在场',
          所在位置: '公会大厅',
          好感度: 0,
          affinity: 0,
          affinity_score: 0
        }
      ]
    });

    expect(result.success).toBe(true);
    const ais = state.社交.find((row: any) => row.id === 'Char_Ais');
    expect(ais?.好感度).toBe(42);
    expect(ais?.所在位置).toBe('公会大厅');
  });

  it('does not reset affinity when NPC_RelationshipEvents contains empty absolute affinity fields', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [
      {
        id: 'Char_Ais',
        姓名: '艾丝',
        好感度: 37,
        关系状态: '熟识',
        记忆: []
      }
    ];

    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_RelationshipEvents',
      rows: [
        {
          event_id: 'ev_1',
          npc_id: 'Char_Ais',
          npc_name: '艾丝',
          event: '短暂交谈',
          relationship_state: '友好',
          affinity_score: '',
          好感度: ''
        }
      ]
    });

    expect(result.success).toBe(true);
    const ais = state.社交.find((row: any) => row.id === 'Char_Ais');
    expect(ais?.关系状态).toBe('友好');
    expect(ais?.好感度).toBe(37);
  });

  it('upserts CHARACTER_Resources rows into player valis', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 10;

    const result = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Resources',
      rows: [
        {
          CHAR_ID: 'PC_MAIN',
          金币: 999
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.角色.法利).toBe(999);
    expect(state.__tableRows.CHARACTER_Resources[0].金币).toBe(999);
  });

  it('keeps quest fields when partial QUEST_Active updates omit optional columns', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const first = handleUpsertSheetRows(state, {
      sheetId: 'QUEST_Active',
      rows: [
        {
          任务ID: 'QUEST_KEEP_001',
          任务名称: '调查异常魔力',
          状态: '进行中',
          目标描述: '前往第 8 层调查魔力涌动',
          奖励: '3000 法利'
        }
      ]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'QUEST_Active',
      rows: [
        {
          任务ID: 'QUEST_KEEP_001',
          状态: 'completed'
        }
      ]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const quest = (state.任务 || []).find((row: any) => row.id === 'QUEST_KEEP_001');
    expect(quest?.状态).toBe('completed');
    expect(quest?.描述).toBe('前往第 8 层调查魔力涌动');
    expect(quest?.奖励).toBe('3000 法利');
  });

  it('keeps faction fields when partial FACTION_Standing updates omit optional columns', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const first = handleUpsertSheetRows(state, {
      sheetId: 'FACTION_Standing',
      rows: [
        {
          势力ID: 'FACTION_KEEP_001',
          势力名称: '赫斯缇雅眷族',
          关系等级: '友好',
          声望值: 120,
          关键事件: '共同讨伐米诺陶洛斯'
        }
      ]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'FACTION_Standing',
      rows: [
        {
          势力ID: 'FACTION_KEEP_001',
          势力名称: '赫斯缇雅眷族'
        }
      ]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const faction = (state.势力 || []).find((row: any) => row.id === 'FACTION_KEEP_001');
    expect(faction?.声望).toBe(120);
    expect(faction?.关系).toBe('友好');
    expect(faction?.描述).toBe('共同讨伐米诺陶洛斯');
  });

  it('keeps pending thread title when PHONE_Pending partial updates omit title field', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const first = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Pending',
      rows: [
        {
          pending_id: 'pending_keep_001',
          thread_id: 'Thr_keep_001',
          thread_title: '赫斯缇雅',
          status: 'scheduled',
          payload_preview: '晚点回复你'
        }
      ]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Pending',
      rows: [
        {
          pending_id: 'pending_keep_001',
          status: 'sent'
        }
      ]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const pending = ((state.手机?.待发送 || []) as any[]).find((row) => row.id === 'pending_keep_001');
    expect(pending?.threadTitle).toBe('赫斯缇雅');
    expect(pending?.status).toBe('sent');
  });

  it('upserts ECON_Ledger rows and syncs runtime balances', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 100;
    state.眷族.资金 = 500;

    const result = handleUpsertSheetRows(state, {
      sheetId: 'ECON_Ledger',
      rows: [
        {
          ledger_id: 'ECO_TEST_1',
          account: '角色.法利',
          before: 100,
          delta: 80,
          after: 180,
          reason: '任务奖励'
        },
        {
          ledger_id: 'ECO_TEST_2',
          账户: '眷族.资金',
          变更后: 420,
          原因: '采购扣款'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.角色.法利).toBe(180);
    expect(state.眷族.资金).toBe(420);
    expect(Array.isArray(state.经济流水)).toBe(true);
    expect(state.经济流水).toHaveLength(2);
    expect(state.经济流水[0].account).toBe('角色.法利');
    expect(state.经济流水[1].account).toBe('眷族.资金');
    expect(state.__tableRows.ECON_Ledger[1].account).toBe('眷族.资金');
  });

  it('upserts CHARACTER_Attributes rows into player dnd profile', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Attributes',
      rows: [
        {
          CHAR_ID: 'PC_MAIN',
          等级: 3,
          HP: '45/52',
          AC: 16,
          先攻加值: 2,
          速度: '30尺(6格)',
          属性值: '{"STR":16,"DEX":14,"CON":13,"INT":10,"WIS":12,"CHA":8}',
          豁免熟练: '["力量","体质"]',
          技能熟练: '{"运动":"proficient","察觉":"expertise"}',
          被动感知: 14,
          经验值: '6500/14000'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.角色.等级).toBe(3);
    expect(state.角色.生命值).toBe(45);
    expect(state.角色.最大生命值).toBe(52);
    expect(state.角色.经验值).toBe(6500);
    expect(state.角色.升级所需伟业).toBe(14000);

    const profile = state.角色.dndProfile || state.角色.DND档案;
    expect(profile).toBeTruthy();
    expect(profile.护甲等级).toBe(16);
    expect(profile.先攻加值).toBe(2);
    expect(profile.速度尺).toBe(30);
    expect(profile.属性值.STR).toBe(16);
    expect(profile.属性值.DEX).toBe(14);
    expect(profile.豁免熟练.STR).toBe(true);
    expect(profile.豁免熟练.CON).toBe(true);
    expect(profile.技能熟练['察觉']).toBe('expertise');
    expect(profile.被动感知).toBe(14);
  });

  it('upserts CHARACTER_Registry familia fields into player and familia state', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Registry',
      rows: [
        {
          CHAR_ID: 'PC_MAIN',
          姓名: 'Tester',
          职业: '见习冒险者',
          外貌描述: '银发短发',
          背景故事: '来自乡野',
          '种族/性别/年龄': '人类/男性/18',
          所属眷族: '赫斯缇雅眷族'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.角色.所属眷族).toBe('赫斯缇雅眷族');
    expect(state.角色.眷族).toBe('赫斯缇雅眷族');
    expect(state.眷族.名称).toBe('赫斯缇雅眷族');
  });

  it('upserts SKILL_Library and CHARACTER_Skills rows into player skills and magic', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const libraryResult = handleUpsertSheetRows(state, {
      sheetId: 'SKILL_Library',
      rows: [
        {
          SKILL_ID: 'SKL_TEST_001',
          技能名称: '疾风斩',
          技能类型: '主动',
          效果描述: '对单体造成额外伤害'
        },
        {
          SKILL_ID: 'MAG_TEST_001',
          技能名称: '烈焰枪',
          技能类型: '法术',
          学派: '火',
          施法时间: '短咏唱',
          效果描述: '造成范围火焰伤害'
        }
      ]
    });
    const linkResult = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Skills',
      rows: [
        { LINK_ID: 'SLINK_TEST_001', CHAR_ID: 'PC_MAIN', SKILL_ID: 'SKL_TEST_001' },
        { LINK_ID: 'SLINK_TEST_002', CHAR_ID: 'PC_MAIN', SKILL_ID: 'MAG_TEST_001' }
      ]
    });

    expect(libraryResult.success).toBe(true);
    expect(linkResult.success).toBe(true);
    expect(state.角色.技能).toHaveLength(1);
    expect(state.角色.技能[0].id).toBe('SKL_TEST_001');
    expect(state.角色.技能[0].名称).toBe('疾风斩');
    expect(state.角色.魔法).toHaveLength(1);
    expect(state.角色.魔法[0].id).toBe('MAG_TEST_001');
    expect(state.角色.魔法[0].名称).toBe('烈焰枪');
    expect(state.角色.魔法[0].咏唱).toBe('短咏唱');
    expect(state.角色.魔法[0].属性).toBe('火');
  });

  it('upserts CHARACTER_Resources spell slots and hit dice into dnd profile', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Resources',
      rows: [
        {
          CHAR_ID: 'PC_MAIN',
          法术位: '{"1环":"4/4","2环":"2/2"}',
          生命骰: '3d8',
          金币: 1200
        }
      ]
    });

    expect(result.success).toBe(true);
    const profile = state.角色.dndProfile || state.角色.DND档案;
    expect(profile).toBeTruthy();
    expect(profile.法术位['1环']).toBe('4/4');
    expect(profile.法术位['2环']).toBe('2/2');
    expect(profile.生命骰).toBe('3d8');
    expect(state.角色.法利).toBe(1200);
  });

  it('accepts alias keys for CHARACTER_Attributes and CHARACTER_Resources rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const attrResult = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Attributes',
      rows: [
        {
          char_id: 'PC_MAIN',
          level: 4,
          hp: { current: 38, max: 52 },
          ac: 17,
          initiativeBonus: 3,
          speed: '30 ft',
          abilityScores: { STR: 16, DEX: 15, CON: 14, INT: 10, WIS: 12, CHA: 9 },
          saveProficiency: ['STR', 'CON'],
          skillProficiencies: { 察觉: 'expertise' },
          passivePerception: 15,
          xp: '7200/14000'
        }
      ]
    });
    const resourceResult = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Resources',
      rows: [
        {
          char_id: 'PC_MAIN',
          spellSlots: [{ level: 1, current: 4, max: 4 }, { level: 2, current: 2, max: 2 }],
          hitDice: '4d8',
          gp: 2333
        }
      ]
    });

    expect(attrResult.success).toBe(true);
    expect(resourceResult.success).toBe(true);
    const profile = state.角色.dndProfile || state.角色.DND档案;
    expect(state.角色.等级).toBe(4);
    expect(state.角色.生命值).toBe(38);
    expect(state.角色.最大生命值).toBe(52);
    expect(profile.护甲等级).toBe(17);
    expect(profile.先攻加值).toBe(3);
    expect(profile.速度尺).toBe(30);
    expect(profile.被动感知).toBe(15);
    expect(profile.法术位['1环']).toBe('4/4');
    expect(profile.法术位['2环']).toBe('2/2');
    expect(profile.生命骰).toBe('4d8');
    expect(state.角色.法利).toBe(2333);
  });

  it('accepts alias keys for LOG_Summary and LOG_Outline rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.当前日期 = '1000-01-01';
    state.游戏时间 = '第1日 09:30';
    state.回合数 = 6;

    const summaryResult = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Summary',
      rows: [
        {
          turn: 6,
          time: '第1日 09:30',
          location: '公会大厅',
          summary: '通过英文别名写入总结行。',
          amIndex: 'AM0006'
        }
      ]
    });
    const outlineResult = handleUpsertSheetRows(state, {
      sheetId: 'LOG_Outline',
      rows: [
        {
          chapter: '第一章',
          title: '别名写入验证',
          startTurn: 6,
          outline: '验证 outline 别名字段可正常入库。',
          events: ['别名字段', '写入成功'],
          amIndex: 'AM0006'
        }
      ]
    });

    expect(summaryResult.success).toBe(true);
    expect(outlineResult.success).toBe(true);
    expect(state.日志摘要[0].编码索引).toBe('AM0006');
    expect(state.日志摘要[0].纪要).toContain('别名');
    expect(state.日志大纲[0].编码索引).toBe('AM0006');
    expect(state.日志大纲[0].大纲).toContain('别名');
  });

  it('handles COMBAT_BattleMap config/token legacy rows through upsert_sheet_rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'COMBAT_BattleMap',
      rows: [
        {
          单位名称: 'Map_Config',
          类型: 'Config',
          坐标: '24x18'
        },
        {
          单位名称: '头狼',
          类型: 'Token',
          坐标: '(4,6)',
          大小: '1x1',
          Token: 'token://wolf'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.战斗?.视觉?.地图尺寸).toEqual({ 宽度: 24, 高度: 18 });
    const wolf = (state.战斗?.地图 || []).find((row: any) => row.名称 === '头狼');
    expect(wolf).toBeTruthy();
    expect(wolf?.位置).toEqual({ x: 4, y: 6 });
    expect(wolf?.图标).toBe('token://wolf');
  });

  it('deletes rows from both domain state and table shadow store', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsert = handleUpsertSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rows: [
        {
          物品ID: 'ITEM_TEST_001',
          物品名称: '测试短剑',
          数量: 1,
          类别: '武器'
        }
      ]
    });
    expect(upsert.success).toBe(true);
    expect(state.背包.some((item: any) => item.id === 'ITEM_TEST_001')).toBe(true);

    const deleted = handleDeleteSheetRows(state, {
      sheetId: 'ITEM_Inventory',
      rowIds: ['ITEM_TEST_001']
    });

    expect(deleted.success).toBe(true);
    expect(state.背包.some((item: any) => item.id === 'ITEM_TEST_001')).toBe(false);
    expect(Array.isArray(state.__tableRows.ITEM_Inventory)).toBe(true);
    expect(state.__tableRows.ITEM_Inventory).toHaveLength(0);
  });

  it('accepts system sheet rows even without domain mapper', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'SYS_MappingRegistry',
      rows: [
        {
          domain: 'test_domain',
          module: 'test_module',
          sheet_id: 'QUEST_Active',
          primary_key: '任务ID',
          description: 'test mapping'
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(state.__tableRows?.SYS_MappingRegistry)).toBe(true);
    expect(state.__tableRows.SYS_MappingRegistry[0].domain).toBe('test_domain');
  });

  it('upserts and deletes phone thread/message rows via table commands', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsertThread = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Threads',
      rows: [
        {
          thread_id: 'Thr900',
          type: 'private',
          title: '赫斯缇雅',
          members: 'Tester,赫斯缇雅',
          unread: 1
        }
      ]
    });
    const upsertMessage = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Messages',
      rows: [
        {
          message_id: 'MSG900',
          thread_id: 'Thr900',
          sender: '赫斯缇雅',
          content: '你到公会了吗？',
          timestamp: '第2日 14:30'
        }
      ]
    });

    expect(upsertThread.success).toBe(true);
    expect(upsertMessage.success).toBe(true);
    expect(state.手机.对话.私聊.some((thread: any) => thread.id === 'Thr900')).toBe(true);
    const thread = state.手机.对话.私聊.find((item: any) => item.id === 'Thr900');
    expect(thread?.消息?.some((msg: any) => msg.id === 'MSG900')).toBe(true);

    const deleted = handleDeleteSheetRows(state, {
      sheetId: 'PHONE_Messages',
      rowIds: ['MSG900']
    });
    expect(deleted.success).toBe(true);
    const nextThread = state.手机.对话.私聊.find((item: any) => item.id === 'Thr900');
    expect(nextThread?.消息?.some((msg: any) => msg.id === 'MSG900')).toBe(false);
  });

  it('upserts world npc tracking rows and projects back to world state', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsert = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_NpcTracking',
      rows: [
        {
          tracking_id: 'npc_track_hestia',
          npc_name: '赫斯缇雅',
          current_action: '在教堂整理文书',
          location: '赫斯缇雅眷族驻地',
          progress: '30%',
          eta: '第2日 18:00'
        }
      ]
    });

    expect(upsert.success).toBe(true);
    expect(Array.isArray(state.世界?.NPC后台跟踪)).toBe(true);
    expect(state.世界.NPC后台跟踪[0]?.NPC).toBe('赫斯缇雅');
    expect(state.世界.NPC后台跟踪[0]?.当前行动).toBe('在教堂整理文书');

    const deleted = handleDeleteSheetRows(state, {
      sheetId: 'WORLD_NpcTracking',
      rowIds: ['npc_track_hestia']
    });
    expect(deleted.success).toBe(true);
    expect(state.世界.NPC后台跟踪).toHaveLength(0);
  });

  it('filters player references from WORLD_NpcTracking rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsert = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_NpcTracking',
      rows: [
        {
          tracking_id: 'npc_track_player',
          npc_name: 'Tester',
          current_action: '自己在做自己的事',
          location: '公会大厅'
        },
        {
          tracking_id: 'npc_track_npc',
          npc_name: '赫斯缇雅',
          current_action: '在教堂整理文书',
          location: '赫斯缇雅眷族驻地'
        }
      ]
    });

    expect(upsert.success).toBe(true);
    expect(state.世界.NPC后台跟踪).toHaveLength(1);
    expect(state.世界.NPC后台跟踪[0]?.NPC).toBe('赫斯缇雅');
  });

  it('upserts and deletes world dynamic rows via table commands', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsertNews = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_News',
      rows: [
        {
          news_id: 'news_001',
          标题: '公会发布远征预警',
          内容: '第18层出现异常魔力反应',
          来源: 'guild',
          重要度: 'urgent',
          时间戳: '第2日 12:00'
        }
      ]
    });
    const upsertRumor = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_Rumors',
      rows: [
        {
          rumor_id: 'rumor_001',
          主题: '怪物祭前夜异动',
          内容: '西北大街出现不明队伍',
          传播度: 64,
          可信度: 'likely',
          来源: 'street',
          话题标签: '怪物祭,西北大街'
        }
      ]
    });
    const upsertDenatus = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_Denatus',
      rows: [
        {
          denatus_id: 'DENATUS_MAIN',
          下次神会开启时间: '第3日 20:00',
          神会主题: '地下城封锁',
          讨论内容: '赫斯缇雅:维持秩序 | 洛基:加强侦查',
          最终结果: '通过临时封锁提案'
        }
      ]
    });
    const upsertWarGame = handleUpsertSheetRows(state, {
      sheetId: 'WORLD_WarGame',
      rows: [
        {
          war_game_id: 'WARGAME_MAIN',
          状态: '筹备',
          参战眷族: '赫斯缇雅眷族,阿波罗眷族',
          形式: '攻防战',
          赌注: '驻地归属'
        }
      ]
    });

    expect(upsertNews.success).toBe(true);
    expect(upsertRumor.success).toBe(true);
    expect(upsertDenatus.success).toBe(true);
    expect(upsertWarGame.success).toBe(true);
    expect(state.世界.头条新闻[0]?.标题).toBe('公会发布远征预警');
    expect(state.世界.街头传闻[0]?.主题).toBe('怪物祭前夜异动');
    expect(state.世界.诸神神会?.神会主题).toBe('地下城封锁');
    expect(state.世界.战争游戏?.状态).toBe('筹备');

    const deleted = handleDeleteSheetRows(state, {
      sheetId: 'WORLD_News',
      rowIds: ['news_001']
    });
    expect(deleted.success).toBe(true);
    expect(Array.isArray(state.世界.头条新闻)).toBe(true);
    expect(state.世界.头条新闻).toHaveLength(0);
  });

  it('upserts forum/moment rows and rebuilds social feeds from tables', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsertMoment = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Moments',
      rows: [
        {
          moment_id: 'Moment_001',
          发布者: 'Tester',
          内容: '今天先去公会报到',
          时间戳: '第2日 08:30',
          可见性: 'friends',
          点赞数: 3
        }
      ]
    });
    const upsertBoard = handleUpsertSheetRows(state, {
      sheetId: 'FORUM_Boards',
      rows: [
        { board_id: 'board_news', 名称: '欧拉丽快报', 描述: '快报信息' }
      ]
    });
    const upsertPost = handleUpsertSheetRows(state, {
      sheetId: 'FORUM_Posts',
      rows: [
        {
          post_id: 'Forum_001',
          board_id: 'board_news',
          标题: '怪物祭筹备进展',
          内容: '南大街已经开始布置路障',
          发布者: '路人冒险者',
          时间戳: '第2日 09:00'
        }
      ]
    });
    const upsertReply = handleUpsertSheetRows(state, {
      sheetId: 'FORUM_Replies',
      rows: [
        {
          reply_id: 'Forum_001_reply_1',
          post_id: 'Forum_001',
          楼层: 1,
          发布者: 'Tester',
          内容: '收到，我这就过去看看',
          时间戳: '第2日 09:05'
        }
      ]
    });

    expect(upsertMoment.success).toBe(true);
    expect(upsertBoard.success).toBe(true);
    expect(upsertPost.success).toBe(true);
    expect(upsertReply.success).toBe(true);
    expect(state.手机.朋友圈.帖子.some((post: any) => post.id === 'Moment_001')).toBe(true);
    expect(state.手机.公共帖子.板块.some((board: any) => board.名称 === '欧拉丽快报')).toBe(true);
    const post = state.手机.公共帖子.帖子.find((item: any) => item.id === 'Forum_001');
    expect(post?.标题).toBe('怪物祭筹备进展');
    expect(Array.isArray(post?.回复)).toBe(true);
    expect(post?.回复?.some((reply: any) => reply.id === 'Forum_001_reply_1')).toBe(true);

    const deletedReply = handleDeleteSheetRows(state, {
      sheetId: 'FORUM_Replies',
      rowIds: ['Forum_001_reply_1']
    });
    expect(deletedReply.success).toBe(true);
    const postAfterReplyDelete = state.手机.公共帖子.帖子.find((item: any) => item.id === 'Forum_001');
    expect(postAfterReplyDelete?.回复?.length || 0).toBe(0);

    const deletedPost = handleDeleteSheetRows(state, {
      sheetId: 'FORUM_Posts',
      rowIds: ['Forum_001']
    });
    expect(deletedPost.success).toBe(true);
    expect(state.手机.公共帖子.帖子.some((item: any) => item.id === 'Forum_001')).toBe(false);
  });

  it('upserts and deletes story/contract rows via table commands', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsertMainline = handleUpsertSheetRows(state, {
      sheetId: 'STORY_Mainline',
      rows: [
        {
          mainline_id: 'MAINLINE_PRIMARY',
          当前卷数: 2,
          当前篇章: '怪物祭前夜',
          当前阶段: '冲突预热',
          关键节点: '确认异常魔力来源',
          节点状态: '进行中',
          当前目标: '前往西北大街调查',
          下一触发: '抵达封锁区',
          行动提示: '先联系公会窗口',
          预定日期: '第3日',
          下一关键时间: '第3日 19:00',
          是否正史: true,
          偏移度: 12,
          分歧说明: '提前触发怪物祭线',
          备注: '需关注阿波罗眷族动向'
        }
      ]
    });
    const upsertTriggers = handleUpsertSheetRows(state, {
      sheetId: 'STORY_Triggers',
      rows: [
        {
          trigger_id: 'TRIGGER_001',
          预计触发: '第3日 19:00',
          内容: '公会封锁公告发布',
          类型: '世界',
          状态: '待触发'
        }
      ]
    });
    const upsertMilestones = handleUpsertSheetRows(state, {
      sheetId: 'STORY_Milestones',
      rows: [
        {
          milestone_id: 'MILESTONE_001',
          时间: '第2日 18:00',
          事件: '完成首次地表巡查',
          影响: '解锁封锁区调查线'
        }
      ]
    });
    const upsertContract = handleUpsertSheetRows(state, {
      sheetId: 'CONTRACT_Registry',
      rows: [
        {
          contract_id: 'CONTRACT_001',
          名称: '公会临时委托',
          描述: '调查西北大街异常人流',
          状态: 'active',
          条款: '24小时内提交报告'
        }
      ]
    });

    expect(upsertMainline.success).toBe(true);
    expect(upsertTriggers.success).toBe(true);
    expect(upsertMilestones.success).toBe(true);
    expect(upsertContract.success).toBe(true);
    expect(state.剧情.主线.当前篇章).toBe('怪物祭前夜');
    expect(state.剧情.引导.当前目标).toBe('前往西北大街调查');
    expect(state.剧情.待触发[0]?.内容).toBe('公会封锁公告发布');
    expect(state.剧情.里程碑[0]?.事件).toBe('完成首次地表巡查');
    expect(state.契约[0]?.id).toBe('CONTRACT_001');

    const deletedTrigger = handleDeleteSheetRows(state, {
      sheetId: 'STORY_Triggers',
      rowIds: ['TRIGGER_001']
    });
    const deletedContract = handleDeleteSheetRows(state, {
      sheetId: 'CONTRACT_Registry',
      rowIds: ['CONTRACT_001']
    });
    expect(deletedTrigger.success).toBe(true);
    expect(deletedContract.success).toBe(true);
    expect(state.剧情.待触发).toHaveLength(0);
    expect(state.契约).toHaveLength(0);
  });

  it('upserts map metadata sheets and rebuilds world map state', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const upsertSurface = handleUpsertSheetRows(state, {
      sheetId: 'MAP_SurfaceLocations',
      rows: [
        {
          location_id: 'loc_guild',
          name: '公会本部',
          type: 'GUILD',
          x: 4888,
          y: 5021,
          radius: 30,
          description: '登记大厅'
        }
      ]
    });
    const upsertMid = handleUpsertSheetRows(state, {
      sheetId: 'MAP_MidLocations',
      rows: [
        {
          mid_id: 'mid_guild_lobby',
          name: '公会大厅',
          parent_id: 'loc_guild',
          x: 4888,
          y: 5021,
          floor: 0,
          map_structure: { layout: 'rect-grid' }
        }
      ]
    });

    expect(upsertSurface.success).toBe(true);
    expect(upsertMid.success).toBe(true);
    expect(state.地图.surfaceLocations.some((row: any) => row.id === 'loc_guild')).toBe(true);
    expect(state.地图.midLocations.some((row: any) => row.id === 'mid_guild_lobby')).toBe(true);
  });

  it('upserts npc trace/interaction sheets and syncs back to social state', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [{ id: 'Char_Eina', 姓名: '埃伊娜', 记忆: [] }];
    const trace = handleUpsertSheetRows(state, {
      sheetId: 'NPC_LocationTrace',
      rows: [
        {
          trace_id: 'trace_001',
          npc_id: 'Char_Eina',
          npc_name: '埃伊娜',
          timestamp: '第1日 07:05',
          location: '公会大厅',
          x: 5010,
          y: 4902,
          present: true
        }
      ]
    });
    const interaction = handleUpsertSheetRows(state, {
      sheetId: 'NPC_InteractionLog',
      rows: [
        {
          interaction_id: 'int_001',
          npc_id: 'Char_Eina',
          npc_name: '埃伊娜',
          timestamp: '第1日 07:10',
          type: 'dialogue',
          summary: '提醒先办理登记手续',
          source: 'memory-service'
        }
      ]
    });

    expect(trace.success).toBe(true);
    expect(interaction.success).toBe(true);
    const npc = state.社交.find((row: any) => row.id === 'Char_Eina');
    expect(npc?.所在位置).toBe('公会大厅');
    expect(npc?.是否在场).toBe(true);
    expect(Array.isArray(npc?.互动记录)).toBe(true);
    expect(npc?.互动记录?.[0]?.summary).toBe('提醒先办理登记手续');
  });

  it('filters player references from NPC_LocationTrace and NPC_InteractionLog rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [{ id: 'Char_Eina', 姓名: '埃伊娜', 记忆: [] }];
    const trace = handleUpsertSheetRows(state, {
      sheetId: 'NPC_LocationTrace',
      rows: [
        {
          trace_id: 'trace_player',
          npc_id: 'PC_MAIN',
          npc_name: 'Tester',
          timestamp: '第1日 07:01',
          location: '公会大厅',
          present: true
        },
        {
          trace_id: 'trace_001',
          npc_id: 'Char_Eina',
          npc_name: '埃伊娜',
          timestamp: '第1日 07:05',
          location: '公会大厅',
          present: true
        }
      ]
    });
    const interaction = handleUpsertSheetRows(state, {
      sheetId: 'NPC_InteractionLog',
      rows: [
        {
          interaction_id: 'int_player',
          npc_id: 'PC_MAIN',
          npc_name: 'Tester',
          timestamp: '第1日 07:02',
          type: 'dialogue',
          summary: '玩家自言自语',
          source: 'memory-service'
        },
        {
          interaction_id: 'int_001',
          npc_id: 'Char_Eina',
          npc_name: '埃伊娜',
          timestamp: '第1日 07:10',
          type: 'dialogue',
          summary: '提醒先办理登记手续',
          source: 'memory-service'
        }
      ]
    });

    expect(trace.success).toBe(true);
    expect(interaction.success).toBe(true);
    // Must not create player record under 社交.
    expect(state.社交.some((row: any) => row.姓名 === 'Tester' || row.id === 'PC_MAIN')).toBe(false);
    const eina = state.社交.find((row: any) => row.id === 'Char_Eina');
    expect(eina?.所在位置).toBe('公会大厅');
    expect(eina?.互动记录?.[0]?.interaction_id).toBe('int_001');
  });

  it('upserts quest objective/progress sheets and syncs task objectives/logs', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const objective = handleUpsertSheetRows(state, {
      sheetId: 'QUEST_Objectives',
      rows: [
        {
          objective_id: 'q1_obj1',
          quest_id: 'Q001',
          objective: '向公会窗口提交登记表',
          status: 'active'
        }
      ]
    });
    const progress = handleUpsertSheetRows(state, {
      sheetId: 'QUEST_ProgressLog',
      rows: [
        {
          progress_id: 'q1_log1',
          quest_id: 'Q001',
          timestamp: '第1日 07:12',
          content: '已领取并填写登记表',
          status: 'active'
        }
      ]
    });

    expect(objective.success).toBe(true);
    expect(progress.success).toBe(true);
    const quest = state.任务.find((row: any) => row.id === 'Q001');
    expect(quest).toBeDefined();
    expect(Array.isArray((quest as any).目标列表)).toBe(true);
    expect((quest as any).目标列表[0]?.objective).toBe('向公会窗口提交登记表');
    expect(Array.isArray(quest?.日志)).toBe(true);
    expect(quest?.日志?.[0]?.内容).toBe('已领取并填写登记表');
  });

  it('filters player references when writing PHONE_Contacts', () => {
    const state = createNewGameState('贝尔', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'PHONE_Contacts',
      rows: [
        { contact_id: '{{user}}', name: '{{user}}', bucket: 'friend', blacklisted: false, recent: true },
        { contact_id: 'player', name: 'player', bucket: 'friend', blacklisted: false, recent: true },
        { contact_id: '贝尔', name: '贝尔', bucket: 'friend', blacklisted: false, recent: true },
        { contact_id: '莉莉', name: '莉莉', bucket: 'friend', blacklisted: false, recent: true }
      ]
    });

    expect(result.success).toBe(true);
    expect(state.手机.联系人.好友).toEqual(['莉莉']);
    expect(state.__tableRows.PHONE_Contacts).toHaveLength(1);
    expect(state.__tableRows.PHONE_Contacts[0].contact_id).toBe('莉莉');
  });

  it('keeps SYS_GlobalState as a single-row snapshot and infers elapsed duration', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 8;
    state.游戏时间 = '第2日 08:00';
    state.上轮时间 = '第2日 07:30';

    const first = handleUpsertSheetRows(state, {
      sheetId: 'SYS_GlobalState',
      rows: [{ 当前回合: 8, 游戏时间: '第2日 08:00', 当前场景: '公会大厅' }]
    });
    const second = handleUpsertSheetRows(state, {
      sheetId: 'SYS_GlobalState',
      rows: [{ 当前回合: 9, 游戏时间: '第2日 09:15', 当前场景: '中央广场' }]
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(state.__tableRows.SYS_GlobalState).toHaveLength(1);
    expect(state.__tableRows.SYS_GlobalState[0]._global_id).toBe('GLOBAL_STATE');
    expect(state.__tableRows.SYS_GlobalState[0].当前回合).toBe(9);
    expect(state.__tableRows.SYS_GlobalState[0].上轮时间).toBe('第2日 08:00');
    expect(state.__tableRows.SYS_GlobalState[0].流逝时长).toBe('1小时15分钟');
    expect(state.游戏时间).toBe('第2日 09:15');
    expect(state.上轮时间).toBe('第2日 08:00');
  });

  it('normalizes CHARACTER_Attributes and CHARACTER_Resources to single PC_MAIN row', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const attrs = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Attributes',
      rows: [
        { 等级: 5, HP: '88/100' },
        { CHAR_ID: 'ALLY_001', 等级: 99, HP: '999/999' }
      ]
    });
    const resources = handleUpsertSheetRows(state, {
      sheetId: 'CHARACTER_Resources',
      rows: [
        { 金币: 3210, 法术位: '{"1环":"2/4"}' },
        { CHAR_ID: 'ALLY_002', 金币: 99999 }
      ]
    });

    expect(attrs.success).toBe(true);
    expect(resources.success).toBe(true);
    expect(state.__tableRows.CHARACTER_Attributes).toHaveLength(1);
    expect(state.__tableRows.CHARACTER_Resources).toHaveLength(1);
    expect(state.__tableRows.CHARACTER_Attributes[0].CHAR_ID).toBe('PC_MAIN');
    expect(state.__tableRows.CHARACTER_Resources[0].CHAR_ID).toBe('PC_MAIN');
    expect(state.角色.等级).toBe(5);
    expect(state.角色.法利).toBe(3210);
  });

  it('rejects player references from NPC_Registry writes', () => {
    const state = createNewGameState('贝尔', '男', 'Human') as any;
    const result = handleUpsertSheetRows(state, {
      sheetId: 'NPC_Registry',
      rows: [
        { NPC_ID: '{{user}}', 姓名: '{{user}}', 当前状态: '在场' },
        { NPC_ID: 'Char_Bell', 姓名: '贝尔', 当前状态: '在场' },
        { NPC_ID: 'Char_Lili', 姓名: '莉莉', 当前状态: '在场' }
      ]
    });

    expect(result.success).toBe(true);
    const names = (state.社交 || []).map((npc: any) => npc.姓名);
    expect(names).toEqual(['莉莉']);
    expect(state.__tableRows.NPC_Registry).toHaveLength(1);
    expect(state.__tableRows.NPC_Registry[0].姓名).toBe('莉莉');
  });
});
