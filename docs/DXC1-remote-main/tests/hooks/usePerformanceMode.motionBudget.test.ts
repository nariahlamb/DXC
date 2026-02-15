import { describe, expect, it } from 'vitest';
import { resolveMotionLevel } from '../../hooks/usePerformanceMode';

describe('usePerformanceMode motion budget', () => {
  it('downgrades motion level under low performance condition', () => {
    const level = resolveMotionLevel({ fps: 24, userPreference: 'auto' });
    expect(level).toBe('minimal');
  });
});
