import { describe, expect, it } from 'vitest';
import type { GameState, TavernCommand } from '../../types';
import {
  extractNpcPresenceEvidenceFromStateServiceInput,
  guardNpcPresenceCommands
} from '../../utils/state/npcPresenceGuard';

const createState = (): GameState =>
  ({
    社交: [
      { id: 'Char_Hestia', 姓名: '赫斯缇雅', 是否在场: true, 当前状态: '在场' }
    ]
  } as any);

describe('npcPresenceGuard', () => {
  it('extracts present NPC evidence from state input narrative speakers', () => {
    const state = createState();
    const input = JSON.stringify({
      叙事: [
        { sender: '旁白', text: '酒馆里人声鼎沸。' },
        { sender: '赫斯缇雅', text: '你终于来了。' }
      ]
    });

    const evidence = extractNpcPresenceEvidenceFromStateServiceInput(input, state);
    expect(evidence.presentNpcNames.has('赫斯缇雅')).toBe(true);
    expect(evidence.allowAbsentNpcNames.has('赫斯缇雅')).toBe(false);
  });

  it('allows absent patch when narrative explicitly states NPC departure', () => {
    const state = createState();
    const input = JSON.stringify({
      叙事: [
        { sender: '赫斯缇雅', text: '我先离开一会儿，待会见。' }
      ]
    });

    const evidence = extractNpcPresenceEvidenceFromStateServiceInput(input, state);
    expect(evidence.presentNpcNames.has('赫斯缇雅')).toBe(true);
    expect(evidence.allowAbsentNpcNames.has('赫斯缇雅')).toBe(true);
  });

  it('strips mistaken absent fields for in-scene npc upsert_npc patch', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_npc',
        value: [
          {
            id: 'Char_Hestia',
            姓名: '赫斯缇雅',
            当前状态: '离场',
            是否在场: false,
            位置详情: '丰饶的女主人'
          }
        ]
      } as any
    ];

    const guarded = guardNpcPresenceCommands(commands, {
      presentNpcNames: new Set(['赫斯缇雅']),
      allowAbsentNpcNames: new Set()
    });

    expect(guarded.blocked).toBe(1);
    const row = (guarded.commands[0] as any)?.value?.[0];
    expect(row.姓名).toBe('赫斯缇雅');
    expect(row.位置详情).toBe('丰饶的女主人');
    expect(row.是否在场).toBeUndefined();
    expect(row.当前状态).toBeUndefined();
  });

  it('strips mistaken absent fields for in-scene npc registry sheet patch', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'NPC_Registry',
          keyField: 'NPC_ID',
          rows: [
            {
              NPC_ID: 'Char_Hestia',
              姓名: '赫斯缇雅',
              status: '离场',
              present: false
            }
          ]
        }
      } as any
    ];

    const guarded = guardNpcPresenceCommands(commands, {
      presentNpcNames: new Set(['赫斯缇雅']),
      allowAbsentNpcNames: new Set()
    });

    expect(guarded.blocked).toBe(1);
    const row = (guarded.commands[0] as any)?.value?.rows?.[0];
    expect(row.姓名).toBe('赫斯缇雅');
    expect(row.present).toBeUndefined();
    expect(row.status).toBeUndefined();
  });
});

