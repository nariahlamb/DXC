import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import {
  applyNarrativeEconomicFallback,
  hasEconomicMutationCommand
} from '../../utils/state/econNarrativeFallback';

describe('econ narrative fallback', () => {
  it('derives payment delta from narrative price + payment action', () => {
    const input = JSON.stringify({
      玩家输入: '吃早餐并打听消息',
      叙事: [
        { sender: '矮人摊主', text: '两个一共 60 法利。' },
        { sender: '旁白', text: '她爽快地摸出几枚硬币拍在柜台上。' }
      ],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'ECON_Ledger']
      }
    });

    const result = applyNarrativeEconomicFallback(input, []);
    expect(result.applied).toBe(true);
    expect(result.reasonClass).toBe('applied');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].action).toBe('apply_econ_delta');
    expect(Number(result.commands[0]?.value?.delta)).toBe(-60);
  });

  it('does not inject when econ command already exists', () => {
    const input = JSON.stringify({
      玩家输入: '继续',
      叙事: [{ sender: '旁白', text: '支付 60 法利。' }]
    });
    const existing: TavernCommand[] = [
      {
        action: 'apply_econ_delta',
        value: { account: '角色.法利', delta: -60, reason: 'state-service' }
      }
    ];
    const result = applyNarrativeEconomicFallback(input, existing);
    expect(result.applied).toBe(false);
    expect(result.reasonClass).toBe('existing-economic-mutation');
    expect(result.commands).toHaveLength(1);
  });

  it('does not inject when ECON_Ledger is not in requiredSheets', () => {
    const input = JSON.stringify({
      玩家输入: '吃早餐',
      叙事: [{ sender: '旁白', text: '支付 60 法利。' }],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'QUEST_Active']
      }
    });
    const result = applyNarrativeEconomicFallback(input, []);
    expect(result.applied).toBe(false);
    expect(result.reasonClass).toBe('no-access');
    expect(result.commands).toHaveLength(0);
  });

  it('detects existing upsert ECON_Ledger command as economic mutation', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'ECON_Ledger',
          rows: [{ ledger_id: 'E1', delta: -20 }]
        }
      }
    ];
    expect(hasEconomicMutationCommand(commands)).toBe(true);
  });

  it('derives checkout delta from dialogue-like narrative payload', () => {
    const input = JSON.stringify({
      玩家输入: '结账离开',
      叙事: [
        { sender: '博丽灵梦', text: '多谢款待。那个希儿是吧？结账。' },
        { sender: '旁白', text: '灰发少女立刻来到桌边。' },
        { sender: '希儿福罗瓦', text: '一共是30法利。面包算小心意，不算在账单里。' }
      ],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'ECON_Ledger']
      }
    });

    const result = applyNarrativeEconomicFallback(input, []);
    expect(result.applied).toBe(true);
    expect(result.reasonClass).toBe('applied');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].action).toBe('apply_econ_delta');
    expect(Number((result.commands[0] as any)?.value?.delta)).toBe(-30);
  });

  it('supports chinese numerals like 三十法利', () => {
    const input = JSON.stringify({
      玩家输入: '结账离开',
      叙事: [
        { sender: '博丽灵梦', text: '三十法利吗？虽然便宜但还是肉疼。' },
        { sender: '旁白', text: '她不情不愿地把硬币放在桌上。' }
      ],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'ECON_Ledger']
      }
    });

    const result = applyNarrativeEconomicFallback(input, []);
    expect(result.applied).toBe(true);
    expect(result.reasonClass).toBe('applied');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].action).toBe('apply_econ_delta');
    expect(Number((result.commands[0] as any)?.value?.delta)).toBe(-30);
  });

  it('skips with out-of-scope reason when strict allowlist blocks 法利 field', () => {
    const input = JSON.stringify({
      玩家输入: '吃早餐并付款',
      叙事: [{ sender: '旁白', text: '她支付了 20 法利。' }],
      填表任务: {
        requiredSheets: ['ECON_Ledger']
      }
    });
    const result = applyNarrativeEconomicFallback(input, [], {
      strictAllowlist: true,
      allowlist: {
        character_resources: {
          CHARACTER_Resources: ['HP', 'MP']
        }
      } as any
    });
    expect(result.applied).toBe(false);
    expect(result.reasonClass).toBe('out-of-scope');
    expect(result.commands).toHaveLength(0);
  });
});
