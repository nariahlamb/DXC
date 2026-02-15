import { describe, expect, it } from 'vitest';
import type { CommandItem } from '../hooks/gameLogic/commandQueue';
import { buildPreviewCommands } from '../utils/commandPreview';

const cmd = (id: string): CommandItem => ({ id, text: id });

describe('buildPreviewCommands', () => {
  it('returns commandQueue when not processing', () => {
    const pending = [cmd('p1')];
    const queue = [cmd('q1'), cmd('q2')];

    const result = buildPreviewCommands(false, pending, queue);

    expect(result).toBe(queue);
  });

  it('combines pending and queue when processing', () => {
    const pending = [cmd('p1'), cmd('p2')];
    const queue = [cmd('q1')];

    const result = buildPreviewCommands(true, pending, queue);

    expect(result.map((item) => item.id)).toEqual(['p1', 'p2', 'q1']);
  });
});
