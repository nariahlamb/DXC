import { describe, expect, it } from 'vitest';
import { getNavigationPriority } from '../../utils/ui/navigationPriority';

describe('navigation priority consistency', () => {
  it('returns unified priority order for desktop and mobile consumers', () => {
    const order = getNavigationPriority({
      unreadPhoneCount: 5,
      activeTaskCount: 2,
      hasUrgentNews: false
    });

    expect(order[0]).toBe('PHONE');
  });
});
