import { describe, expect, it } from 'vitest';
import config from '../content/config/interactive-blocks.json';
import { validateInteractiveBlocksConfig } from '../src/systems/block-config-validator';

const valid = validateInteractiveBlocksConfig(config);
if (!valid.ok) throw new Error(JSON.stringify(valid.errors));

describe('interactive block configuration', () => {
  it('accepts the shipped schema-1 tuning and enables Big-form breaking only', () => {
    expect(valid).toEqual({ ok: true, value: config });
    expect(valid.value.break.forms).toEqual(['big']);
    expect(valid.value.bump.durationMs).toBeGreaterThan(0);
    expect(valid.value.reward.emergeDurationMs).toBeGreaterThan(0);
  });

  it('rejects non-object content and unsupported versions', () => {
    expect(validateInteractiveBlocksConfig(null).ok).toBe(false);
    expect(validateInteractiveBlocksConfig({ ...config, schemaVersion: 2 }).ok).toBe(false);
    expect(validateInteractiveBlocksConfig({ schemaVersion: 1 }).ok).toBe(false);
  });

  it.each([
    [{ ...config, bump: null }, '$.bump'],
    [{ ...config, break: 'fast' }, '$.break'],
    [{ ...config, reward: [] }, '$.reward'],
    [{ ...config, bump: { ...config.bump, durationMs: 0 } }, '$.bump.durationMs'],
    [{ ...config, bump: { ...config.bump, durationMs: 1.5 } }, '$.bump.durationMs'],
    [{ ...config, bump: { ...config.bump, offsetPx: Number.NaN } }, '$.bump.offsetPx'],
    [{ ...config, bump: { ...config.bump, offsetPx: 33 } }, '$.bump.offsetPx'],
    [{ ...config, break: { ...config.break, durationMs: -1 } }, '$.break.durationMs'],
    [{ ...config, break: { ...config.break, debrisLifetimeMs: Infinity } }, '$.break.debrisLifetimeMs'],
    [{ ...config, break: { ...config.break, debrisPieces: 0 } }, '$.break.debrisPieces'],
    [{ ...config, break: { ...config.break, debrisPieces: 2.5 } }, '$.break.debrisPieces'],
    [{ ...config, break: { ...config.break, forms: [] } }, '$.break.forms'],
    [{ ...config, break: { ...config.break, forms: ['giant'] } }, '$.break.forms[0]'],
    [{ ...config, break: { ...config.break, forms: ['big', 'big'] } }, '$.break.forms[1]'],
    [{ ...config, reward: { ...config.reward, emergeDurationMs: 0 } }, '$.reward.emergeDurationMs'],
    [{ ...config, reward: { ...config.reward, settleDurationMs: Infinity } }, '$.reward.settleDurationMs'],
    [{ ...config, reward: { ...config.reward, risePx: -1 } }, '$.reward.risePx'],
    [{ ...config, reward: { ...config.reward, risePx: 65 } }, '$.reward.risePx'],
  ])('rejects malformed tuning at %j', (value, path) => {
    const result = validateInteractiveBlocksConfig(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path }));
  });

  it('collects multiple invalid fields in one pass', () => {
    const result = validateInteractiveBlocksConfig({
      schemaVersion: 1,
      bump: { durationMs: 'fast', offsetPx: -1 },
      break: { durationMs: 10, debrisLifetimeMs: 10, debrisPieces: 1, forms: ['small'] },
      reward: { emergeDurationMs: 10, settleDurationMs: 10, risePx: 0 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(({ path }) => path)).toEqual(
        expect.arrayContaining(['$.bump.durationMs', '$.bump.offsetPx']),
      );
    }
  });
});
