import { describe, expect, it } from 'vitest';
import { resolveLevelLaunch } from '../src/systems/level-launch';

describe('resolveLevelLaunch', () => {
  it('prefers explicit scene data in production', () => {
    expect(resolveLevelLaunch('world-01-level-02', '?level=world-01-level-03', false)).toEqual({
      levelId: 'world-01-level-02',
      bypassLock: false,
    });
  });

  it('lets the development selector override menu data and bypass locks', () => {
    expect(resolveLevelLaunch('world-01-level-02', '?level=world-01-level-03', true)).toEqual({
      levelId: 'world-01-level-03',
      bypassLock: true,
    });
    expect(resolveLevelLaunch(undefined, '?level=world-01-level-03&touch=1', true)).toEqual({
      levelId: 'world-01-level-03',
      bypassLock: true,
    });
  });

  it('ignores query parameters in production', () => {
    expect(resolveLevelLaunch(undefined, '?level=world-01-level-03', false)).toEqual({
      levelId: 'world-01-level-01',
      bypassLock: false,
    });
  });

  it('falls back to the default for empty selectors and whitespace', () => {
    expect(resolveLevelLaunch(undefined, '', true).levelId).toBe('world-01-level-01');
    expect(resolveLevelLaunch(undefined, '?level=', true).levelId).toBe('world-01-level-01');
    expect(resolveLevelLaunch(undefined, '?level=%20%20', true).levelId).toBe('world-01-level-01');
    expect(resolveLevelLaunch('   ', '', true).levelId).toBe('world-01-level-01');
  });
});
