import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEVEL_ID,
  resolveRequestedLevelId,
} from '../src/core/level-config';

describe('resolveRequestedLevelId', () => {
  it('uses the centralized default without a query', () => {
    expect(resolveRequestedLevelId('', true)).toBe(DEFAULT_LEVEL_ID);
    expect(resolveRequestedLevelId('?foo=bar', true)).toBe(DEFAULT_LEVEL_ID);
    expect(DEFAULT_LEVEL_ID).toBe('world-01-level-01');
  });

  it('reads the development level selector', () => {
    expect(resolveRequestedLevelId('?level=world-01-level-02', true)).toBe('world-01-level-02');
    expect(resolveRequestedLevelId('?level=world-01-level-03&touch=1', true)).toBe(
      'world-01-level-03',
    );
  });

  it('falls back for an empty selector', () => {
    expect(resolveRequestedLevelId('?level=', true)).toBe(DEFAULT_LEVEL_ID);
    expect(resolveRequestedLevelId('?level=%20%20', true)).toBe(DEFAULT_LEVEL_ID);
  });

  it('ignores the selector outside development', () => {
    expect(resolveRequestedLevelId('?level=world-01-level-02', false)).toBe(DEFAULT_LEVEL_ID);
  });

  it('passes unknown IDs through so the repository can report them', () => {
    expect(resolveRequestedLevelId('?level=does-not-exist', true)).toBe('does-not-exist');
  });
});
