import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import type { TavernCommand } from '../../types';
import { applyNarrativeNpcFallback } from '../../utils/state/npcNarrativeFallback';

describe('npc narrative fallback', () => {
  it('creates npc + interaction commands when narrative contains new speaker', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const input = JSON.stringify({
      当前地点: '欧拉丽南大街',
      游戏时间: '第1日 08:05',
      回合数: 3,
      叙事: [
        { sender: '旁白', text: '她停在路边摊前。' },
        { sender: '矮人摊贩', text: '要买点防身家伙吗？给你九折。' }
      ],
      填表任务: {
        requiredSheets: ['NPC_Registry', 'NPC_InteractionLog']
      }
    });

    const result = applyNarrativeNpcFallback(input, [], state);

    expect(result.applied).toBe(true);
    expect(result.reasonClass).toBe('applied');
    expect(result.commands.length).toBe(2);

    const upsertNpc = result.commands.find((cmd) => cmd.action === 'upsert_npc') as TavernCommand;
    expect(Array.isArray((upsertNpc as any)?.value)).toBe(true);
    expect((upsertNpc as any)?.value?.[0]?.姓名).toBe('矮人摊贩');

    const interaction = result.commands.find((cmd) => cmd.action === 'upsert_sheet_rows' && (cmd as any)?.value?.sheetId === 'NPC_InteractionLog') as TavernCommand;
    expect((interaction as any)?.value?.rows?.[0]?.npc_name).toBe('矮人摊贩');
    expect(String((interaction as any)?.value?.rows?.[0]?.summary || '')).toContain('矮人摊贩');
  });

  it('does not inject when npc mutation is already covered by state commands', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    const input = JSON.stringify({
      叙事: [
        { sender: '矮人摊贩', text: '今天心情好，给你折扣。' }
      ],
      填表任务: {
        requiredSheets: ['NPC_Registry', 'NPC_InteractionLog']
      }
    });

    const existing: TavernCommand[] = [
      {
        action: 'upsert_npc',
        value: [{ id: 'NPC_DWARF_001', 姓名: '矮人摊贩', 当前状态: '在场' }]
      } as any
    ];

    const result = applyNarrativeNpcFallback(input, existing, state);
    expect(result.applied).toBe(false);
    expect(result.reasonClass).toBe('already-covered');
    expect(result.commands).toHaveLength(1);
  });
});
