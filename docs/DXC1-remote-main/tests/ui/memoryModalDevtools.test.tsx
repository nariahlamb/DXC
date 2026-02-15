import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryModal } from '../../components/game/modals/MemoryModal';
import { createNewGameState } from '../../utils/dataMapper';

const createState = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.__tableRows = {
    QUEST_Active: [
      {
        任务ID: 'Q001',
        任务名称: '登记冒险者',
        类型: '主线',
        发布者: '公会',
        目标描述: '到柜台登记',
        当前进度: '等待办理',
        状态: '进行中',
        时限: '无限制',
        奖励: '公会权限'
      }
    ],
    SYS_TransactionAudit: [
      {
        tx_id: 'tx-devtools:commit',
        turn: 1,
        status: 'committed',
        patch_count: 1,
        command_count: 2,
        reason: '',
        timestamp: '第1日 07:05'
      }
    ]
  };
  state.__tableMeta = {
    txJournal: [
      {
        txId: 'tx-devtools',
        timestamp: Date.now(),
        status: 'committed',
        commandCount: 2,
        patchCount: 1,
        patches: [
          {
            sheetId: 'QUEST_Active',
            rowId: 'Q001',
            operation: 'upsert',
            changedFields: ['任务名称']
          }
        ]
      }
    ]
  };
  return state;
};

const Harness: React.FC = () => {
  const [gameState, setGameState] = useState(createState);
  return (
    <MemoryModal
      isOpen
      onClose={() => undefined}
      gameState={gameState}
      onUpdateGameState={setGameState}
      embedded
    />
  );
};

describe('memory modal devtools', () => {
  it('shows quality metric cards from SYS_ValidationIssue projection', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 2;
    state.日志摘要 = [
      { 回合: 2, 时间: '第1日 07:20', 摘要: '在公会确认补给后继续推进。', 编码索引: 'AM0002' }
    ];
    state.日志大纲 = [];

    render(
      <MemoryModal
        isOpen
        onClose={() => undefined}
        gameState={state}
        embedded
      />
    );

    expect(screen.getByText('AM配对率')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN_SLOTS')).toBeInTheDocument();
    expect(screen.getByText('Summary/Outline同质化')).toBeInTheDocument();
    expect(screen.getByText('BattleMap兼容')).toBeInTheDocument();
    expect(screen.getByText('角色DND字段')).toBeInTheDocument();
    expect(screen.getByText(/miss O:/)).toBeInTheDocument();
  });

  it('shows module locator and supports key locate for selected row', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText(/QUEST_Active/).closest('button')!);
    const moduleHeading = screen.getByText('Module Locator');
    const moduleCard = moduleHeading.parentElement as HTMLElement;
    expect(moduleCard.textContent).toContain('module: quest');

    fireEvent.click(screen.getByRole('button', { name: '主键定位' }));
    expect(screen.getByPlaceholderText('按当前表内容搜索')).toHaveValue('Q001');
  });

  it('replays transaction patch steps and jumps to affected sheet', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText(/SYS_TransactionAudit/).closest('button')!);
    const replayHeading = screen.getByText('Transaction Replay');
    const replayCard = replayHeading.parentElement as HTMLElement;
    expect(replayCard.textContent).toContain('QUEST_Active');

    fireEvent.click(screen.getByRole('button', { name: '跳转受影响表' }));
    expect(screen.getByText(/QUEST_Active#/)).toBeInTheDocument();
  });
});
