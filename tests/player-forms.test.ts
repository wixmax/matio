import { describe, expect, it } from 'vitest';
import effectsConfig from '../content/config/effects.json';
import forms from '../content/config/player-forms.json';
import combat from '../content/config/combat.json';
import level01 from '../content/levels/world-01/level-01.json';
import level02 from '../content/levels/world-01/level-02.json';
import level03 from '../content/levels/world-01/level-03.json';
import { ActiveEffects } from '../src/systems/ActiveEffects';
import { BOMB_BODY_SIZE, bombSpawn } from '../src/systems/bomb-rules';
import { classifyEnemyContact } from '../src/systems/combat-rules';
import { resolveEnemyDamage } from '../src/systems/effect-rules';
import { createLevelGeometry, solidTerrainRects } from '../src/systems/level-geometry';
import { validateLevel } from '../src/systems/level-validator';
import { validatePlayerFormsConfig } from '../src/systems/player-form-config-validator';
import { bigForm, bodyAtFeet, bodySourceMetrics, hasGrowthRoom, SMALL_FORM } from '../src/systems/player-form-rules';
import { PlayerHealth } from '../src/systems/player-health';
import { PlayerTransformation } from '../src/systems/PlayerTransformation';

const big = bigForm(forms.growth);
const world = { worldWidth: 400, worldHeight: 220 };
const feet = { x: 100, y: 180 };
const onFloor = { x: 0, y: 180, width: 400, height: 40 };
const makeRun = () => {
  const effects = new ActiveEffects({ ...effectsConfig, schemaVersion: 1 }, forms.growth.durationMs);
  return { effects, transformation: new PlayerTransformation(effects) };
};
const clear = () => true;
const blocked = () => false;

describe('player form configuration', () => {
  it('accepts the shipped v1 growth config', () => {
    expect(validatePlayerFormsConfig(forms)).toEqual({ ok: true, value: forms });
  });

  it.each([
    [{ ...forms, schemaVersion: 2 }, '$.schemaVersion'],
    [{ ...forms, growth: null }, '$.growth'],
    [{ ...forms, growth: { ...forms.growth, durationMs: 0 } }, '$.growth.durationMs'],
    [{ ...forms, growth: { ...forms.growth, durationMs: Infinity } }, '$.growth.durationMs'],
    [{ ...forms, growth: { ...forms.growth, visualScale: NaN } }, '$.growth.visualScale'],
    [{ ...forms, growth: { ...forms.growth, visualScale: 2.01 } }, '$.growth.visualScale'],
    [{ ...forms, growth: { ...forms.growth, bodyWidthMultiplier: 1.001 } }, '$.growth.bodyWidthMultiplier'],
    [{ ...forms, growth: { ...forms.growth, bodyHeightMultiplier: 2 } }, '$.growth.bodyHeightMultiplier'],
  ])('rejects invalid tuning at %j', (config, path) => {
    const result = validatePlayerFormsConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path }));
  });
});

describe('feet-anchored bodies', () => {
  it('grows around the same feet and restores the exact source body on shrink', () => {
    const smallBounds = bodyAtFeet(feet, SMALL_FORM);
    const bigBounds = bodyAtFeet(feet, big);
    expect(smallBounds).toEqual({ x: 81, y: 96, width: 38, height: 84 });
    expect(bigBounds).toEqual({ x: 77, y: 50, width: 46, height: 130 });
    expect(bodySourceMetrics(SMALL_FORM)).toEqual({ width: 38, height: 84, offsetX: 13, offsetY: 12 });
    const source = bodySourceMetrics(big);
    expect((source.offsetY + source.height) * big.visualScale).toBeCloseTo(96 * big.visualScale);
    expect((source.offsetX + source.width / 2) * big.visualScale).toBeCloseTo(32 * big.visualScale);
    expect(bodyAtFeet({ x: bigBounds.x + bigBounds.width / 2, y: bigBounds.y + bigBounds.height }, SMALL_FORM))
      .toEqual(smallBounds);
  });

  it('accepts exact ground and ceiling contact but rejects overlap with terrain', () => {
    const body = bodyAtFeet(feet, big);
    const ceiling = { x: 60, y: 0, width: 80, height: 50 };
    expect(hasGrowthRoom(body, world, [onFloor, ceiling])).toBe(true);
    expect(hasGrowthRoom(body, world, [onFloor, { ...ceiling, height: 51 }])).toBe(false);
    expect(hasGrowthRoom(body, world, [onFloor, { x: 118, y: 135, width: 20, height: 8 }])).toBe(false);
  });

  it('checks all four world edges while allowing exact edges', () => {
    const fits = (x: number, y: number) => hasGrowthRoom(bodyAtFeet({ x, y }, big), world, []);
    expect([fits(23, 130), fits(377, 220)]).toEqual([true, true]);
    expect([fits(22, 180), fits(378, 180), fits(100, 129), fits(100, 221)]).toEqual([false, false, false, false]);
  });

  it('uses the current form and facing for bomb clearance without changing small hand height', () => {
    const smallBody = bodyAtFeet(feet, SMALL_FORM);
    expect(bombSpawn(smallBody, 1)).toEqual({ x: 132, y: 125 });
    const largeBody = bodyAtFeet(feet, big);
    const right = bombSpawn(largeBody, 1);
    const left = bombSpawn(largeBody, -1);
    expect(right.x - BOMB_BODY_SIZE / 2).toBeGreaterThan(largeBody.x + largeBody.width);
    expect(left.x + BOMB_BODY_SIZE / 2).toBeLessThan(largeBody.x);
    expect(right.y).toBeLessThan(125);
    expect(right.y).toBe(left.y);
  });

  it('keeps stomp classification tied to the previous feet in either form', () => {
    for (const form of [SMALL_FORM, big]) {
      const bounds = bodyAtFeet(feet, form);
      const contact = {
        enemyStompable: true, previousPlayerTop: bounds.y, playerBodyHeight: bounds.height,
        enemyTop: feet.y, playerDeltaY: 3, playerVelocityY: 0, topContactTolerancePx: 4,
      };
      expect(classifyEnemyContact(contact)).toBe('stomp');
      expect(classifyEnemyContact({ ...contact, playerDeltaY: 0 })).toBe('damage');
      expect(classifyEnemyContact({ ...contact, enemyTop: feet.y - 10 })).toBe('damage');
    }
  });
});

describe('attempt-owned growth', () => {
  it('holds a blocked pickup without a timer and starts the full duration on clearance', () => {
    const { transformation, effects } = makeRun();
    transformation.requestGrowth();
    transformation.update(blocked);
    effects.advance(5000);
    expect([transformation.form, transformation.pending, effects.remainingMs('growth')]).toEqual(['small', true, 0]);
    transformation.update(clear);
    expect([transformation.form, transformation.pending, effects.remainingMs('growth')]).toEqual(['big', false, 20000]);
  });

  it('counts down on the shared timeline, refreshes one interval and returns to small at expiry', () => {
    const { transformation, effects } = makeRun();
    effects.activate('magnet');
    transformation.requestGrowth();
    transformation.update(clear);
    effects.advance(8000);
    expect(effects.remainingMs('growth')).toBe(12000);
    transformation.requestGrowth();
    transformation.update(blocked);
    expect([transformation.form, effects.remainingMs('growth'), effects.remainingMs('magnet')])
      .toEqual(['big', 20000, 4000]);
    effects.advance(20000);
    transformation.update(clear);
    expect([transformation.form, transformation.pending, effects.remainingMs('growth')]).toEqual(['small', false, 0]);
  });

  it('preserves time and pending pickup across falls and uses small at a cramped spawn', () => {
    const { transformation, effects } = makeRun();
    transformation.requestGrowth();
    transformation.prepareRespawn(blocked);
    expect(transformation.pending).toBe(true);
    transformation.update(clear);
    effects.advance(1000);
    transformation.prepareRespawn(clear);
    expect(transformation.form).toBe('big');
    transformation.prepareRespawn(blocked);
    expect([transformation.form, transformation.pending]).toEqual(['small', true]);
    effects.advance(2000);
    transformation.update(clear);
    expect([transformation.form, effects.remainingMs('growth')]).toEqual(['big', 17000]);
  });

  it('lets a suspended award expire without granting a new timer', () => {
    const { transformation, effects } = makeRun();
    transformation.requestGrowth();
    transformation.update(clear);
    transformation.prepareRespawn(blocked);
    effects.advance(20000);
    transformation.update(clear);
    expect([transformation.form, transformation.pending]).toEqual(['small', false]);
  });

  it('keeps shield priority and health damage independent of growth', () => {
    const { transformation, effects } = makeRun();
    const health = new PlayerHealth(combat.player);
    const contact = () => resolveEnemyDamage(health, 1, () => effects.consumeShield());
    transformation.requestGrowth();
    transformation.update(clear);
    effects.activate('shield');
    expect(contact()).toBe('absorbed');
    expect(contact()).toBe('ignored');
    health.tick(1000);
    expect(contact()).toBe('damaged');
    expect([transformation.form, effects.remainingMs('growth')]).toEqual(['big', 20000]);
  });

  it.each(['pending', 'active'])('disposes %s state at the terminal boundary and Retry starts fresh', (state) => {
    const { transformation, effects } = makeRun();
    transformation.requestGrowth();
    transformation.update(state === 'active' ? clear : blocked);
    effects.dispose();
    transformation.dispose();
    transformation.requestGrowth();
    transformation.update(clear);
    expect([transformation.form, transformation.pending, effects.remainingMs('growth')]).toEqual(['small', false, 0]);
    const retry = makeRun();
    expect([retry.transformation.form, retry.transformation.pending]).toEqual(['small', false]);
  });
});

describe('authored growth pickups', () => {
  it('reads schema 1, preserves score denominators and positions the optional ceiling test', () => {
    for (const [raw, counts] of [[level01, [12, 2, 1]], [level02, [26, 3, 1]], [level03, [29, 4, 2]]] as const) {
      const level = validateLevel(raw);
      if (!level.ok) throw new Error(JSON.stringify(level.errors));
      const geometry = createLevelGeometry(level.value);
      const growth = geometry.collectibles.filter(({ type }) => type === 'growth-mushroom');
      expect([geometry.collectibleTotals.coins, geometry.collectibleTotals.stars, growth.length]).toEqual(counts);
      const solids = solidTerrainRects(geometry);
      for (const pickup of growth) {
        const stand = { x: pickup.x, y: pickup.y + (raw === level02 ? 96 : 32) };
        expect(hasGrowthRoom(bodyAtFeet(stand, SMALL_FORM), geometry, solids)).toBe(true);
        expect(hasGrowthRoom(bodyAtFeet(stand, big), geometry, solids)).toBe(raw !== level02);
      }
    }
  });
});
